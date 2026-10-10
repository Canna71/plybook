import { Accessor, Component, createEffect, useContext } from "solid-js";

import { safePaste } from "../common/utils";
import { useContextMenu } from "../common/contextmenu";
import { Path } from "../../models/pgn";
import { GameContext } from "./GameContext";

// PGN comments are untrusted text: escape them before adding our own markup
export function escapeHtml(text: string) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// regex for square names
export const squareRegex = /(?<!<|")([a-h][1-8])(?!<|")/g;
const squareSubst = `<span class="square" data-square="$1">$1</span>`;

// regex for moves, like 1. e4 or 1... e5 or 12. Nf3+
export const moveRegex = /(\d+\.+\s*)([a-h][1-8][\+\#]?)/g;
const moveSubst = `<span class="move" data-move="$2">$&</span>`;



export type CommentsViewProps = {
    comments: Accessor<string>;
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
        highlightedSquaresSignal: [, setHighlightedSquares],
        highlightedMovesSignal: [, setHighlightedMoves],
    } = useContext(GameContext)!;
    let ref: HTMLDivElement | undefined;

    const paragraph = () => {
        let line = escapeHtml(comments() || "");
        // const matches = line.match(squareRegex);
        line = line.replace(moveRegex, moveSubst);
        line = line.replace(squareRegex, squareSubst);
        

        return line;
    };

    const onMouseOver = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.dataset.square) {
            setHighlightedSquares?.([target.dataset.square]);
        } else {
            setHighlightedSquares?.([]);
        }
        if(target.dataset.move) {
            setHighlightedMoves?.([target.dataset.move]);
        } else {
            setHighlightedMoves?.([]);
        }
    };

    const onMouseLeave = () => {
        setHighlightedSquares?.([]);
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
