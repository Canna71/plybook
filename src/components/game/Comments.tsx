import { Accessor, Component, createEffect, For, useContext } from "solid-js";

import { GameModel } from "../../models/GameModel";
import { useCurrentData, safePaste } from "../common/utils";
import { useContextMenu } from "../common/contextmenu";
import { isPlyData, Path } from "../../models/pgn";
import { GameContext } from "./GameContext";

// regex for square names
export const squareRegex = /([a-h][1-8])/g;
const subst = `<span class="square" data-square="$1">$1</span>`;

type CommentsProps = {
    game: Accessor<GameModel | undefined>;
    currentPath: Accessor<Path | undefined>;
    squareHovered?: (square: string | undefined) => void;
    commentType?: "initial" | "starting" | "move";
};

export const Comments2: Component<CommentsProps> = ({
    game,
    currentPath,
    commentType,
}) => {
    const currentData = useCurrentData(game, currentPath);

    const path = currentPath() || Path.root;

    const comments = () => {
        const data = currentData();
        if (commentType === "initial") {
            return game()?.initial.comments || [];
        } else if (commentType === "starting") {
            return (isPlyData(data) && data.startingComments) || [];
        }

        return (isPlyData(data) && data?.comments) || [];
    };

    return (
        <For each={comments()}>
            {(comment, index) => (
                <CommentsView
                    comments={() => comment}
                    path={path}
                    index={index()}
                />
            )}
        </For>
    );
};

export type CommentsViewProps = {
    comments: Accessor<string>;
    // squareHovered?: (square: string | undefined) => void;
    path: Path;
    index: number;
    starting?: boolean;
};

export const CommentsView: Component<CommentsViewProps> = ({
    comments,
    path,
    index,
    starting,
}) => {
    // take editable from context

    const {
        editable,
        gameSignal: [game, setGame],
        setSquareHovered,
    } = useContext(GameContext)!;
    let ref: HTMLDivElement | undefined;

    const paragraph = () => {
        let line = comments() || "";
        // const matches = line.match(squareRegex);
        line = line.replace(squareRegex, subst);
        // if (matches) {
        //     matches.forEach((match) => {
        //         console.log(match, line);
        //         line = line.replace(
        //             match,
        //             `<span class="square" data-square="${match}">${match}</span>`,
        //         );
        //         console.log(line);
        //     });
        // }

        return line;
    };

    const onMouseOver = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.dataset.square) {
            setSquareHovered?.(target.dataset.square);
        }
    };

    const onMouseLeave = () => {
        setSquareHovered?.(undefined);
    };

    const onBlur = (e: Event) => {
        const target = e.target as HTMLElement;
        const text = target.textContent || "";
        const ng = game()?.updateComment(path, index, text, starting);
        setGame(ng);
    };

    const onKeyDown = (e: KeyboardEvent) => {
        // newline should exit the contenteditable
        if (e.key === "Enter") {
            e.preventDefault();
            ref?.blur();
        }
    };

    // focuses the element if it's empty and editable
    createEffect(() => {
        if (editable() && !comments()) {
            ref?.focus();
        }
    });

    const onDelete = () => {
        const ng = game()?.deleteComment(path, index, starting);
        setGame(ng);
    };

    const onContextMenuInternal = useContextMenu({
        items: [
            {
                id: "moves_comment_delete",
                text: "Delete Comment",
                action: onDelete,
            },
        ],
    });

    const onContextMenu = (e: MouseEvent) => {
        if (editable()) {
            onContextMenuInternal(e);
        }
    };

    const onPaste = (e:ClipboardEvent) => safePaste(ref!, e);

    return (
        <div
            ref={ref}
            data-placeholder="Add a comment"
            contentEditable={editable()}
            onMouseOver={onMouseOver}
            onKeyDown={onKeyDown}
            onMouseLeave={onMouseLeave}
            onBlur={onBlur}
            class="pgnviewer-comments"
            innerHTML={paragraph()}
            onContextMenu={onContextMenu}
            onPaste={onPaste}
        ></div>
    );
};
