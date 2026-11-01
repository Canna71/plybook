import { describe, expect, it } from "vitest";
import { addRecent, ago, greeting, RECENT_MAX, setupSteps } from "./today";

describe("recent files", () => {
    it("puts the file opened first, once, newest first", () => {
        let list = addRecent([], "Library/a.pgn", "game", 1);
        list = addRecent(list, "Library/b.pdf", "book", 2);
        list = addRecent(list, "Library/a.pgn", "game", 3);
        expect(list.map((f) => f.path)).toEqual([
            "Library/a.pgn",
            "Library/b.pdf",
        ]);
        expect(list[0].at).toBe(3);
    });

    it("keeps at most a few", () => {
        let list = addRecent([], "x0", "game", 0);
        for (let i = 1; i < 20; i++) list = addRecent(list, `x${i}`, "game", i);
        expect(list).toHaveLength(RECENT_MAX);
        expect(list[0].path).toBe("x19");
    });
});

describe("words", () => {
    it("greets by the hour", () => {
        expect(greeting(8)).toBe("Good morning");
        expect(greeting(14)).toBe("Good afternoon");
        expect(greeting(21)).toBe("Good evening");
        expect(greeting(2)).toBe("Good night");
    });

    it("says how long ago", () => {
        const now = Date.UTC(2026, 9, 25, 12);
        expect(ago(now - 30_000, now)).toBe("just now");
        expect(ago(now - 15 * 60_000, now)).toBe("15 minutes ago");
        expect(ago(now - 60 * 60_000, now)).toBe("an hour ago");
        expect(ago(now - 26 * 3600_000, now)).toBe("yesterday");
        expect(ago(now - 3 * 86400_000, now)).toBe("3 days ago");
    });
});

describe("setupSteps", () => {
    it("marks what's done", () => {
        const steps = setupSteps({
            engines: 1,
            accounts: 0,
            lichessPuzzles: 0,
            repertoires: 2,
            books: 0,
        });
        expect(steps.filter((s) => s.done).map((s) => s.id)).toEqual([
            "engines",
            "repertoires",
        ]);
        expect(steps[0].label).toBe("Add a chess engine");
    });
});
