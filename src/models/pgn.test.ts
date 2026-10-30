import { describe, expect, it } from "vitest";
import { makeComment2, parseComment2 } from "./pgn";

describe("[%eval] comments", () => {
    it("reads the plain form Lichess exports", () => {
        expect(parseComment2("[%eval 0.18] [%clk 0:10:00]").evaluation).toEqual(
            { pawns: 0.18, depth: undefined, ext: undefined },
        );
        expect(parseComment2("[%eval #-7]").evaluation).toMatchObject({
            mate: -7,
        });
    });

    it("reads depth and best move", () => {
        expect(parseComment2("[%eval -1.25,22,e2e4]").evaluation).toEqual({
            pawns: -1.25,
            depth: 22,
            ext: "e2e4",
        });
        expect(parseComment2("[%eval 0.3,20]").evaluation).toEqual({
            pawns: 0.3,
            depth: 20,
            ext: undefined,
        });
    });

    it("round-trips what Plybook writes", () => {
        for (const evaluation of [
            { pawns: 0.5, depth: 18, ext: "g1f3" },
            { pawns: 0, depth: 0 },
            { mate: 3, depth: 30, ext: "d8h4" },
        ]) {
            const comment = makeComment2({ text: "note", evaluation });
            const parsed = parseComment2(comment);
            expect(parsed.text).toBe("note");
            expect(parsed.evaluation).toMatchObject(evaluation);
        }
    });
});
