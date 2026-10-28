import { describe, expect, it } from "vitest";
import { BookMove, bookPlies, bookShares, pickBookMove } from "./books";

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

describe("bookPlies", () => {
    // a book that knows 1.e4 e5 2.Nf3 (and has 2.Qh5 only as a move to avoid)
    const BOOK: Record<string, BookMove[]> = {
        start: [{ uci: "e2e4", san: "e4", weight: 5 }],
        e4: [{ uci: "e7e5", san: "e5", weight: 5 }],
        e5: [
            { uci: "g1f3", san: "Nf3", weight: 5 },
            { uci: "d1h5", san: "Qh5", weight: 0 },
        ],
    };
    const lookup = async (fen: string) => BOOK[fen] ?? [];
    const line = (sans: string[]) => {
        const fens = ["start", "e4", "e5", "Nf3", "Nc6"];
        return sans.map((san, i) => ({ fen: fens[i], san }));
    };

    it("counts the moves up to the first the books do not have", async () => {
        expect(await bookPlies(line(["e4", "e5", "Nf3", "Nc6"]), lookup)).toBe(
            3,
        );
        expect(await bookPlies(line(["d4"]), lookup)).toBe(0);
    });

    it("a move weighted 0 is not a book move", async () => {
        expect(await bookPlies(line(["e4", "e5", "Qh5"]), lookup)).toBe(2);
    });

    it("stops at a position it cannot look up", async () => {
        expect(await bookPlies([{ san: "e4" }], lookup)).toBe(0);
    });
});

it("bookShares are percentages of the total weight", () => {
    expect(bookShares(MOVES)).toEqual([60, 30, 0, 10]);
    expect(bookShares([])).toEqual([]);
});
