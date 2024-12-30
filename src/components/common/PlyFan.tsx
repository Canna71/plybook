import { Color } from "chessops";
import { Component, JSXElement, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { isPiece } from "../../models/pgn";

import { IconChessKingFilled, IconChessQueenFilled, IconChessRookFilled, IconChessBishopFilled, IconChessKnightFilled, IconChessKing, IconChessQueen, IconChessRook, IconChessBishop, IconChessKnight } from "@tabler/icons-solidjs";

const figurineMap: Record<string, ()=>JSXElement> = {
    K: ()=> <IconChessKingFilled />,
    Q: ()=> <IconChessQueenFilled />,
    R: ()=> <IconChessRookFilled />,
    B: ()=> <IconChessBishopFilled />,
    N: ()=> <IconChessKnightFilled />,
    k: ()=> <IconChessKing />,
    q: ()=> <IconChessQueen />,
    r: ()=> <IconChessRook />,
    b: ()=> <IconChessBishop />,
    n: ()=> <IconChessKnight />,
};

export const PlyFan: Component<{ san: string; color: Color; }> = ({
    san, color,
}) => {
    const piece = isPiece(san[0])
        ? color === "white"
            ? san[0].toUpperCase()
            : san[0].toLowerCase()
        : undefined;
    const content = piece ? san.slice(1) : san;



    return (
        <>
            <Show when={piece}>
                <span class="move-fan-figurine">
                    <Dynamic component={figurineMap[piece!]} />
                </span>
            </Show>
            <span class="move-fan-content">{content}</span>
        </>
    );
};
