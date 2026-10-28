import { describe, expect, it } from "vitest";
import { Color } from "chessops";
import { Path } from "./pgn";
import { MoveClass, ReviewedMove } from "./review";
import { gamePhases, MIN_PHASE_MOVES, phaseOf, phaseTotals } from "./phases";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
// queens off, a rook and a knight each: an endgame as P2.4f defines it
const ENDING = "4k3/pp3ppp/2n5/8/8/2N5/PP3PPP/3RK2r w - - 0 30";

/** A reviewed move with just what the phases read */
const move = (
    ply: number,
    color: Color,
    accuracy: number,
    fenBefore = START,
    cls: MoveClass = "good",
): ReviewedMove => ({
    path: Path.root,
    ply,
    san: "x",
    color,
    winBefore: 50,
    winAfter: 50,
    loss: 0,
    accuracy,
    class: cls,
    fenBefore,
});

describe("phaseOf", () => {
    it("the first ten moves are the opening, then the middlegame", () => {
        expect(phaseOf(move(1, "white", 100))).toBe("opening");
        expect(phaseOf(move(20, "black", 100))).toBe("opening");
        expect(phaseOf(move(21, "white", 100))).toBe("middlegame");
    });

    it("an endgame by the material, whatever the move number", () => {
        expect(phaseOf(move(59, "white", 100, ENDING))).toBe("endgame");
        expect(phaseOf(move(15, "white", 100, ENDING))).toBe("endgame");
    });
});

describe("gamePhases", () => {
    const game = [
        ...[1, 3, 5, 7].map((p) => move(p, "white", 95)),
        ...[2, 4, 6, 8].map((p) => move(p, "black", 90)),
        ...[21, 23, 25].map((p) => move(p, "white", 60)),
        ...[61, 63, 65].map((p) => move(p, "white", 80, ENDING)),
    ];

    it("splits a side's accuracy by phase, with the moves behind it", () => {
        const white = gamePhases(game, "white");
        expect(white.opening.moves).toBe(4);
        expect(white.opening.accuracy).toBeGreaterThan(
            white.middlegame.accuracy!,
        );
        expect(white.middlegame.moves).toBe(3);
        expect(white.endgame.moves).toBe(3);
        expect(gamePhases(game, "black").endgame).toEqual({
            accuracy: undefined,
            moves: 0,
        });
    });

    it("leaves book moves out", () => {
        const booked = game.map((m) =>
            m.ply <= 4 ? { ...m, class: "book" as const } : m,
        );
        expect(gamePhases(booked, "white").opening.moves).toBe(2);
    });
});

describe("phaseTotals", () => {
    it("averages the games where the phase counts", () => {
        const g = (opening: number, moves: number) => ({
            opening: { accuracy: opening, moves },
            middlegame: { accuracy: undefined, moves: 0 },
            endgame: { accuracy: 70, moves: MIN_PHASE_MOVES },
        });
        const totals = phaseTotals([
            g(90, 5),
            g(70, 5),
            g(10, MIN_PHASE_MOVES - 1), // too few moves to count
        ]);
        expect(totals.opening).toEqual({ accuracy: 80, games: 2 });
        expect(totals.middlegame).toEqual({ accuracy: undefined, games: 0 });
        expect(totals.endgame.games).toBe(3);
    });
});
