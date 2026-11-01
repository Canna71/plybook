import { describe, expect, it } from "vitest";
import { makeGame } from "./pgn";
import { lichessPuzzlePgn, themeLabel } from "./lichesspuzzle";

const PUZZLE = {
    id: "00008",
    fen: "r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2R1/PqP2bPP/7K b - - 0 24",
    moves: ["f2g3", "e6e7", "b2b1", "b3c1", "b1c1", "h6c1"],
    rating: 1811,
    themes: ["crushing", "hangingPiece", "long", "middlegame"],
    gameUrl: "https://lichess.org/787zsVup/black#48",
};

describe("lichessPuzzlePgn", () => {
    it("starts before the set-up move and faces the solver", () => {
        const pgn = lichessPuzzlePgn(PUZZLE)!;
        const game = makeGame(pgn);
        expect(game.initial.pos.turn).toBe("black");
        expect(game.headers.get("Orientation")).toBe("white");
        expect(game.mainline.map((p) => p.san)).toEqual([
            "Bxg3",
            "Rxe7",
            "Qb1+",
            "Nc1",
            "Qxc1+",
            "Qxc1",
        ]);
        expect(pgn).toContain("24... Bxg3 25. Rxe7");
        expect(game.headers.get("PuzzleRating")).toBe("1811");
    });

    it("rejects broken puzzles", () => {
        expect(
            lichessPuzzlePgn({ ...PUZZLE, moves: ["a1a8"] }),
        ).toBeUndefined();
        expect(
            lichessPuzzlePgn({ ...PUZZLE, fen: "nonsense" }),
        ).toBeUndefined();
    });
});

it("themeLabel reads like words", () => {
    expect(themeLabel("hangingPiece")).toBe("Hanging piece");
    expect(themeLabel("mateIn2")).toBe("Mate in 2");
    expect(themeLabel("fork")).toBe("Fork");
});
