import { describe, expect, it } from "vitest";
import { judgeHumanMove } from "./human";

const lines = [
    { pv: ["g8f6", "d2d3"], score: { type: "cp" as const, value: -20 } },
    { pv: ["f8c5", "c2c3"], score: { type: "cp" as const, value: -10 } },
    { pv: ["c6d4", "f3e5"], score: { type: "cp" as const, value: 120 } },
];

describe("judgeHumanMove", () => {
    it("recognises the engine's choice", () => {
        expect(judgeHumanMove("g8f6", lines, "black")).toEqual({
            kind: "best",
        });
    });

    it("calls a small loss fine and a big one a trap, for the side to move", () => {
        expect(judgeHumanMove("f8c5", lines, "black")).toEqual({
            kind: "fine",
        });
        const trap = judgeHumanMove("c6d4", lines, "black");
        expect(trap?.kind).toBe("trap");
        expect(trap && "loss" in trap && trap.loss).toBeGreaterThan(10);
    });

    it("says when the engine does not rank the move", () => {
        expect(judgeHumanMove("h7h6", lines, "black")).toEqual({
            kind: "unranked",
        });
    });

    it("needs a scored best line", () => {
        expect(judgeHumanMove("g8f6", [], "black")).toBeUndefined();
        expect(
            judgeHumanMove("g8f6", [{ pv: ["g8f6"] }], "black"),
        ).toBeUndefined();
    });
});
