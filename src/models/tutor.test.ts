import { describe, expect, it } from "vitest";
import {
    hintSteps,
    pickTutorMove,
    shouldAsk,
    standsOut,
    tutorLevel,
} from "./tutor";

/** A random source that returns the given numbers in turn. */
const sequence = (...values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length];
};
const NEVER = () => 0.99; // no mistake, first choice

describe("tutorLevel", () => {
    it("is gentler for beginners, sharper for strong players", () => {
        const beginner = tutorLevel(800);
        const strong = tutorLevel(2000);
        expect(beginner.maxLoss).toBeGreaterThan(strong.maxLoss);
        expect(beginner.mistakeRate).toBeGreaterThan(strong.mistakeRate);
        expect(beginner.target).toBeLessThan(strong.target);
        // the ends hold outside the range
        expect(tutorLevel(100)).toEqual({ ...tutorLevel(600), elo: 100 });
    });
});

describe("pickTutorMove", () => {
    const level = tutorLevel(1000); // maxLoss ~22, target ~62, mistakes ~12%

    it("plays its best move when the game is even", () => {
        const choice = pickTutorMove(
            [
                { uci: "e2e4", win: 55 },
                { uci: "d2d4", win: 54 },
            ],
            level,
            NEVER,
        );
        expect(choice).toEqual({ uci: "e2e4", loss: 0, mistake: false });
    });

    it("eases off when winning: the move nearest its target, within its allowance", () => {
        const choice = pickTutorMove(
            [
                { uci: "a", win: 90 },
                { uci: "b", win: 75 },
                { uci: "c", win: 64 },
                { uci: "d", win: 40 }, // gives away too much
            ],
            level,
            NEVER,
        )!;
        expect(choice.uci).toBe("b");
        expect(choice.mistake).toBe(false);
    });

    it("sometimes plays a believable mistake, never a collapse", () => {
        const candidates = [
            { uci: "best", win: 60 },
            { uci: "slip", win: 45 }, // loses 15: a mistake to punish
            { uci: "collapse", win: 5 }, // loses 55: never chosen
        ];
        const choice = pickTutorMove(candidates, level, sequence(0.01, 0))!;
        expect(choice).toEqual({ uci: "slip", loss: 15, mistake: true });
        // without the dice saying so, the best move
        expect(pickTutorMove(candidates, level, NEVER)!.uci).toBe("best");
    });

    it("has nothing to play without candidates", () => {
        expect(pickTutorMove([], level)).toBeUndefined();
    });
});

describe("shouldAsk", () => {
    it("asks according to how chatty the tutor is", () => {
        expect(shouldAsk(60, 40, "normal")).toBe(true); // -20
        expect(shouldAsk(60, 50, "normal")).toBe(false); // -10
        expect(shouldAsk(60, 50, "chatty")).toBe(true);
        expect(shouldAsk(60, 40, "quiet")).toBe(false);
        expect(shouldAsk(60, 30, "quiet")).toBe(true);
        // the best move is never questioned, even in a lost position
        expect(shouldAsk(60, 20, "chatty", true)).toBe(false);
    });
});

describe("standsOut", () => {
    it("finds a move much better than the rest", () => {
        expect(
            standsOut([
                { uci: "g5f7", win: 85 },
                { uci: "d2d3", win: 52 },
            ])?.uci,
        ).toBe("g5f7");
        // several good moves: nothing special to find
        expect(
            standsOut([
                { uci: "a", win: 85 },
                { uci: "b", win: 80 },
            ]),
        ).toBeUndefined();
        // the best is not good enough to matter
        expect(standsOut([{ uci: "a", win: 55 }])).toBeUndefined();
    });
});

describe("hintSteps", () => {
    it("names the piece, then where it goes", () => {
        const fen =
            "r1bqkb1r/1ppp1ppp/p1n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R w KQkq - 0 5";
        expect(hintSteps(fen, "g5f7")).toEqual([
            "Look at the knight on g5.",
            "The knight on g5 goes to f7.",
        ]);
        expect(hintSteps(fen, "d2d4")[0]).toBe("Look at the pawn on d2.");
        expect(hintSteps("bad fen", "g5f7")).toEqual([]);
    });
});
