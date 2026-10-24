import { describe, expect, it } from "vitest";
import { historyId, historyTitle } from "./history";

describe("historyId", () => {
    it("is the Timestamp header without separators", () => {
        expect(
            historyId(
                '[White "Player"]\n[Timestamp "2026-10-24T14:15:26.208Z"]\n\n1. e4 *',
            ),
        ).toBe("20261024T141526208Z");
    });

    it("is undefined without a Timestamp", () => {
        expect(historyId('[White "Player"]\n\n1. e4 *')).toBeUndefined();
        expect(historyId('[Timestamp ""]\n\n*')).toBeUndefined();
    });

    it("ignores Timestamp text in comments", () => {
        expect(historyId('1. e4 { [Timestamp "x"] } *')).toBeUndefined();
    });
});

it("historyTitle falls back to the colors", () => {
    expect(historyTitle("Player", "maia-1100")).toBe("Player vs maia-1100");
    expect(historyTitle(undefined, "")).toBe("White vs Black");
});
