import {
    Component,
    createEffect,
    createMemo,
    createResource,
    createSignal,
    For,
    on,
    onCleanup,
    Show,
} from "solid-js";
import { A, useSearchParams } from "@solidjs/router";
import { Chess, Color, parseSquare, parseUci } from "chessops";
import { chessgroundDests } from "chessops/compat";
import { parseFen } from "chessops/fen";
import { parsePgn } from "chessops/pgn";
import { Config } from "chessground/config";
import { DrawShape } from "chessground/draw";
import { Key } from "chessground/types";
import anylogger from "anylogger";
import { Chessboard } from "../components/common/chessboard";
import Button from "../components/common/Button";
import TrainerPanel, { TrainerStatus } from "../components/game/TrainerPanel";
import { makeErrorToast } from "../components/common/Toast";
import { drawBrushes } from "../components/common/boardShapes";
import { analysisProfile, startEngine } from "../engine/engineprofiles";
import { IChessEngine, Score } from "../engine/engineinterfaces";
import { searchOnce, SearchResult } from "../engine/search";
import {
    addCandidate,
    guessTurns,
    judgeTurn,
    MAX_CANDIDATES,
    sanOf,
    summary,
    TurnResult,
} from "../models/guess";
import { playerSide } from "../models/mistakes";
import { makeGameInternal } from "../models/pgn";
import { getSettingValue } from "../models/settings";
import { getAccounts } from "../online/onlinegames";
import { baseName, NameWithoutExtension, readDataFile } from "../storage/fs";
import "./GuessTheMove.scss";
const log = anylogger("guess");

type Best = { uci: string; score: Score };

const positionOf = (fen: string) => {
    const setup = parseFen(fen);
    const pos = setup.isOk ? Chess.fromSetup(setup.value) : undefined;
    return pos?.isOk ? pos.value : undefined;
};

const arrow = (uci: string, brush: string): DrawShape | undefined => {
    const move = parseUci(uci);
    return move && "from" in move
        ? {
              orig: uci.slice(0, 2) as Key,
              dest: uci.slice(2, 4) as Key,
              brush,
          }
        : undefined;
};

const formatScore = (score?: Score) =>
    !score
        ? ""
        : score.type === "mate"
          ? `#${score.value}`
          : (score.value / 100).toFixed(1);

/**
 * Guess the move: step through one side's moves of a game, name up to three candidates at each
 * turn, then see the game move, the engine's choice and how good each candidate was.
 */
const GuessTheMove: Component = () => {
    const [params] = useSearchParams();
    const path = () =>
        typeof params.path === "string" ? params.path : undefined;
    const [games] = createResource(path, async (p) =>
        parsePgn(await readDataFile(p)).map(makeGameInternal),
    );
    const [gameIndex, setGameIndex] = createSignal(0);
    const game = () => games()?.[gameIndex()];

    const [chosenSide, setChosenSide] = createSignal<Color>();
    const side = (): Color => {
        const g = game();
        return (
            chosenSide() ??
            (g &&
                playerSide(
                    {
                        white: g.players.white.name,
                        black: g.players.black.name,
                    },
                    [...getAccounts().map((a) => a.username), "Player"],
                )) ??
            "white"
        );
    };
    const turns = createMemo(() => (game() ? guessTurns(game()!, side()) : []));
    const [index, setIndex] = createSignal(0);
    const turn = () => turns()[index()];
    const [candidates, setCandidates] = createSignal<string[]>([]);
    const [result, setResult] = createSignal<TurnResult>();
    const [results, setResults] = createSignal<TurnResult[]>([]);
    const [thinking, setThinking] = createSignal(false);

    // #region engine
    const [engine, setEngine] = createSignal<IChessEngine>();
    // profiles load asynchronously: start (or switch) once a full-strength one is there
    createEffect(
        on(
            () => analysisProfile()?.id,
            (id) => {
                engine()?.quit();
                setEngine(undefined);
                const profile = analysisProfile();
                if (!profile) return;
                startEngine(profile)
                    .then((started) => {
                        if (analysisProfile()?.id === id) setEngine(started);
                        else started.quit();
                    })
                    .catch((err) => makeErrorToast(String(err)));
            },
        ),
    );
    onCleanup(() => engine()?.quit());

    let running: Promise<SearchResult> | undefined;
    /** One search at a time: a newer one stops the previous first. */
    const search = async (
        eng: IChessEngine,
        fen: string,
        options: Parameters<typeof searchOnce>[2],
    ) => {
        if (running) {
            eng.stop();
            await running;
        }
        const current = searchOnce(eng, fen, options);
        running = current;
        const done = await current;
        if (running === current) running = undefined;
        return done;
    };
    const searchOptions = () => ({
        depth: getSettingValue("engine.review.depth", 18),
        movetime: getSettingValue("engine.review.movetime", 1000),
        threads: getSettingValue("engine.threads", 1),
    });

    // the engine looks for the best move while the player thinks
    let best: Promise<Best | undefined> | undefined;
    createEffect(
        on([turn, engine], ([t, eng]) => {
            setCandidates([]);
            setResult(undefined);
            best =
                t && eng
                    ? search(eng, t.fenBefore, {
                          ...searchOptions(),
                          multipv: 1,
                      })
                          .then((r) => {
                              const line = r.lines[0];
                              return line?.pv && line.score
                                  ? { uci: line.pv[0], score: line.score }
                                  : undefined;
                          })
                          .catch((err) => {
                              log.warn(err);
                              return undefined;
                          })
                    : undefined;
        }),
    );
    // #endregion

    const restart = () => {
        setIndex(0);
        setResults([]);
    };

    const reveal = async () => {
        const t = turn();
        const eng = engine();
        if (!t || result()) return;
        setThinking(true);
        try {
            const bestMove = await best;
            const others = [...new Set([...candidates(), t.played.uci])].filter(
                (uci) => uci !== bestMove?.uci,
            );
            const scores = new Map<string, Score>();
            if (eng && others.length) {
                const r = await search(eng, t.fenBefore, {
                    ...searchOptions(),
                    multipv: others.length,
                    searchmoves: others,
                });
                for (const line of r.lines) {
                    if (line.pv?.[0] && line.score)
                        scores.set(line.pv[0], line.score);
                }
            }
            if (turn() !== t) return;
            const judged = judgeTurn(t, candidates(), bestMove, scores);
            setResult(judged);
            setResults((all) => [...all, judged]);
        } finally {
            setThinking(false);
        }
    };

    const onMove = (orig: Key, dest: Key) => {
        const t = turn();
        if (!t || result()) return;
        const pos = positionOf(t.fenBefore);
        const piece = pos?.board.get(parseSquare(orig)!);
        const promotes =
            piece?.role === "pawn" && (dest[1] === "8" || dest[1] === "1");
        setCandidates((c) =>
            addCandidate(
                t.fenBefore,
                c,
                `${orig}${dest}${promotes ? "q" : ""}`,
            ),
        );
    };

    const config = (): Config => {
        const t = turn();
        const r = result();
        const fen = t?.fenBefore ?? "8/8/8/8/8/8/8/8 w - - 0 1";
        const pos = positionOf(fen);
        const shapes = [
            ...candidates().map((uci) => arrow(uci, "blue")),
            ...(r
                ? [
                      arrow(t!.played.uci, "yellow"),
                      ...r.moves
                          .filter((m) => m.isBest)
                          .map((m) => arrow(m.uci, "green")),
                  ]
                : []),
        ].filter((s): s is DrawShape => !!s);
        return {
            fen,
            orientation: side(),
            turnColor: pos?.turn,
            lastMove: undefined,
            check: pos?.isCheck(),
            movable: {
                free: false,
                color: r || !pos ? undefined : pos.turn,
                dests: r || !pos ? new Map() : chessgroundDests(pos),
                events: { after: onMove },
            },
            draggable: { enabled: true },
            drawable: {
                enabled: false,
                autoShapes: shapes,
                brushes: drawBrushes,
            },
        };
    };

    const score = createMemo(() => summary(results()));

    const colorName = () => (side() === "white" ? "White" : "Black");
    const status = (): TrainerStatus => {
        const r = result();
        if (!turn()) return "solved";
        if (!r) return "solving";
        return r.foundBest ? "good" : "wrong";
    };

    return (
        <div class="guess_view">
            <div class="guess-board">
                <Chessboard config={config} />
            </div>
            <div class="guess-panel">
                <div class="field is-grouped is-grouped-multiline">
                    <Show when={(games()?.length ?? 0) > 1}>
                        <div class="control">
                            <div class="select is-small">
                                <select
                                    value={gameIndex()}
                                    onChange={(e) => {
                                        setGameIndex(+e.currentTarget.value);
                                        restart();
                                    }}
                                >
                                    <For each={games()}>
                                        {(g, i) => (
                                            <option value={i()}>
                                                {g.players.white.name ?? "?"} vs{" "}
                                                {g.players.black.name ?? "?"}{" "}
                                                {g.headers.get("Date") ?? ""}
                                            </option>
                                        )}
                                    </For>
                                </select>
                            </div>
                        </div>
                    </Show>
                    <div class="control">
                        <div class="select is-small">
                            <select
                                value={side()}
                                onChange={(e) => {
                                    setChosenSide(
                                        e.currentTarget.value as Color,
                                    );
                                    restart();
                                }}
                            >
                                <option value="white">
                                    Play {game()?.players.white.name ?? "White"}{" "}
                                    (White)
                                </option>
                                <option value="black">
                                    Play {game()?.players.black.name ?? "Black"}{" "}
                                    (Black)
                                </option>
                            </select>
                        </div>
                    </div>
                </div>

                <Show when={!analysisProfile()}>
                    <p class="notification is-warning is-light">
                        <A href="/settings?section=engines">
                            Add a full-strength engine
                        </A>{" "}
                        such as Stockfish to judge your candidates.
                    </p>
                </Show>

                <TrainerPanel
                    title={`Guess the move · ${NameWithoutExtension(baseName(path() ?? ""))}`}
                    progress={() =>
                        turns().length
                            ? `Move ${Math.min(index() + 1, turns().length)} of ${turns().length}`
                            : undefined
                    }
                    side={side}
                    prompt={() =>
                        turn()
                            ? `What would you play as ${colorName()}?`
                            : "Game finished."
                    }
                    status={status}
                    message={() => {
                        const r = result();
                        if (!turn())
                            return "Pick another game or side to go on.";
                        if (!r)
                            return `Move a piece to add a candidate (up to ${MAX_CANDIDATES}), then reveal.`;
                        return r.foundBest
                            ? "You had the best move among your candidates."
                            : "The best move was not among your candidates.";
                    }}
                    note={() =>
                        score().turns
                            ? `Best move found ${score().foundBest}/${score().turns} · game move found ${score().foundPlayed}/${score().turns}`
                            : undefined
                    }
                    actions={
                        <Show
                            when={result()}
                            fallback={
                                <Show when={turn()}>
                                    <Button
                                        class={`is-primary ${thinking() ? "is-loading" : ""}`}
                                        disabled={candidates().length === 0}
                                        onClick={reveal}
                                    >
                                        Reveal
                                    </Button>
                                </Show>
                            }
                        >
                            <Button
                                class="is-primary"
                                onClick={() => setIndex((i) => i + 1)}
                            >
                                Next move
                            </Button>
                        </Show>
                    }
                >
                    <Show when={turn() && !result()}>
                        <div class="tags">
                            <For each={candidates()}>
                                {(uci) => (
                                    <span class="tag is-info is-medium">
                                        {sanOf(turn()!.fenBefore, uci)}
                                        <button
                                            class="delete is-small"
                                            onClick={() =>
                                                setCandidates((c) =>
                                                    c.filter((x) => x !== uci),
                                                )
                                            }
                                        />
                                    </span>
                                )}
                            </For>
                        </div>
                    </Show>
                    <Show when={turn() && result()}>
                        {(r) => (
                            <>
                                <p>
                                    Played in the game:{" "}
                                    <strong>{r().playedSan}</strong>
                                    <Show when={r().bestSan}>
                                        {" "}
                                        · engine: <strong>{r().bestSan}</strong>
                                    </Show>
                                </p>
                                <table class="table is-narrow">
                                    <tbody>
                                        <For each={r().moves}>
                                            {(m) => (
                                                <tr>
                                                    <td>
                                                        <strong>{m.san}</strong>
                                                    </td>
                                                    <td>
                                                        {formatScore(m.score)}
                                                    </td>
                                                    <td>
                                                        {m.loss === undefined
                                                            ? ""
                                                            : m.isBest
                                                              ? "best"
                                                              : `−${m.loss.toFixed(0)}%`}
                                                    </td>
                                                    <td>
                                                        {[
                                                            m.isCandidate &&
                                                                "yours",
                                                            m.isPlayed &&
                                                                "game",
                                                        ]
                                                            .filter(Boolean)
                                                            .join(", ")}
                                                    </td>
                                                </tr>
                                            )}
                                        </For>
                                    </tbody>
                                </table>
                            </>
                        )}
                    </Show>
                </TrainerPanel>
            </div>
        </div>
    );
};

export default GuessTheMove;
