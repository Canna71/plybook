// Small chess helpers over chessops: moves from squares, promotions, move equality, colours.

import {
    Chess,
    Color,
    makeSquare,
    NormalMove,
    Position,
    Setup,
    Square,
    squareFile,
    squareRank,
} from "chessops";
import { parseSquare, squareFromCoords } from "chessops/util";
import { makeSan } from "chessops/san";

/** The move from one square name to another ("e2", "e4"), without a promotion */
export function makeMove(orig: string, dest: string): NormalMove {
    return {
        from: parseSquare(orig)!,
        to: parseSquare(dest)!,
        promotion: undefined,
    };
}

/** A pawn of the side to move reaching the last rank */
export function isPromotion(move: NormalMove, position: Chess) {
    const piece = position.board.get(move.from);
    if (piece?.role !== "pawn") return false;
    return squareRank(move.to) === (position.turn === "white" ? 7 : 0);
}

/** The same move in `pos` (as SAN: a king moving two squares and castling agree) */
export function moveEquals(pos: Position, a: NormalMove, b: NormalMove) {
    return makeSan(pos, a) === makeSan(pos, b);
}

export function otherColor(color: Color | undefined): Color {
    return color === "white" ? "black" : "white";
}

/** The side that just moved */
export function toColor(pos: Position): Color {
    return pos.turn === "black" ? "white" : "black";
}

/** The squares a pawn of the side to move could capture en passant to, if allowed */
export function getEnPassantSquares(setup: Setup, whitesTurn: boolean) {
    return Array.from(setup.board.pawn)
        .map((pawn: Square) => {
            const [x, y] = [squareFile(pawn), squareRank(pawn)];
            if (whitesTurn && y === 4)
                return makeSquare(squareFromCoords(x, y + 1)!);
            if (!whitesTurn && y === 3)
                return makeSquare(squareFromCoords(x, y - 1)!);
            return undefined;
        })
        .filter((square) => square !== undefined) as string[];
}
