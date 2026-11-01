import { describe, expect, it } from "vitest";
import {
    engineTimes,
    flagged,
    formatClock,
    parseTimeControl,
    pgnTimeControl,
    pressClock,
    remaining,
    startClock,
    stopClock,
} from "./clock";

const FIVE_THREE = { initial: 300_000, increment: 3_000 };

describe("time controls", () => {
    it("parses minutes+seconds", () => {
        expect(parseTimeControl("5+3")).toEqual(FIVE_THREE);
        expect(parseTimeControl(" 0.5 + 0 ")).toEqual({
            initial: 30_000,
            increment: 0,
        });
        expect(parseTimeControl("")).toBeUndefined();
        expect(parseTimeControl("0+5")).toBeUndefined();
        expect(parseTimeControl("blitz")).toBeUndefined();
    });

    it("writes the PGN tag in seconds", () => {
        expect(pgnTimeControl(FIVE_THREE)).toBe("300+3");
    });
});

describe("the clock", () => {
    it("runs for the side to move only", () => {
        const c = startClock(FIVE_THREE, "white", 0);
        expect(remaining(c, "white", 10_000)).toBe(290_000);
        expect(remaining(c, "black", 10_000)).toBe(300_000);
    });

    it("adds the increment and hands over when pressed", () => {
        let c = startClock(FIVE_THREE, "white", 0);
        c = pressClock(c, 10_000);
        expect(c.running).toBe("black");
        expect(remaining(c, "white", 50_000)).toBe(293_000);
        expect(remaining(c, "black", 50_000)).toBe(260_000);
        c = pressClock(c, 50_000);
        expect(remaining(c, "black", 60_000)).toBe(263_000);
        expect(remaining(c, "white", 60_000)).toBe(283_000);
    });

    it("flags the side whose time runs out", () => {
        const c = startClock({ initial: 1_000, increment: 0 }, "black", 0);
        expect(flagged(c, 999)).toBeUndefined();
        expect(flagged(c, 1_000)).toBe("black");
        expect(remaining(c, "black", 5_000)).toBe(0);
    });

    it("stops", () => {
        const c = stopClock(startClock(FIVE_THREE, "white", 0), 1_000);
        expect(c.running).toBeUndefined();
        expect(remaining(c, "white", 99_000)).toBe(299_000);
        expect(flagged(c, 999_000)).toBeUndefined();
    });

    it("tells the engine both clocks and increments", () => {
        const c = pressClock(startClock(FIVE_THREE, "white", 0), 2_000);
        expect(engineTimes(c, 7_000)).toEqual({
            wtime: 301_000,
            btime: 295_000,
            winc: 3_000,
            binc: 3_000,
        });
    });
});

describe("formatClock", () => {
    it("shows minutes, hours, and tenths when short", () => {
        expect(formatClock(299_400)).toBe("4:59");
        expect(formatClock(3_723_000)).toBe("1:02:03");
        expect(formatClock(9_460)).toBe("9.4");
        expect(formatClock(0)).toBe("0.0");
    });
});
