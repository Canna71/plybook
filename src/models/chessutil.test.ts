import { describe, expect, it } from "vitest";
import { Chess } from "chessops";
import { parseFen } from "chessops/fen";
import {
    getEnPassantSquares,
    isPromotion,
    makeMove,
    moveEquals,
    otherColor,
    toColor,
} from "./chessutil";

const position = (fen: string) =>
    Chess.fromSetup(parseFen(fen).unwrap()).unwrap();

describe("chessutil", () => {
    it("makes a move from square names", () => {
        expect(makeMove("e2", "e4")).toEqual({
            from: 12,
            to: 28,
            promotion: undefined,
        });
    });

    it("knows a promotion for either side, and only for pawns", () => {
        const white = position("8/P6k/8/8/8/8/8/K7 w - - 0 1");
        expect(isPromotion(makeMove("a7", "a8"), white)).toBe(true);
        expect(isPromotion(makeMove("a1", "a2"), white)).toBe(false);
        const black = position("k7/8/8/8/8/8/p6K/8 b - - 0 1");
        expect(isPromotion(makeMove("a2", "a1"), black)).toBe(true);
    });

    it("takes the king's two-square move and king-takes-rook as the same castling", () => {
        const pos = position(
            "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1",
        );
        expect(
            moveEquals(pos, makeMove("e1", "g1"), makeMove("e1", "h1")),
        ).toBe(true);
        expect(
            moveEquals(pos, makeMove("e1", "g1"), makeMove("e1", "c1")),
        ).toBe(false);
    });

    it("names the other side and the side that just moved", () => {
        expect(otherColor("white")).toBe("black");
        expect(otherColor(undefined)).toBe("white");
        expect(toColor(Chess.default())).toBe("black");
    });

    it("finds the squares an en passant capture could go to", () => {
        const setup = parseFen(
            "rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3",
        ).unwrap();
        expect(getEnPassantSquares(setup, true)).toEqual(["d6", "e6"]);
    });
});
