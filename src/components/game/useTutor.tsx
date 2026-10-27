// The tutor at the board (P2.9, T2): plays the engine's moves "as bad as needed" for your
// level and coaches you through the game. Its searches run on the background explainer
// engine (engine/explainer.ts); its decisions are models/tutor.ts. Used by GameManager when
// playing the engine with the tutor on; the Play screen shows its messages (TutorPanel).
// When the game ends: a summary, and the next game's level when it is set automatically.

import { Accessor, createEffect, createSignal, on, Setter } from "solid-js";
import { Color, NormalMove, opposite, parseSquare, parseUci } from "chessops";
import { parseFen } from "chessops/fen";
import anylogger from "anylogger";
import { explainerSearch } from "../../engine/explainer";
import { EngineInfo } from "../../engine/engineinterfaces";
import { GameModel } from "../../models/GameModel";
import { Path } from "../../models/pgn";
import { classify, scoreWin } from "../../models/review";
import { explainMove } from "../../models/explain";
import { nullMoveFen } from "../../models/threat";
import { getSettingValue, setSettingValue } from "../../models/settings";
import {
    Candidate,
    Chattiness,
    GameResult,
    GameSummary,
    hintSteps,
    MoveRecord,
    nextLevel,
    pickTutorMove,
    shouldAsk,
    standsOut,
    startLevel,
    summarizeGame,
    tutorLevel,
} from "../../models/tutor";
import { describeIdea, isThreat, lineIdea } from "../../reasons/threats";
import { puzzleStats } from "../../storage/lichesspuzzles";
const log = anylogger("tutor");

export const TUTOR_SETTING = "tutor.on";

/**
 * Until a tutor game has set it, the automatic level follows the Lichess puzzle rating (once
 * there are enough puzzles to go by).
 */
export async function levelFromPuzzles() {
    if (!getSettingValue("tutor.auto", true)) return;
    if (getSettingValue("tutor.levelFrom", "default") === "games") return;
    const stats = await puzzleStats().catch((e) => {
        log.warn("puzzle stats", e);
        return undefined;
    });
    const elo = stats && startLevel(stats.rating, stats.attempts);
    if (elo === undefined) return;
    // a game may have ended meanwhile
    if (getSettingValue("tutor.levelFrom", "default") === "games") return;
    await setSettingValue("tutor.elo", elo);
    await setSettingValue("tutor.levelFrom", "puzzles");
}

export type TutorMessage = {
    id: number;
    kind: "warning" | "chance" | "mistake" | "info";
    text: string;
    /** The positions the text talks about, to light up its moves and squares */
    fens: string[];
};

export type TutorQuestion = {
    text: string;
    fens: string[];
    takeBack: () => void;
    keep: () => void;
};

export type TutorHint = { steps: string[]; shown: number };

/** Searches are short: the tutor answers within a second or so. */
const ENGINE_SEARCH = { depth: 12, movetime: 800, multipv: 6 };
const PLAYER_SEARCH = { depth: 12, movetime: 600, multipv: 2 };
const THREAT_SEARCH = { depth: 10, movetime: 400, multipv: 1 };
/** A pause before the engine moves, so its move does not land on top of yours */
const MOVE_DELAY_MS = 400;

const SIDE = { white: "White", black: "Black" };

export function useTutor(o: {
    on: Accessor<boolean>;
    playing: Accessor<boolean>;
    engineColor: Accessor<Color | undefined>;
    game: Accessor<GameModel | undefined>;
    setGame: Setter<GameModel | undefined>;
    path: Accessor<Path | undefined>;
    setPath: (path: Path) => void;
    fen: Accessor<string>;
    applyMove: (move: NormalMove) => void;
}) {
    const [messages, setMessages] = createSignal<TutorMessage[]>([]);
    const [question, setQuestion] = createSignal<TutorQuestion>();
    const [hint, setHint] = createSignal<TutorHint>();
    const [thinking, setThinking] = createSignal(false);
    let nextId = 1;
    const say = (kind: TutorMessage["kind"], text: string, fens: string[]) =>
        setMessages((all) => [...all, { id: nextId++, kind, text, fens }]);

    const chattiness = () =>
        getSettingValue("tutor.chattiness", "normal") as Chattiness;
    const level = () => tutorLevel(getSettingValue("tutor.elo", 1200));

    // your win chance when it was your turn: what your move is measured against
    let yourWinBefore: number | undefined;
    // the game so far, for the summary: your moves, and a strong move waiting to be found
    let records: MoveRecord[] = [];
    let chance: { fen: string; uci: string; motif?: string } | undefined;
    const [summary, setSummary] = createSignal<GameSummary>();
    // each position starts a step; a newer position makes older results stale
    let step = 0;

    const atEnd = () => {
        const node = o.game()?.nodeAt(o.path() ?? Path.root);
        return !!node && node.children.length === 0;
    };

    /** The engine's lines as candidates, with the win chance each keeps for `color`. */
    const candidatesFor = (lines: EngineInfo[], fen: string, color: Color) => {
        const turn: Color = fen.split(" ")[1] === "b" ? "black" : "white";
        return lines.flatMap((l): Candidate[] =>
            l.pv?.length && l.score
                ? [{ uci: l.pv[0], win: scoreWin(l.score, turn, color) }]
                : [],
        );
    };

    /** Plays the tutor's move in `fen` from its candidates. */
    const play = (fen: string, candidates: Candidate[]) => {
        const choice = pickTutorMove(candidates, level());
        const move = choice && parseUci(choice.uci);
        if (!move || !("from" in move) || o.fen() !== fen) return;
        setTimeout(() => {
            if (o.fen() !== fen) return;
            o.applyMove(move);
            if (choice.mistake) {
                say(
                    "mistake",
                    "I've just made a mistake. Can you find how to take advantage of it?",
                    [],
                );
            }
        }, MOVE_DELAY_MS);
    };

    const enginesTurn = async (fen: string, mine: number) => {
        const engineColor = o.engineColor()!;
        const result = await explainerSearch(fen, ENGINE_SEARCH);
        if (mine !== step || !result?.lines.length) return;
        const candidates = candidatesFor(result.lines, fen, engineColor);
        if (!candidates.length) return;

        // your move, judged by how much it left you: before your move, and now
        const yourWinAfter = 100 - candidates[0].win;
        const path = o.path() ?? Path.root;
        const data = o.game()?.dataAt(path);
        const before = o.game()?.dataAt(path.previous());
        // the record of your move, for the summary
        if (data && "uci" in data && before) {
            const loss =
                yourWinBefore !== undefined
                    ? Math.max(0, yourWinBefore - yourWinAfter)
                    : 0;
            const allowed =
                loss >= 15
                    ? lineIdea(
                          fen,
                          result.lines[0].pv ?? [],
                          capturedOn(before.fen, data.uci),
                      )?.motif?.motif
                    : undefined;
            records.push({
                label: moveLabel(before.fen, data.san),
                loss,
                allowed,
                chance:
                    chance?.fen === before.fen
                        ? {
                              found: data.uci === chance.uci,
                              motif: chance.motif,
                          }
                        : undefined,
            });
            chance = undefined;
        }
        const ask =
            yourWinBefore !== undefined &&
            data &&
            "uci" in data &&
            before &&
            getSettingValue("tutor.takebacks", true) &&
            shouldAsk(yourWinBefore, yourWinAfter, chattiness());
        if (ask) {
            const loss = yourWinBefore! - yourWinAfter;
            const why = explainMove({
                fenBefore: before.fen,
                uci: data.uci,
                verdict: { class: classify(loss, false), loss },
                replyPv: result.lines[0].pv,
            })
                // the verdict line says "is a mistake": the question says it more kindly
                .slice(1)
                .join(" ");
            setQuestion({
                text: `Are you sure about ${data.san}? ${why}`.trim(),
                fens: [before.fen, fen],
                takeBack: () => {
                    setQuestion(undefined);
                    // the move never happened, as far as the summary goes
                    records.pop();
                    const g = o.game();
                    if (!g) return;
                    o.setGame(g.deleteFrom(path));
                    o.setPath(path.previous());
                },
                keep: () => {
                    setQuestion(undefined);
                    yourWinBefore = undefined;
                    play(fen, candidates);
                },
            });
            return;
        }
        play(fen, candidates);
    };

    const yourTurn = async (fen: string, mine: number) => {
        const you = opposite(o.engineColor()!);
        // what you can play: your win chance now, and whether one move stands out
        const result = await explainerSearch(fen, PLAYER_SEARCH);
        if (mine !== step || !result?.lines.length) return;
        const candidates = candidatesFor(result.lines, fen, you);
        yourWinBefore = candidates[0]?.win;
        const strong = standsOut(candidates);
        // remembered for the summary, said or not
        chance = strong && {
            fen,
            uci: strong.uci,
            motif: lineIdea(fen, result.lines[0].pv ?? [])?.motif?.motif,
        };
        if (strong && chattiness() !== "quiet") {
            say(
                "chance",
                "There's something strong here. Look for it, or ask for a hint.",
                [],
            );
            setHint({ steps: hintSteps(fen, strong.uci), shown: 0 });
        }

        // what the engine threatens, if you passed
        const passed = nullMoveFen(fen);
        if (!passed) return;
        const threat = await explainerSearch(passed, THREAT_SEARCH);
        if (mine !== step) return;
        const pv = threat?.lines[0]?.pv;
        const idea = pv && lineIdea(passed, pv);
        const serious =
            isThreat(idea) &&
            (idea.mates || idea.gain >= (chattiness() === "chatty" ? 1 : 3));
        if (serious) {
            say(
                "warning",
                `Watch out: ${SIDE[opposite(you)]} threatens ${describeIdea(idea)}.`,
                [passed],
            );
        }
    };

    /** The game ended (a result, or a resignation): the summary, and the next level. */
    const gameOver = () => {
        const you = opposite(o.engineColor() ?? "black");
        const header = o.game()?.headers.get("Result");
        const result: GameResult | undefined =
            header === "1/2-1/2"
                ? "draw"
                : header === "1-0"
                  ? you === "white"
                      ? "win"
                      : "loss"
                  : header === "0-1"
                    ? you === "black"
                        ? "win"
                        : "loss"
                    : undefined;
        if (!result) return;
        const s = summarizeGame(records, result);
        setSummary(s);
        if (getSettingValue("tutor.auto", true)) {
            const elo = getSettingValue("tutor.elo", 1200);
            const next = nextLevel(elo, s);
            if (next !== elo) void setSettingValue("tutor.elo", next);
            // from now on games set the level, not the puzzle rating
            void setSettingValue("tutor.levelFrom", "games");
        }
    };

    // whether the last step saw a game in progress: a new game starts with a clean slate
    let wasPlaying = false;

    createEffect(
        // the engine's colour too: a new game may set it after it starts playing
        on(
            [o.fen, o.playing, o.on, o.engineColor],
            async ([fen, playing, on]) => {
                // the only place steps are counted: any later step makes this one stale
                const mine = ++step;
                if (playing && !wasPlaying) {
                    setMessages([]);
                    setSummary(undefined);
                    yourWinBefore = undefined;
                    records = [];
                    chance = undefined;
                }
                if (!playing && wasPlaying && on) gameOver();
                wasPlaying = playing;
                setHint(undefined);
                // a question about a position that is gone (a new game, a take-back) is moot
                setQuestion(undefined);
                // a step that replaced a busy one must not leave "thinking…" behind
                setThinking(false);
                if (!on || !playing || !o.engineColor() || !atEnd()) return;
                const turn: Color =
                    fen.split(" ")[1] === "b" ? "black" : "white";
                setThinking(true);
                try {
                    if (turn === o.engineColor()) await enginesTurn(fen, mine);
                    else await yourTurn(fen, mine);
                } catch (e) {
                    log.warn("tutor step failed", e);
                } finally {
                    if (mine === step) setThinking(false);
                }
            },
        ),
    );

    /** The next step of the hint, if any. */
    const moreHint = () =>
        setHint(
            (h) => h && { ...h, shown: Math.min(h.steps.length, h.shown + 1) },
        );

    return { messages, question, hint, moreHint, thinking, summary };
}

/** "12. Nf3" or "12... Nf6": a move by its number, from the position before it. */
function moveLabel(fenBefore: string, san: string): string {
    const [, turn, , , , full] = fenBefore.split(" ");
    return `${full ?? "1"}${turn === "b" ? "..." : "."} ${san}`;
}

/** The square a move captured on, if it captured (taking back is not winning a piece). */
function capturedOn(fenBefore: string, uci: string): string | undefined {
    const setup = parseFen(fenBefore);
    const to = parseSquare(uci.slice(2, 4));
    return setup.isOk && to !== undefined && setup.value.board.has(to)
        ? uci.slice(2, 4)
        : undefined;
}

export type Tutor = ReturnType<typeof useTutor>;
