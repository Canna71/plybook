import {
    Color,
    parseSquare,
    Role,
    ROLES,
    Square,
    squareFile,
    squareRank,
} from "chessops";
import { Piece } from "../common/Piece";
import styles from "./PiecesPopup.module.scss";
import { Accessor, createMemo, For } from "solid-js";
import { Key } from "chessground/types";

export type PiecesPopupProps = {
    onSelected?: (role: Role, color: Color) => void;
    promotingCell: Accessor<Key | undefined>;
    color: Accessor<Color>;
    /** The side at the bottom of the board */
    orientation: Accessor<Color>;
    /** The board's container (positioned), which holds the popup */
    chessBoardDiv: HTMLDivElement | null;
};

// the queen first: it is the one next to the promotion square
const promotableRoles = ROLES.filter(
    (role) => role !== "pawn" && role !== "king",
).reverse();

/**
 * The promotion choice: a column of pieces over the promotion square, running into the board
 * (as on Lichess), placed on the board as shown (flipped or not).
 */
export const PiecesPopup = (props: PiecesPopupProps) => {
    const place = createMemo(() => {
        const key = props.promotingCell();
        const container = props.chessBoardDiv;
        // the squares are those of chessground's board, not of the container around it
        const board = container?.querySelector("cg-board");
        if (!key || !container || !board) return undefined;
        const square = parseSquare(key) as Square;
        const white = props.orientation() === "white";
        const column = white ? squareFile(square) : 7 - squareFile(square);
        const row = white ? 7 - squareRank(square) : squareRank(square);
        const outer = container.getBoundingClientRect();
        const inner = board.getBoundingClientRect();
        const size = inner.width / 8;
        // from the top edge down, or from the bottom edge up
        const top = row === 0 ? 0 : (row - 3) * size;
        return {
            left: inner.left - outer.left + column * size,
            top: inner.top - outer.top + top,
            size,
            down: row === 0,
        };
    });

    return (
        <div
            class={styles.piecespopup}
            style={
                place()
                    ? {
                          left: `${place()!.left}px`,
                          top: `${place()!.top}px`,
                          width: `${place()!.size}px`,
                      }
                    : { display: "none" }
            }
        >
            {/* piece themes style pieces inside .cg-wrap */}
            <div
                class="cg-wrap"
                classList={{ [styles.up]: place() && !place()!.down }}
            >
                <For each={promotableRoles}>
                    {(role) => (
                        <button
                            onClick={() =>
                                props.onSelected?.(role, props.color())
                            }
                        >
                            <Piece role={role} color={props.color()} />
                        </button>
                    )}
                </For>
            </div>
        </div>
    );
};
