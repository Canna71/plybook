import { describe, expect, it } from "vitest";
import { SHORTCUTS, shortcutFor } from "./shortcuts";

describe("shortcutFor", () => {
    it("moves through the game with arrows and vi keys", () => {
        expect(shortcutFor({ key: "ArrowLeft" })).toBe("previous");
        expect(shortcutFor({ key: "ArrowRight" })).toBe("next");
        expect(shortcutFor({ key: "j" })).toBe("next");
        expect(shortcutFor({ key: "K", shiftKey: true })).toBeUndefined();
        expect(shortcutFor({ key: "K" })).toBe("previous"); // Caps Lock
        expect(shortcutFor({ key: "Home" })).toBe("start");
        expect(shortcutFor({ key: "ArrowDown" })).toBe("end");
    });

    it("switches variations with Shift and the vertical arrows", () => {
        expect(shortcutFor({ key: "ArrowUp", shiftKey: true })).toBe(
            "previousVariation",
        );
        expect(shortcutFor({ key: "ArrowDown", shiftKey: true })).toBe(
            "nextVariation",
        );
    });

    it("toggles the board and the engine", () => {
        expect(shortcutFor({ key: "f" })).toBe("flip");
        expect(shortcutFor({ key: "l" })).toBe("engine");
        expect(shortcutFor({ key: "x" })).toBe("threat");
        expect(shortcutFor({ key: " " })).toBe("bestMove");
        expect(shortcutFor({ key: "?", shiftKey: true })).toBe("help");
    });

    it("leaves typing and system shortcuts alone", () => {
        expect(shortcutFor({ key: "f", targetTag: "input" })).toBeUndefined();
        expect(
            shortcutFor({ key: "j", targetTag: "TEXTAREA" }),
        ).toBeUndefined();
        expect(
            shortcutFor({ key: "ArrowLeft", targetEditable: true }),
        ).toBeUndefined();
        expect(shortcutFor({ key: "f", metaKey: true })).toBeUndefined();
        expect(shortcutFor({ key: "l", ctrlKey: true })).toBeUndefined();
        expect(shortcutFor({ key: "q" })).toBeUndefined();
        expect(shortcutFor({ key: " ", targetTag: "BUTTON" })).toBeUndefined();
    });

    it("lists every action once in the help", () => {
        const actions = SHORTCUTS.map((s) => s.action);
        expect(new Set(actions).size).toBe(actions.length);
    });
});
