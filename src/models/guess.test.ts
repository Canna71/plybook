import { describe, expect, it } from "vitest";
import { makeGame } from "./pgn";
import {
    addCandidate,
    guessTurns,
    judgeTurn,
    MAX_CANDIDATES,
    summary,
} from "./guess";

const GAME = "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4 *";
const cp = (value: number) => ({ type: "cp" as const, value });

describe("guessTurns", () => {
    it("lists one side's turns with the position before", () => {
        const black = guessTurns(makeGame(GAME), "black");
        expect(black.map((t) => t.played.san)).toEqual(["e5", "Nc6", "Nd4"]);
        expect(black[0].fenBefore).toBe(
            "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        );
        expect(
            guessTurns(makeGame(GAME), "white").map((t) => t.played.uci),
        ).toEqual(["e2e4", "g1f3", "f1c4"]);
    });
});

describe("addCandidate", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    it("keeps legal, distinct moves up to the limit", () => {
        let c: string[] = [];
        c = addCandidate(fen, c, "e2e4");
        c = addCandidate(fen, c, "e2e4");
        c = addCandidate(fen, c, "e2e5"); // illegal
        c = addCandidate(fen, c, "d2d4");
        c = addCandidate(fen, c, "g1f3");
        c = addCandidate(fen, c, "c2c4");
        expect(c).toEqual(["e2e4", "d2d4", "g1f3"]);
        expect(c.length).toBe(MAX_CANDIDATES);
    });
});

describe("judgeTurn", () => {
    const [, , nd4] = guessTurns(makeGame(GAME), "black");
    const best = { uci: "g8f6", score: cp(-20) };

    it("credits a candidate as good as the best and names the game move", () => {
        const result = judgeTurn(
            nd4,
            ["f8c5", "h7h6"],
            best,
            new Map([
                ["f8c5", cp(-15)],
                ["h7h6", cp(60)],
                ["c6d4", cp(100)],
            ]),
        );
        expect(result.bestSan).toBe("Nf6");
        expect(result.foundBest).toBe(true); // Bc5 is within the tolerance
        expect(result.foundPlayed).toBe(false);
        expect(result.moves.map((m) => m.san)).toEqual(["Bc5", "h6", "Nd4"]);
        expect(result.moves.find((m) => m.san === "Nd4")).toMatchObject({
            isPlayed: true,
            isCandidate: false,
            isBest: false,
        });
    });

    it("does not credit worse candidates", () => {
        const result = judgeTurn(
            nd4,
            ["c6d4"],
            best,
            new Map([["c6d4", cp(100)]]),
        );
        expect(result.foundBest).toBe(false);
        expect(result.foundPlayed).toBe(true);
        expect(summary([result])).toEqual({
            turns: 1,
            foundBest: 0,
            foundPlayed: 1,
        });
    });
});
