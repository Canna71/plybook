import {
    Component,
    createMemo,
    createResource,
    createSignal,
    Show,
} from "solid-js";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { Chess, parseSquare } from "chessops";
import { chessgroundDests } from "chessops/compat";
import { parseFen } from "chessops/fen";
import { Config } from "chessground/config";
import { DrawShape } from "chessground/draw";
import { Key } from "chessground/types";
import { Chessboard } from "../components/common/chessboard";
import Button from "../components/common/Button";
import TrainerPanel, { TrainerStatus } from "../components/game/TrainerPanel";
import { drawBrushes } from "../components/common/utils";
import {
    Card,
    counts,
    expectedMoves,
    fenAfter,
    fenKey,
    Line,
    nextDue,
    pickLine,
    review,
} from "../models/repertoire";
import {
    listRepertoires,
    loadRepertoire,
    LoadedRepertoire,
    saveRepertoireCard,
} from "../storage/repertoire";
import { baseName, NameWithoutExtension } from "../storage/fs";
import "./RepertoireTrainer.scss";

const OPPONENT_DELAY_MS = 500;

const positionOf = (fen: string) => {
    const setup = parseFen(fen);
    const pos = setup.isOk ? Chess.fromSetup(setup.value) : undefined;
    return pos?.isOk ? pos.value : undefined;
};

const arrow = (uci: string, brush: string): DrawShape => ({
    orig: uci.slice(0, 2) as Key,
    dest: uci.slice(2, 4) as Key,
    brush,
});

type Feedback = { kind: "new" | "right" | "wrong" | "done"; text: string };

/**
 * Drills a repertoire line by line: the opponent's moves play themselves, the user finds
 * theirs. New moves are shown first; a wrong move shows the right one, which must then be
 * played. Each position is reviewed once per line (spaced repetition, see models/repertoire).
 */
const RepertoireTrainer: Component = () => {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const path = () => (typeof params.path === "string" ? params.path : "");

    const [data, setData] = createSignal<LoadedRepertoire>();
    const [line, setLine] = createSignal<Line>();
    const [index, setIndex] = createSignal(0);
    const [feedback, setFeedback] = createSignal<Feedback>();
    // positions already reviewed in this line: the first answer counts
    let reviewed = new Set<string>();

    const [loaded] = createResource(path, async (p) => {
        const repertoire = (await listRepertoires()).find(
            (r) => r.filePath === p,
        );
        if (!repertoire) return undefined;
        const result = await loadRepertoire(repertoire);
        setData(result);
        nextLine();
        return result;
    });

    const expected = createMemo(() => expectedMoves(data()?.lines ?? []));
    const step = () => line()?.[index()];
    const finished = () => !!line() && index() >= line()!.length;
    const stats = () => {
        const d = data();
        return d ? counts(d.lines, d.cards, new Date()) : undefined;
    };
    const cardAt = (fen: string) => data()?.cards.get(fenKey(fen));

    const record = (fen: string, correct: boolean) => {
        const key = fenKey(fen);
        const d = data();
        if (!d || reviewed.has(key)) return;
        reviewed.add(key);
        const card: Card = review(d.cards.get(key), fen, correct, new Date());
        const cards = new Map(d.cards);
        cards.set(key, card);
        setData({ ...d, cards });
        void saveRepertoireCard(path(), card);
    };

    /** Plays the opponent's moves until it is the user's turn or the line ends. */
    const advance = (from: number) => {
        const l = line()!;
        let i = from;
        const next = () => {
            // a pending opponent move of a line that was skipped
            if (line() !== l) return;
            setIndex(i);
            const s = l[i];
            if (!s) {
                setFeedback({ kind: "done", text: "Line complete." });
                return;
            }
            if (!s.userMove) {
                i++;
                setTimeout(next, OPPONENT_DELAY_MS);
                return;
            }
            if (!cardAt(s.fenBefore)) {
                setFeedback({
                    kind: "new",
                    text: `New move: play ${s.san}.`,
                });
            }
        };
        next();
    };

    const nextLine = () => {
        const d = data();
        if (!d) return;
        const picked = pickLine(d.lines, d.cards, new Date());
        reviewed = new Set();
        setFeedback(undefined);
        setLine(picked);
        if (picked) advance(0);
    };

    const onMove = (orig: Key, dest: Key) => {
        const s = step();
        if (!s || !s.userMove) return;
        const pos = positionOf(s.fenBefore);
        const piece = pos?.board.get(parseSquare(orig)!);
        const promotes =
            piece?.role === "pawn" && (dest[1] === "8" || dest[1] === "1");
        const uci = `${orig}${dest}${promotes ? "q" : ""}`;
        const isNew =
            !cardAt(s.fenBefore) && !reviewed.has(fenKey(s.fenBefore));
        const accepted = expected().get(fenKey(s.fenBefore));
        if (uci === s.uci || accepted?.has(uci)) {
            record(s.fenBefore, true);
            setFeedback(
                uci === s.uci
                    ? isNew
                        ? { kind: "right", text: `${s.san}: learned.` }
                        : { kind: "right", text: `${s.san}: correct.` }
                    : {
                          kind: "right",
                          text: `Also in your repertoire; this line continues with ${s.san}.`,
                      },
            );
            advance(index() + 1);
        } else {
            record(s.fenBefore, false);
            setFeedback({
                kind: "wrong",
                text: `Not your repertoire move: here you play ${s.san}.`,
            });
            // redraws the board, taking the wrong move back
            redraw();
        }
    };

    // bumped to make the board forget a move it should not keep
    const [redraws, setRedraws] = createSignal(0);
    const redraw = () => setRedraws((n) => n + 1);

    const config = (): Config => {
        redraws();
        const l = line();
        const s = step();
        const fen = s
            ? s.fenBefore
            : l?.length
              ? fenAfter(l[l.length - 1])
              : "8/8/8/8/8/8/8/8 w - - 0 1";
        const pos = positionOf(fen);
        const waiting = !!s?.userMove;
        const f = feedback();
        // show the move for a new card or after a mistake
        const hint =
            s && waiting && (f?.kind === "new" || f?.kind === "wrong")
                ? [arrow(s.uci, f.kind === "new" ? "green" : "red")]
                : [];
        return {
            fen,
            orientation: data()?.side ?? "white",
            turnColor: pos?.turn,
            lastMove: undefined,
            check: pos?.isCheck(),
            movable: {
                free: false,
                color: waiting && pos ? pos.turn : undefined,
                dests: waiting && pos ? chessgroundDests(pos) : new Map(),
                events: { after: onMove },
            },
            draggable: { enabled: true },
            drawable: {
                enabled: false,
                autoShapes: hint,
                brushes: drawBrushes,
            },
        };
    };

    const later = () => {
        const next = data() && nextDue(data()!.cards);
        return next ? next.toLocaleString() : undefined;
    };

    /** Shows the move to play; the position counts as missed. */
    const showMove = () => {
        const s = step();
        if (!s?.userMove) return;
        record(s.fenBefore, false);
        setFeedback({ kind: "new", text: `Here you play ${s.san}.` });
    };
    const canShowMove = () => {
        const kind = feedback()?.kind;
        return !!step()?.userMove && kind !== "new" && kind !== "wrong";
    };

    const caughtUp = () => !!data() && !line();
    const status = (): TrainerStatus => {
        if (caughtUp()) return "solved";
        switch (feedback()?.kind) {
            case "right":
                return "good";
            case "wrong":
                return "wrong";
            case "done":
                return "solved";
            default:
                return "solving";
        }
    };

    return (
        <div class="repertoire_view">
            <div class="repertoire-board">
                <Chessboard config={config} />
            </div>
            <div class="repertoire-panel">
                <Show when={!loaded.loading && !loaded()}>
                    <h1 class="title is-5">
                        {NameWithoutExtension(baseName(path()))}
                    </h1>
                    <p class="notification is-warning is-light">
                        This file is not a repertoire. Open it and choose
                        "Repertoire for White" or "for Black" in its toolbar.
                    </p>
                </Show>
                <Show when={data()}>
                    <TrainerPanel
                        title={NameWithoutExtension(baseName(path()))}
                        progress={() => {
                            const s = stats();
                            return s && `${s.due} to review · ${s.new} new`;
                        }}
                        side={() => data()?.side ?? "white"}
                        prompt={() =>
                            caughtUp()
                                ? "All caught up."
                                : finished()
                                  ? "Line complete."
                                  : `Play your repertoire move for ${data()?.side === "black" ? "Black" : "White"}.`
                        }
                        status={status}
                        message={() =>
                            caughtUp()
                                ? later() && `Next review: ${later()}.`
                                : feedback()?.kind === "done"
                                  ? "Every move of this line played."
                                  : feedback()?.text
                        }
                        onHintMove={canShowMove() ? showMove : undefined}
                        onNext={line() ? nextLine : undefined}
                        nextLabel={finished() ? "Next line" : "Skip line"}
                        actions={
                            <Button
                                onClick={() =>
                                    navigate(
                                        `/game?path=${encodeURIComponent(path())}`,
                                    )
                                }
                            >
                                Edit repertoire
                            </Button>
                        }
                    >
                        <Show when={line() && index() > 0}>
                            <p class="repertoire-line">
                                {line()!
                                    .slice(0, index())
                                    .map((s) => s.san)
                                    .join(" ")}
                            </p>
                        </Show>
                    </TrainerPanel>
                </Show>
            </div>
        </div>
    );
};

export default RepertoireTrainer;
