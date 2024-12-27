import { Color, Role, ROLES } from "chessops";
import { ToolbarProps } from "../boardeditor/PiecesToolbar";
import { Piece } from "../common/Piece";
import styles from "./PiecesPopup.module.scss";

export type PiecesPopupProps = {
    color: Color;
    onSelected?: (role: Role, color: Color) => void;
};

const promotableRoles = ROLES.filter(role => role !== "pawn" && role !== "king");

export const PiecesPopup = (props: ToolbarProps) => {

    return <div class={styles.piecespopup}>
        <div
            class="cg-wrap">
            {promotableRoles.map(role =>
                <button>
                    <Piece role={role} color={props.color} />
                </button>
            )}
        </div></div>;
};