import {
    Component,
    createMemo,
    createResource,
    createSignal,
    For,
    Show,
    useContext,
} from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Color } from "chessops";
import { isMate, isPawns } from "chessops/pgn";
import { HierarchicalMoveData, makeTree } from "../../models/tree";
import { Path, PlyData } from "../../models/pgn";
import {
    CLASS_NAGS,
    gameAccuracy,
    keyMoments,
    lineMoves,
    mainline,
    MoveClass,
    ReviewedMove,
    reviewLine,
    ReviewNode,
    winCurve,
} from "../../models/review";
import { gameBookPlies } from "../../storage/books";
import { GameContext } from "./GameContext";
import { NagIcon } from "./Ply";
import { PlyFan } from "../common/PlyFan";
import Button from "../common/Button";
import { makeErrorToast, makeToast } from "../common/Toast";
import {
    GameInfo,
    mistakePuzzles,
    playerSide,
    trainableMistakes,
} from "../../models/mistakes";
import { saveMistakePuzzles } from "../../storage/mistakes";
import { explainMoveFull } from "../../models/explain";
import { positionsBefore } from "./gamePosition";
import { gameHistory, historyFor } from "../../models/gamehistory";
import ExplanationEvidence from "./ExplanationEvidence";
import { explainAlternatives, explainLines } from "../../engine/explainer";
import BoardText from "./BoardText";
import { getAccounts } from "../../online/onlinegames";
import "./Review.scss";

const CLASS_LABELS: Record<MoveClass, string> = {
    book: "Book",
    best: "Best",
    good: "Good",
    inaccuracy: "Inaccuracies",
    mistake: "Mistakes",
    blunder: "Blunders",
};
const COUNTED: MoveClass[] = ["inaccuracy", "mistake", "blunder"];

const formatScore = (data?: PlyData) => {
    const ev = data?.evaluation;
    if (ev && isMate(ev)) return `#${ev.mate}`;
    if (ev && isPawns(ev)) return ev.pawns.toFixed(1);
    return "";
};

const moveLabel = (m: ReviewedMove) =>
    `${Math.ceil(m.ply / 2)}${m.color === "white" ? "." : "..."} ${m.san}`;

const Review: Component = () => {
    const {
        currentPathSignal: [currentPath, setCurrentPath],
        gameSignal: [game],
        playingEngine,
    } = useContext(GameContext)!;

    const nodes = createMemo(() => {
        const g = game();
        return g ? mainline(g) : [];
    });
    // the opening moves found in the user's books (Settings → Books): not graded (P1.5).
    // Keyed by the moves, so evaluations arriving during a review do not look them up again
    const [bookPlies] = createResource(
        () => {
            const line = lineMoves(nodes());
            return line.length
                ? { key: line.map((m) => m.san).join(" "), line }
                : undefined;
        },
        ({ line }) => gameBookPlies(line),
    );
    const reviewed = createMemo(() =>
        reviewLine(nodes(), bookPlies.latest ?? 0),
    );
    /** The last book move and the first move out of the book, as positions of the line */
    const bookEdge = () => {
        const n = bookPlies.latest ?? 0;
        return n > 0
            ? {
                  last: nodes()[n],
                  out: nodes()[n + 1] as ReviewNode | undefined,
              }
            : undefined;
    };
    const nodeLabel = (node: ReviewNode) => {
        const ply = node.ply ?? 0;
        const white = node.turn === "black";
        return `${Math.ceil(ply / 2)}${white ? "." : "..."} ${node.san}`;
    };
    const byPath = createMemo(
        () => new Map(reviewed().map((m) => [m.path.path, m])),
    );
    const accuracy = createMemo(() => gameAccuracy(reviewed()));
    const moments = createMemo(() => keyMoments(reviewed()));
    const movesTree = createMemo((): HierarchicalMoveData[] => {
        const g = game();
        return (g && makeTree(g.moves, 0, false)) || [];
    });

    const goTo = (path: Path) => {
        if (!playingEngine()) setCurrentPath(path);
    };

    const count = (color: Color, cls: MoveClass) =>
        reviewed().filter((m) => m.color === color && m.class === cls).length;

    const player = (color: Color) =>
        game()?.players[color].name ?? (color === "white" ? "White" : "Black");

    // the open key moment's engine lines, from the explainer in the background: they let the
    // explanation name what the answer and the better move do ("a fork of …")
    const openMoment = () =>
        moments().find((m) => m.path.path === currentPath()?.path);
    const [momentLines] = createResource(
        () => {
            const m = openMoment();
            const g = game();
            const data = m && g?.dataAt(m.path);
            return g && m?.fenBefore && data && "fen" in data
                ? {
                      before: m.fenBefore,
                      after: data.fen,
                      // the game behind each position, so repetitions count
                      games: {
                          before: historyFor(
                              gameHistory(g, m.path.previous()),
                              m.fenBefore,
                          ),
                          after: historyFor(gameHistory(g, m.path), data.fen),
                      },
                  }
                : undefined;
        },
        async ({ before, after, games }) => ({
            before,
            ...(await explainLines(before, after, games)),
            // was the engine's move the only good one? Says how hard the position was
            alternatives: await explainAlternatives(before, games.before),
        }),
    );

    /** The positions a moment's explanation talks about: before and after the move. */
    const momentFens = (m: ReviewedMove) => {
        const data = game()?.dataAt(m.path);
        return [
            m.fenBefore,
            data && "fen" in data ? data.fen : undefined,
        ].filter((f): f is string => !!f);
    };

    /**
     * Why the move was bad, with its evidence: the review's scores (with their depths), the
     * game so far, and the engine lines once they arrive.
     */
    const momentExplanation = (m: ReviewedMove) => {
        const g = game();
        const data = g?.dataAt(m.path);
        if (!g || !m.fenBefore || !data || !("uci" in data)) return undefined;
        // lines of another moment, still loading, are not this one's
        const lines =
            momentLines.latest?.before === m.fenBefore
                ? momentLines.latest
                : undefined;
        const x = explainMoveFull({
            fenBefore: m.fenBefore,
            uci: data.uci,
            verdict: m,
            bestUci: m.bestUci,
            bestPv: lines?.bestPv,
            replyPv: lines?.replyPv,
            evaluations: {
                before: g.dataAt(m.path.previous())?.evaluation,
                after: data.evaluation,
            },
            history: positionsBefore(g, m.path.previous()),
            alternatives: lines?.alternatives,
        });
        return x?.text.length ? x : undefined;
    };

    // #region puzzles from mistakes
    const navigate = useNavigate();
    const info = createMemo((): GameInfo => {
        const headers = game()?.headers;
        const site = headers?.get("Site");
        return {
            white: game()?.players.white.name,
            black: game()?.players.black.name,
            date: headers?.get("UTCDate") ?? headers?.get("Date"),
            // chess.com puts the game URL in Link, Lichess in Site
            site:
                headers?.get("Link") ??
                (site?.startsWith("http") ? site : undefined),
        };
    });
    const [chosenSide, setChosenSide] = createSignal<Color>();
    const trainSide = () =>
        chosenSide() ??
        playerSide(info(), [
            ...getAccounts().map((a) => a.username),
            "Player",
        ]) ??
        "white";
    const trainable = createMemo(() =>
        trainableMistakes(reviewed(), trainSide()),
    );
    // mistakes without a best move: evaluations imported without one
    const withoutBest = () =>
        moments().filter(
            (m) =>
                m.color === trainSide() &&
                m.class !== "inaccuracy" &&
                !m.bestSan,
        ).length;
    const [createdPuzzles, setCreatedPuzzles] = createSignal<string[]>([]);

    const createPuzzles = async () => {
        try {
            const { created, skipped } = await saveMistakePuzzles(
                mistakePuzzles(reviewed(), info(), trainSide()),
            );
            setCreatedPuzzles(created);
            makeToast(
                `${created.length} puzzles created in Library/Mistakes` +
                    (skipped ? `, ${skipped} already there` : ""),
            );
        } catch (err) {
            makeErrorToast(err instanceof Error ? err.message : String(err));
        }
    };
    // #endregion

    const MoveCell: Component<{ data?: PlyData }> = (props) => {
        const review = () => props.data && byPath().get(props.data.path.path);
        const nag = () => {
            const cls = review()?.class;
            return cls && CLASS_NAGS[cls];
        };
        return (
            <Show
                when={props.data}
                fallback={<span class="pgnviewer-movecontent">...</span>}
            >
                {(data) => (
                    <div
                        class="move-cell pgnviewer-move"
                        classList={{
                            "is-current":
                                currentPath()?.path === data().path.path,
                        }}
                        onClick={() => goTo(data().path)}
                    >
                        <span class="engine-info-score has-background-info has-text-info-invert">
                            {formatScore(data())}
                        </span>
                        <Show when={nag()}>{(n) => <NagIcon nag={n()} />}</Show>
                        <span class="pgnviewer-movecontent">
                            <PlyFan
                                san={data().san}
                                color={
                                    data().turn === "white" ? "black" : "white"
                                }
                            />
                        </span>
                        <Show when={review()?.class === "best"}>
                            <span class="pgnviewer-bestmove" title="Best move">
                                ⭐
                            </span>
                        </Show>
                    </div>
                )}
            </Show>
        );
    };

    return (
        <Show
            when={reviewed().length > 0}
            fallback={
                <div class="review-empty">
                    No evaluations yet. Click “Review the game” to have the
                    engine judge every move.
                </div>
            }
        >
            <div class="review-panel">
                <table class="table is-narrow is-fullwidth review-summary">
                    <thead>
                        <tr>
                            <th />
                            <th>{player("white")}</th>
                            <th>{player("black")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Accuracy</td>
                            <For each={["white", "black"] as Color[]}>
                                {(color) => (
                                    <td class="accuracy">
                                        {accuracy()[color]?.toFixed(0) ?? "–"}
                                        <Show
                                            when={
                                                accuracy()[color] !== undefined
                                            }
                                        >
                                            %
                                        </Show>
                                    </td>
                                )}
                            </For>
                        </tr>
                        <For each={COUNTED}>
                            {(cls) => (
                                <tr>
                                    <td>
                                        <NagIcon nag={CLASS_NAGS[cls]!} />{" "}
                                        {CLASS_LABELS[cls]}
                                    </td>
                                    <td>{count("white", cls)}</td>
                                    <td>{count("black", cls)}</td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>

                <Show when={bookEdge()}>
                    {(edge) => (
                        <p class="review-book">
                            In your books until{" "}
                            <a onClick={() => goTo(edge().last.path)}>
                                {nodeLabel(edge().last)}
                            </a>
                            <Show
                                when={edge().out}
                                fallback=": every move is a book move."
                            >
                                {(out) => (
                                    <>
                                        , out of book with{" "}
                                        <a onClick={() => goTo(out().path)}>
                                            {nodeLabel(out())}
                                        </a>
                                        . Book moves are not graded.
                                    </>
                                )}
                            </Show>
                        </p>
                    )}
                </Show>

                <EvalGraph
                    points={winCurve(nodes())}
                    current={currentPath()}
                    onSelect={goTo}
                />

                <Show when={moments().length > 0}>
                    <h3 class="title is-6">Key moments</h3>
                    <ul class="key-moments">
                        <For each={moments()}>
                            {(m) => (
                                <li
                                    classList={{
                                        "is-current":
                                            currentPath()?.path === m.path.path,
                                    }}
                                    onClick={() => goTo(m.path)}
                                >
                                    <NagIcon nag={CLASS_NAGS[m.class]!} />
                                    <span class="moment-move">
                                        {moveLabel(m)}
                                    </span>
                                    <span class="moment-loss">
                                        −{m.loss.toFixed(0)}% win chance
                                    </span>
                                    <Show when={m.bestSan}>
                                        <span class="moment-best">
                                            best was {m.bestSan}
                                        </span>
                                    </Show>
                                    <Show
                                        when={
                                            currentPath()?.path ===
                                                m.path.path &&
                                            momentExplanation(m)
                                        }
                                    >
                                        {(x) => (
                                            <div class="moment-explanation">
                                                <BoardText
                                                    text={x().text.join(" ")}
                                                    fens={() => momentFens(m)}
                                                />
                                                <ExplanationEvidence
                                                    explanation={x()}
                                                />
                                            </div>
                                        )}
                                    </Show>
                                </li>
                            )}
                        </For>
                    </ul>
                </Show>

                <div class="train-mistakes">
                    <div class="select is-small">
                        <select
                            title="Whose mistakes to train"
                            value={trainSide()}
                            onChange={(e) => {
                                setChosenSide(e.currentTarget.value as Color);
                                setCreatedPuzzles([]);
                            }}
                        >
                            <option value="white">{player("white")}</option>
                            <option value="black">{player("black")}</option>
                        </select>
                    </div>
                    <Button
                        class="is-small is-primary"
                        title="Each mistake or blunder becomes a 'find the better move' puzzle"
                        disabled={trainable().length === 0}
                        onClick={createPuzzles}
                    >
                        Make {trainable().length} puzzles from mistakes
                    </Button>
                    <Show when={createdPuzzles().length > 0}>
                        <Button
                            class="is-small"
                            onClick={() =>
                                navigate(
                                    `/puzzle?path=${encodeURIComponent(createdPuzzles()[0])}`,
                                )
                            }
                        >
                            Train them
                        </Button>
                    </Show>
                </div>
                <Show when={withoutBest() > 0}>
                    <p class="train-hint">
                        {withoutBest()} mistakes have no better move yet. Click
                        Analyze Game to find them.
                    </p>
                </Show>

                <table class="pgnviewer-moves review-moves">
                    <tbody>
                        <For each={movesTree()}>
                            {(line) => (
                                <tr>
                                    <td>
                                        <div class="move-cell">
                                            <span class="pgnviewer-movenumber">
                                                {line.number}.
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        <MoveCell data={line.white} />
                                    </td>
                                    <td>
                                        <MoveCell data={line.black} />
                                    </td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </div>
        </Show>
    );
};

const GRAPH_HEIGHT = 60;

/** White's win % over the game; click to jump to a position. */
const EvalGraph: Component<{
    points: { path: Path; win?: number }[];
    current?: Path;
    onSelect: (path: Path) => void;
}> = (props) => {
    const width = () => Math.max(1, props.points.length - 1);
    const y = (win: number) => GRAPH_HEIGHT * (1 - win / 100);
    const area = () => {
        const pts = props.points
            .map((p, i) => (p.win === undefined ? "" : `${i},${y(p.win)}`))
            .filter(Boolean);
        return pts.length
            ? `0,${GRAPH_HEIGHT} ${pts.join(" ")} ${width()},${GRAPH_HEIGHT}`
            : "";
    };
    const currentIndex = () =>
        props.points.findIndex((p) => p.path.path === props.current?.path);

    const onClick = (e: MouseEvent) => {
        const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
        const i = Math.round(((e.clientX - rect.left) / rect.width) * width());
        const point = props.points[Math.max(0, Math.min(i, width()))];
        if (point) props.onSelect(point.path);
    };

    return (
        <svg
            class="eval-graph"
            viewBox={`0 0 ${width()} ${GRAPH_HEIGHT}`}
            preserveAspectRatio="none"
            onClick={onClick}
        >
            <title>White's winning chances; click to jump to a move</title>
            <polygon class="eval-graph-white" points={area()} />
            <line
                class="eval-graph-mid"
                x1="0"
                x2={width()}
                y1={GRAPH_HEIGHT / 2}
                y2={GRAPH_HEIGHT / 2}
            />
            <Show when={currentIndex() >= 0}>
                <line
                    class="eval-graph-current"
                    x1={currentIndex()}
                    x2={currentIndex()}
                    y1="0"
                    y2={GRAPH_HEIGHT}
                />
            </Show>
        </svg>
    );
};

export default Review;
