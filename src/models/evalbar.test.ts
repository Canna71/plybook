import { describe, expect, it } from "vitest";
import { evalBar } from "./evalbar";

describe("evalBar", () => {
    it("is half and half at equality", () => {
        expect(evalBar({ pawns: 0 }, "white")).toEqual({
            white: 50,
            label: "0.0",
            favours: "white",
        });
    });

    it("leans to the side that is better, on the win-probability scale", () => {
        const plus = evalBar({ pawns: 2 }, "white");
        expect(plus.label).toBe("+2.0");
        // Lichess's curve: about 68% at +2 pawns
        expect(plus.white).toBeGreaterThan(65);
        expect(plus.white).toBeLessThan(70);
        const minus = evalBar({ pawns: -1.26 }, "black");
        expect(minus.label).toBe("−1.3");
        expect(minus.favours).toBe("black");
        expect(minus.white).toBeLessThan(50);
    });

    it("shows mates", () => {
        expect(evalBar({ mate: 3 }, "white").label).toBe("M3");
        expect(evalBar({ mate: -2 }, "white").label).toBe("−M2");
        expect(evalBar({ mate: -2 }, "white").white).toBeLessThan(5);
        // mate 0: the side to move is checkmated
        expect(evalBar({ mate: 0 }, "black").label).toBe("1-0");
        expect(evalBar({ mate: 0 }, "black").white).toBeGreaterThan(95);
    });
});
