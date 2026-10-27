import { describe, expect, it } from "vitest";
import { formatDate, round } from "./format";

describe("format", () => {
    it("rounds by exponent, where multiplying would miss", () => {
        expect(round(1.005, 2)).toBe(1.01);
        expect(round(2.4567, 1)).toBe(2.5);
        expect(round(undefined, 2)).toBeUndefined();
    });

    it("shows nothing for a missing date", () => {
        expect(formatDate(undefined)).toBe("");
        expect(formatDate("")).toBe("");
    });
});
