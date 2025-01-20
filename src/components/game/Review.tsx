import { Component, For, Show, useContext } from "solid-js";
import { HierarchicalMoveData, makeTree } from "../../models/tree";
import { GameContext } from "./GameContext";
import { Color } from "chessops";
import { Path } from "../../models/pgn";
import { Ply } from "./Ply";
import { PlyFan } from "../common/PlyFan";

type PlyReviewProps = {
    line: HierarchicalMoveData;
    color?: Color;
};

const PlyReview: Component<PlyReviewProps> = ({ line, color }) => {
    const plyData = line[color === "white" ? "white" : "black"];
    const evaluation = plyData?.evaluation;
    const isValid = () => {
        return plyData !== undefined;
    };

    console.log(plyData);
    return (
        <span class="pgnviewer-movecontent">
            {/* {(color && line[color]?.fan) || "..."} */}
            <Show when={isValid()} fallback="...">
                <PlyFan san={plyData?.san!} color={color!} />
            </Show>
        </span>
    );
};

const ReviewLine: Component<{ move: HierarchicalMoveData }> = ({ move }) => {
    const {
        currentPathSignal: [],
    } = useContext(GameContext)!;
    const startingComments =
        move.white?.startingComments || move.black?.startingComments || [];
    const startingPath = move.white?.startingComments
        ? move.white.path
        : move.black!.path;
    const afterWhite = move.white?.comments || [];
    const afterBlack = move.black?.comments || [];

    const ppath = move.white?.path.previous() || Path.root;
    const wpath = move.white?.path || ppath;
    const bpath = move.black?.path || wpath;

    return (
        <>
            <tr>
                <td>
                    <div class="move-cell">
                        <span class="pgnviewer-movenumber">{move.number}.</span>
                    </div>
                </td>
                <td>
                    <PlyReview line={move} color="white" />
                </td>
                <td>
                    <PlyReview line={move} color="black" />
                </td>
            </tr>
        </>
    );
};

const ReviewTree: Component<{
    movesTree: () => HierarchicalMoveData[];
}> = ({ movesTree }) => {
    return (
        <table class="pgnviewer-moves">
            <For each={movesTree()}>
                {(line) => (
                    <>
                        <ReviewLine move={line} />
                    </>
                )}
            </For>
        </table>
    );
};

const Review: Component = () => {
    const {
        currentPathSignal: [, setCurrentPath],
        gameSignal: [game],
        playingEngine,
    } = useContext(GameContext)!;

    const movesTree = (): HierarchicalMoveData[] => {
        const g = game();
        if (!g) return [];
        let moves = g.moves;

        const tree = moves && makeTree(moves, 0, false);
        return tree || [];
    };

    return (
        <div class="pgnviewer-moves-panel">
            <ReviewTree movesTree={movesTree} />
        </div>
    );
};

export default Review;
