import { Color, Role } from "chessops";
import { Component } from "solid-js";

export const ROLES: Role[] = [
    "pawn",
    "knight",
    "bishop",
    "rook",
    "queen",
    "king",
];

export type PieceProps = {
    role: Role;
    color: Color;
    ref?: ((el: HTMLDivElement) => void) | undefined;
};

export const Piece: Component<PieceProps> = (props) => {
    return (
        <piece
            ref={(el) => {
                props.ref?.(el);
            }}
            class={`${props.color} ${props.role}`}
            data-role={props.role}
            data-color={props.color}
        ></piece>
    );
};
