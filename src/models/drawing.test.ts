import { describe, expect, it } from "vitest";
import { isPenColour, shiftColour } from "./drawing";

const keys = (shiftKey: boolean, altKey = false, metaKey = false) => ({
    shiftKey,
    altKey,
    metaKey,
});

describe("shiftColour", () => {
    it("draws only with Shift: a plain press moves pieces", () => {
        expect(shiftColour(keys(false))).toBeUndefined();
        expect(shiftColour(keys(false, true, true))).toBeUndefined();
    });

    it("gives all four colours without the right button", () => {
        expect(shiftColour(keys(true))).toBe("green");
        expect(shiftColour(keys(true, true))).toBe("blue");
        expect(shiftColour(keys(true, false, true))).toBe("red");
        expect(shiftColour(keys(true, true, true))).toBe("yellow");
    });
});

it("isPenColour accepts the four PGN colours only", () => {
    expect(isPenColour("red")).toBe(true);
    expect(isPenColour("black")).toBe(false);
    expect(isPenColour(undefined)).toBe(false);
});
