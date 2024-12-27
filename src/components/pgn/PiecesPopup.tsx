import { Color, Role, ROLES } from "chessops";
import { ToolbarProps } from "../boardeditor/PiecesToolbar";
import { Piece } from "../common/Piece";
import styles from "./PiecesPopup.module.scss";
import { Accessor, createSignal } from "solid-js";
import { ReferenceElement, VirtualElement } from "@floating-ui/dom";
import { useFloating } from "solid-floating-ui";

export type PiecesPopupProps = {
    onSelected?: (role: Role, color: Color) => void;
    reference: Accessor<ReferenceElement | null | undefined>;
    color: Accessor<Color>;
};

const promotableRoles = ROLES.filter(role => role !== "pawn" && role !== "king");

export const PiecesPopup = (props: PiecesPopupProps) => {
    const [floating, setFloating] = createSignal<HTMLElement>();
    const position = useFloating(props.reference, floating);

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