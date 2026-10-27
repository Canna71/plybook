import { describe, expect, it } from "vitest";
import { inventedChess } from "./coach";

const ORIGINAL =
    "Nd5 is the engine's choice. It attacks the queen on e7 with a cheaper piece. It threatens Nxe7+, winning a rook.";

describe("inventedChess", () => {
    it("accepts a rewording that keeps to the moves and squares given", () => {
        expect(
            inventedChess(
                ORIGINAL,
                "Nd5 is the move here: the knight hits the queen on e7, and Nxe7+ next would win a rook.",
            ),
        ).toEqual([]);
    });

    it("accepts a square named inside one of the moves", () => {
        expect(inventedChess(ORIGINAL, "The knight lands on d5.")).toEqual([]);
    });

    it("flags moves and squares the original does not have", () => {
        expect(
            inventedChess(
                ORIGINAL,
                "Nd5 is strong, and after Qd7 White plays Bxf7+ with a win on f7.",
            ),
        ).toEqual(["Qd7", "Bxf7", "f7"]);
        expect(inventedChess("e4 takes the centre.", "e4, then d4.")).toEqual([
            "d4",
        ]);
    });

    it("knows castling and promotions", () => {
        expect(
            inventedChess("O-O castles.", "O-O tucks the king away."),
        ).toEqual([]);
        expect(inventedChess("e8=Q+ wins.", "e8=Q is decisive.")).toEqual([]);
        expect(inventedChess("e8=Q+ wins.", "O-O-O first.")).toEqual(["O-O-O"]);
    });
});
