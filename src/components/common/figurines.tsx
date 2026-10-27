// Piece icons for text (move lists, material): filled for White in the dark theme, outlined
// in the light one, so White's pieces look light on either background.

import { JSXElement } from "solid-js";
import {
    IconChess,
    IconChessBishop,
    IconChessBishopFilled,
    IconChessFilled,
    IconChessKing,
    IconChessKingFilled,
    IconChessKnight,
    IconChessKnightFilled,
    IconChessQueen,
    IconChessQueenFilled,
    IconChessRook,
    IconChessRookFilled,
} from "@tabler/icons-solidjs";
import { getTheme } from "../../theming/thememanager";

const figurineMap: Record<string, () => JSXElement> = {
    K: () => <IconChessKingFilled />,
    Q: () => <IconChessQueenFilled />,
    R: () => <IconChessRookFilled />,
    B: () => <IconChessBishopFilled />,
    N: () => <IconChessKnightFilled />,
    P: () => <IconChessFilled />,
    k: () => <IconChessKing />,
    q: () => <IconChessQueen />,
    r: () => <IconChessRook />,
    b: () => <IconChessBishop />,
    n: () => <IconChessKnight />,
    p: () => <IconChess />,
};

/** The icon for a piece letter (FEN case: upper for White) */
export function getFigurine(piece: string) {
    if (getTheme() === "light") {
        piece =
            piece === piece.toUpperCase()
                ? piece.toLowerCase()
                : piece.toUpperCase();
    }
    return figurineMap[piece];
}
