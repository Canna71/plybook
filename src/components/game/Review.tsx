import { Component, createMemo, For, Show, useContext } from "solid-js";
import { Color } from "chessops";
import { isMate, isPawns } from "chessops/pgn";
import { HierarchicalMoveData, makeTree } from "../../models/tree";
import { Path, PlyData } from "../../models/pgn";
import {
    CLASS_NAGS,
    gameAccuracy,
    keyMoments,
    mainline,
    MoveClass,
    ReviewedMove,
    reviewLine,
    winCurve,
} from "../../models/review";
import { GameContext } from "./GameContext";
import { NagIcon } from "./Ply";
import { PlyFan } from "../common/PlyFan";
import "./Review.scss";

const CLASS_LABELS: Record<MoveClass, string> = {
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
    const reviewed = createMemo(() => reviewLine(nodes()));
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
                    No evaluations yet. Click Analyze Game to review it.
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
                                </li>
                            )}
                        </For>
                    </ul>
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
