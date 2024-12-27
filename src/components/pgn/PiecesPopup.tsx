import { Color, parseSquare, Role, ROLES, Square, squareFile, squareRank } from "chessops";
import { ToolbarProps } from "../boardeditor/PiecesToolbar";
import { Piece } from "../common/Piece";
import styles from "./PiecesPopup.module.scss";
import { Accessor, createSignal } from "solid-js";
import { flip, ReferenceElement, VirtualElement } from "@floating-ui/dom";
import { useFloating } from "solid-floating-ui";
import { Key } from "chessground/types";

export type PiecesPopupProps = {
    onSelected?: (role: Role, color: Color) => void;
    promotingCell: Accessor<Key | undefined>;
    color: Accessor<Color>;
    chessBoardDiv: HTMLDivElement | null;
};

const promotableRoles = ROLES.filter(role => role !== "pawn" && role !== "king");

export const PiecesPopup = (props: PiecesPopupProps) => {
    const [floating, setFloating] = createSignal<HTMLElement>();


    // calculates the virtual element for the promotion popup
    const reference =
        () => {
            console.log("reference");

            const key = props.promotingCell();
            if (!key) return null;

            // todo calculate the position of the cell, given the square in key and the chessboard div in chessBoardDiv
            const square = parseSquare(key) as Square;
            const sx = squareFile(square);
            const sy = squareRank(square);
            const chessboardwidth = props.chessBoardDiv!.clientWidth;
            const chessboardPosition = props.chessBoardDiv!.getBoundingClientRect();
            const squareSize = chessboardwidth / 8;

            const x = chessboardPosition.x + sx * squareSize;
            const y = chessboardPosition.y + ((sy === 7) ? -1 : 8) * squareSize;


            console.log({ square, sx, sy, chessboardwidth, chessboardPosition, squareSize, x, y });

            const rect = {
                x: x,
                y: y,
                top: y,
                left: x,
                bottom: y + squareSize,
                right: x + squareSize,
                width: squareSize,
                height: squareSize,
            };
            console.log("reference", rect);
            return {
                getBoundingClientRect() {
                    return rect;
                }
            } as VirtualElement;


        };

    const position = useFloating(reference, floating, {
        placement: "bottom",
        middleware: [flip()],
    });

    return <div
        class={styles.piecespopup}
        ref={setFloating}
        style={{
            position: position.strategy,
            top: `${position.y ?? 0}px`,
            left: `${position.x ?? 0}px`,
        }}
    >
        <div
            class="cg-wrap">
            {promotableRoles.map(role =>
                <button>
                    <Piece role={role} color={props.color()} />
                </button>
            )}
        </div></div>;
};