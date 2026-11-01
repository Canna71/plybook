import { Accessor, Component, createEffect, useContext } from "solid-js";

import { safePaste } from "../common/editing";
import { useContextMenu } from "../common/contextmenu";
import { Path } from "../../models/pgn";
import { GameContext } from "./GameContext";
import { formatTime, parseYouTube, YOUTUBE_URL } from "../../models/youtube";
import { playVideo } from "../video/VideoPlayer";

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
export const moveRegex = /(\d+\.+\s*)([a-h][1-8][+#]?)/g;
const moveSubst = `<span class="move" data-move="$2">$&</span>`;

/**
 * Where a comment was just added, empty, for typing ("Add a comment"): that box takes the
 * focus. Not every empty one: a comment of arrows or circles alone shows empty too, and
 * several taking the focus in turn, each blur saving the game, hung the app (F.46). Kept for a
 * moment, as the moves list is made again more than once after an edit (the game, then its PGN).
 */
let newComment: Path | undefined;
let newCommentTimer: ReturnType<typeof setTimeout> | undefined;
export function focusNewComment(path: Path) {
    newComment = path;
    clearTimeout(newCommentTimer);
    newCommentTimer = setTimeout(() => (newComment = undefined), 1000);
}

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
        // video links first, set aside: their ids would otherwise get square markup ("e4")
        const videos: string[] = [];
        line = line.replace(YOUTUBE_URL, (url) => {
            const v = parseYouTube(url);
            if (!v) return url;
            // the id is checked (11 of [A-Za-z0-9_-]) and the url is escaped already
            videos.push(
                `<span class="video-link" data-video-id="${v.id}" data-video-start="${v.start}" data-label="▶ ${formatTime(v.start)}" title="Play the video from ${formatTime(v.start)}">${url}</span>`,
            );
            // a private-use character marks the spot: it never appears in comments
            return `${videos.length - 1}`;
        });
        // const matches = line.match(squareRegex);
        line = line.replace(moveRegex, moveSubst);
        line = line.replace(squareRegex, squareSubst);
        line = line.replace(/(\d+)/g, (_, i) => videos[+i]);

        return line;
    };

    const onClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const id = target.dataset.videoId;
        if (!id) return;
        e.preventDefault();
        playVideo({ id, start: +(target.dataset.videoStart ?? 0) });
    };

    const onMouseOver = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.dataset.square) {
            setHighlightedSquares?.([target.dataset.square]);
        } else {
            setHighlightedSquares?.([]);
        }
        if (target.dataset.move) {
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
        if (text === (comments() || "")) return;
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

    // the comment just added, empty and editable, opens for typing; "before" a move puts it
    // with the move before
    createEffect(() => {
        if (!editable() || comments() || !newComment) return;
        if (!path.equals(newComment) && !path.equals(newComment.previous()))
            return;
        ref?.focus();
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

    const onPaste = (e: ClipboardEvent) => safePaste(ref!, e);

    return (
        <div
            ref={ref}
            data-placeholder="Add a comment"
            contentEditable={editable()}
            onMouseOver={onMouseOver}
            onClick={onClick}
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
