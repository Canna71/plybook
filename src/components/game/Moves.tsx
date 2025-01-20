import { For, Component, Show, useContext } from "solid-js";
import { Path } from "../../models/pgn";
import { Accessor } from "solid-js";
import { HierarchicalMoveData, makeTree } from "../../models/tree";
import { CommentsView } from "./Comments";

import { Ply } from "./Ply";
import { GameContext } from "./GameContext";

export type MovesProps = {
    // game: Accessor<GameModel | undefined>;
    // setGame: Setter<GameModel | undefined>;
    // currentPath: Accessor<Path | undefined>;
    // setCurrentPath: Setter<Path | undefined>;
    // squareHovered?: (square: string | undefined) => void;
};


const CommentsRows: Component<{
    path: Path;
    starting?: boolean;
    comments: Accessor<string[]>;
}> = ({ comments, path, starting }) => {
    // const { squareHovered } = useContext(GameContext)!;

    return (
        <For each={comments()}>
            {(comment, index) => (
                <tr>
                    <td colSpan={3}>
                        <CommentsView
                            comments={() => comment}
                            path={path}
                            index={index()}
                            starting={starting}
                        />
                    </td>
                </tr>
            )}
        </For>
    );
};

const MoveLine: Component<MoveProps> = ({ move }) => {
    const { currentPathSignal: [] } = useContext(GameContext)!;
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
            <CommentsRows
                comments={() => startingComments}
                path={startingPath}
                starting={true}
            />

            <tr>
                <td>
                    <div class="move-cell">
                        <span class="pgnviewer-movenumber">{move.number}.</span>
                    </div>
                </td>
                <td>
                    <Ply line={move} color="white" />
                </td>
                <td>
                    <Show
                        when={!afterWhite.length}
                        fallback={<Ply line={move} />}
                    >
                        <Ply line={move} color="black" />
                    </Show>
                </td>
            </tr>

            <CommentsRows comments={() => afterWhite} path={wpath} />

            <Show when={afterWhite.length && move.black}>
                <tr>
                    <td>
                        <div class="pgnviewer-movenumber">{move.number}.</div>
                    </td>
                    <td>
                        <Ply line={move} />
                    </td>
                    <td>
                        <Ply line={move} color="black" />
                    </td>
                </tr>
            </Show>

            <CommentsRows comments={() => afterBlack} path={bpath} />

            {move.variations && (
                <For each={move.variations}>
                    {(variation) => (
                        <tr>
                            <td class="pgnviewer-variation-cell" colSpan={3}>
                                <MovesTree
                                    movesTree={() => variation}
                                    initialComments={() => []}
                                />
                            </td>
                        </tr>
                    )}
                </For>
            )}
        </>
    );
};

type MoveProps = {
    move: HierarchicalMoveData;
};

type MovesTreeProps = {
    // showTooltip: (anchor: Element | undefined, plyData: PlyData | undefined) => void;
    movesTree: () => HierarchicalMoveData[];
    // currentPath: Accessor<Path | undefined>;
    // setCurrentPath: Setter<Path | undefined>;
    // squareHovered?: (square: string | undefined) => void;
    initialComments: Accessor<string[]>;
};

const MovesTree: Component<MovesTreeProps> = ({
    movesTree,
    initialComments,
}) => {
    return (
        <table class="pgnviewer-moves">
            <CommentsRows comments={initialComments} path={Path.root} />
            <For each={movesTree()}>
                {(line) => (
                    <>
                        <MoveLine move={line} />
                    </>
                )}
            </For>
        </table>
    );
};

const Moves: Component<MovesProps> = () => {

    const {
        currentPathSignal: [, setCurrentPath],
        gameSignal: [game],
        playingEngine    } = useContext(GameContext)!;


    const onClick = (e: Event) => {
        if (playingEngine()) return;
        const target = e.target as HTMLElement;

        // find the closest anchestor with data-path attribute
        const pathElement = target.closest("[data-path]") as HTMLElement;
        if (!pathElement) return;

        const path: string | undefined = pathElement.dataset.path;
        if (!path) {
            return;
        }
        setCurrentPath(new Path(path));
    };

    const movesTree = (): HierarchicalMoveData[] => {
        const g = game();
        if(!g) return [];
        let moves = g.moves;
        
        const tree = moves && makeTree(moves);
        return tree || [];
    };

    const initialComments = () => {
        return game()?.initial.comments || [];
    };

    const classList = {
        "pgnviewer-moves-panel": true,
        "readonly": playingEngine(),
        "editable": !playingEngine(),
    };

    return (
        <>
            <div classList={classList} onClick={onClick}>
                <MovesTree
                    movesTree={movesTree}
                    initialComments={initialComments}
                />
            </div>
        </>
    );
};

export default Moves;
