import { describe, expect, it } from "vitest";
import { makeGame } from "./pgn";
import {
    classify,
    gameAccuracy,
    keyMoments,
    mainline,
    moveAccuracy,
    reviewLine,
    whiteCp,
    winPercent,
} from "./review";

const review = (pgn: string) => reviewLine(mainline(makeGame(pgn)));

describe("win percent", () => {
    it("is 50 at equality and symmetric", () => {
        expect(winPercent(0)).toBe(50);
        expect(winPercent(200) + winPercent(-200)).toBeCloseTo(100);
        expect(winPercent(200)).toBeCloseTo(67.6, 1);
    });

    it("caps at 10 pawns", () => {
        expect(winPercent(5000)).toBe(winPercent(1000));
    });

    it("scores mates from White's point of view", () => {
        expect(whiteCp({ mate: 3 }, "white")).toBe(1800);
        expect(whiteCp({ mate: -1 }, "black")).toBe(-2000);
        // mate 0: the side to move is checkmated
        expect(whiteCp({ mate: 0 }, "black")).toBe(10000);
    });
});

describe("move accuracy and classes", () => {
    it("is 100 for a move that keeps the evaluation", () => {
        expect(moveAccuracy(50, 50)).toBe(100);
        expect(moveAccuracy(50, 60)).toBe(100);
    });

    it("drops with the win percent lost", () => {
        expect(moveAccuracy(60, 50)).toBeLessThan(70);
        expect(moveAccuracy(90, 10)).toBeLessThan(5);
    });

    it("uses the Lichess thresholds", () => {
        expect(classify(4.9, false)).toBe("good");
        expect(classify(5, false)).toBe("inaccuracy");
        expect(classify(10, false)).toBe("mistake");
        expect(classify(15, false)).toBe("blunder");
        expect(classify(30, true)).toBe("best");
    });
});

describe("reviewLine", () => {
    const scholar =
        "1. e4 {[%eval 0.3]} e5 {[%eval 0.3]} 2. Qh5 {[%eval 0.0]} Nc6 {[%eval 0.0]} " +
        "3. Bc4 {[%eval 0.0]} Nf6 {[%eval 6.0]} 4. Qxf7# 1-0";

    it("finds the blunder and evaluates the final mate without [%eval]", () => {
        const moves = review(scholar);
        expect(moves.map((m) => m.san)).toEqual([
            "e4",
            "e5",
            "Qh5",
            "Nc6",
            "Bc4",
            "Nf6",
            "Qxf7#",
        ]);
        const nf6 = moves[5];
        expect(nf6.color).toBe("black");
        expect(nf6.class).toBe("blunder");
        expect(keyMoments(moves).map((m) => m.san)).toEqual(["Nf6"]);
        // mate counts as the 10-pawn cap, as on Lichess
        expect(moves[6].winAfter).toBeCloseTo(97.5, 1);
        expect(moves[6].class).toBe("good");
    });

    it("marks the engine's choice as best", () => {
        // the [%eval] extension after the depth is the best move in UCI
        const moves = review(
            "1. e4 {[%eval 0.3,20,e7e5]} e5 {[%eval 0.3,20,b1c3]} 2. Nf3 {[%eval 0.3]} *",
        );
        expect(moves.map((m) => [m.san, m.class])).toEqual([
            ["e4", "good"],
            ["e5", "best"],
            ["Nf3", "good"],
        ]);
        expect(moves[2].bestSan).toBe("Nc3");
    });

    it("applies the Lichess mate rules", () => {
        // Black allows mate from an equal position: a blunder
        const allowed = review(
            "1. e4 {[%eval 0.2]} e5 {[%eval 0.2]} 2. Qh5 {[%eval 0.0]} Nc6 {[%eval 0.0]} " +
                "3. Bc4 {[%eval 0.0]} Nf6 {[%eval #1]} 4. Qxf7# 1-0",
        );
        expect(allowed[5].class).toBe("blunder");
        // White misses Qe8# but stays 12 pawns up: only an inaccuracy
        const slipped = review(
            '[FEN "6k1/5ppp/8/8/8/8/5PPP/R3QK2 w - - 0 1"]\n\n{[%eval #1]} ' +
                "1. h3 {[%eval 12.0]} *",
        );
        expect(slipped[0].class).toBe("inaccuracy");
    });

    it("skips moves without evaluations", () => {
        expect(review("1. e4 e5 2. Nf3 *")).toEqual([]);
        // a set-up position has no known evaluation
        expect(
            review(
                '[FEN "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"]\n\n1. e4 {[%eval 3.0]} *',
            ),
        ).toEqual([]);
    });
});

describe("gameAccuracy", () => {
    it("is high for clean play and lower for the side that blundered", () => {
        const moves = review(
            "1. e4 {[%eval 0.3]} e5 {[%eval 0.3]} 2. Qh5 {[%eval 0.0]} Nc6 {[%eval 0.0]} " +
                "3. Bc4 {[%eval 0.0]} Nf6 {[%eval 6.0]} 4. Qxf7# 1-0",
        );
        const { white, black } = gameAccuracy(moves);
        expect(white).toBeGreaterThan(90);
        expect(black).toBeLessThan(white!);
    });

    it("is undefined without moves", () => {
        expect(gameAccuracy([])).toEqual({
            white: undefined,
            black: undefined,
        });
    });
});
