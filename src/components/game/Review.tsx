import { Component, For, Show, useContext } from "solid-js";
import { HierarchicalMoveData, makeTree } from "../../models/tree";
import { GameContext } from "./GameContext";
import { Color, parseUci } from "chessops";
import { Path } from "../../models/pgn";
import { NagIcon, Ply } from "./Ply";
import { PlyFan } from "../common/PlyFan";
import { isMate, isPawns } from "chessops/pgn";
import { makeSan } from "chessops/san";

type PlyReviewProps = {
    line: HierarchicalMoveData;
    color?: Color;
};

const PlyReview: Component<PlyReviewProps> = ({ line, color }) => {
    const {
        gameSignal: [game],
    } = useContext(GameContext)!;

    const plyData = line[color === "white" ? "white" : "black"];
    const evaluation = plyData?.evaluation;
    let score = "";
    if (evaluation && isPawns(evaluation)) {
        score = evaluation.pawns.toString();
    }
    if (evaluation && isMate(evaluation)) {
        score = evaluation.mate.toString();
    }
    const isValid = () => {
        return plyData !== undefined;
    };

    if (!isValid()) {
        return <span class="pgnviewer-movecontent">...</span>;
    }

    const parent = () => {
        if (isValid()) {
            return game()!.dataAt(plyData!.path.previous());
        }
    };

    const nag = () => {
        // return 1-6 nags
        const evalThis = plyData?.evaluation;
        const evalPrev = parent()?.evaluation;
        const bestMoveUci = evalPrev?.ext as string;
        const bestMove = parseUci(bestMoveUci)!;
        const san = makeSan(parent()?.pos!, bestMove);
        const isBestMove = san === plyData?.san;
        let nag = 0;
        let diff = 0;
        if (evalThis && evalPrev) {
            if (isPawns(evalThis) && isPawns(evalPrev)) {
                diff = evalThis.pawns - evalPrev.pawns;
                if(parent()!.turn === "black")  diff = -diff;
                
                if (diff > 10) {
                    nag = 3; // brilliant
                } else if (diff > 2) {
                    nag = 1; // good move
                } else if (diff < -5) {
                    nag = 4; // blunder
                } else if (diff < -1) {
                    nag = 2; // mistake
                }
            }
        }
        return {
            nag,
            isBestMove,
            diff
        };
    };

    const posScore = () => {
        if(plyData?.evaluation && isMate(plyData!.evaluation)) {
            return `#${plyData!.evaluation?.mate}`;
        } else if(plyData?.evaluation && isPawns(plyData!.evaluation)) {
            return `${plyData!.evaluation?.pawns}` ;
        }
        return "";
    }

    return (
        <div class="move-cell">
             <span class="engine-info-score has-background-info has-text-info-invert">
                {posScore()}
            </span>
            <Show when={nag().nag > 0}>
                <NagIcon nag={nag().nag} />
            </Show>
            <span class="pgnviewer-movecontent">
                {/* {(color && line[color]?.fan) || "..."} */}
                <PlyFan san={plyData?.san!} color={color!} />({score})({nag().diff})
            </span>
            <Show when={nag().isBestMove}>
                <span class="pgnviewer-bestmove">*</span>
            </Show>
        </div>
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
