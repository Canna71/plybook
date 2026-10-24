import { describe, expect, it } from "vitest";
import { bookShares, pickBookMove } from "./books";

const MOVES = [
    { uci: "e2e4", san: "e4", weight: 6 },
    { uci: "d2d4", san: "d4", weight: 3 },
    { uci: "g2g4", san: "g4", weight: 0 },
    { uci: "c2c4", san: "c4", weight: 1 },
];

describe("pickBookMove", () => {
    it("picks in proportion to the weights", () => {
        // the random number walks through the cumulative weights 6, 9, 10
        expect(pickBookMove(MOVES, () => 0)).toBe("e2e4");
        expect(pickBookMove(MOVES, () => 0.59)).toBe("e2e4");
        expect(pickBookMove(MOVES, () => 0.6)).toBe("d2d4");
        expect(pickBookMove(MOVES, () => 0.95)).toBe("c2c4");
    });

    it("never plays a move weighted 0 and gives up on an empty book", () => {
        for (let i = 0; i < 50; i++) {
            expect(pickBookMove(MOVES)).not.toBe("g2g4");
        }
        expect(pickBookMove([])).toBeUndefined();
        expect(
            pickBookMove([{ uci: "a", san: "a", weight: 0 }]),
        ).toBeUndefined();
    });
});

it("bookShares are percentages of the total weight", () => {
    expect(bookShares(MOVES)).toEqual([60, 30, 0, 10]);
    expect(bookShares([])).toEqual([]);
});
