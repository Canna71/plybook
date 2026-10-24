import { describe, expect, it } from "vitest";
import { parseMoveStat, topMoves } from "./lc0";

describe("parseMoveStat", () => {
    it("reads the move and its policy", () => {
        expect(
            parseMoveStat(
                "g8f6  (159 ) N:       0 (+ 0) (P: 33.01%) (WL:  -.-----) (D: -.---)",
            ),
        ).toEqual({ uci: "g8f6", policy: 33.01 });
        expect(parseMoveStat("e7e8q (1)  N: 0 (+ 0) (P:  0.02%)")).toEqual({
            uci: "e7e8q",
            policy: 0.02,
        });
    });

    it("ignores other lines", () => {
        expect(
            parseMoveStat(
                "node  (  31) N:       1 (+ 0) (P:  0.00%) (WL: -0.07)",
            ),
        ).toBeUndefined();
        expect(parseMoveStat("Found pb network file")).toBeUndefined();
    });
});

it("topMoves keeps the likely ones, always at least one", () => {
    const stats = [
        { uci: "a", policy: 2 },
        { uci: "b", policy: 33 },
        { uci: "c", policy: 21 },
        { uci: "d", policy: 4 },
        { uci: "e", policy: 12 },
    ];
    expect(topMoves(stats).map((s) => s.uci)).toEqual(["b", "c", "e"]);
    expect(topMoves([{ uci: "x", policy: 1 }]).map((s) => s.uci)).toEqual([
        "x",
    ]);
});
