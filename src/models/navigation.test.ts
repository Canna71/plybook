import { describe, expect, it } from "vitest";
import { activeNavItem, allNavItems, NAVIGATION } from "./navigation";

describe("navigation", () => {
    it("knows which screen a route belongs to", () => {
        expect(activeNavItem("/")?.id).toBe("today");
        expect(activeNavItem("/analysis")?.id).toBe("analysis");
        expect(activeNavItem("/game")?.id).toBe("library");
        expect(activeNavItem("/reader")?.id).toBe("books");
        expect(activeNavItem("/puzzle")?.id).toBe("puzzles");
        expect(activeNavItem("/repertoire")?.id).toBe("repertoires");
        expect(activeNavItem("/scan-book")?.id).toBe("books");
        expect(activeNavItem("/settings")?.id).toBe("settings");
        expect(activeNavItem("/nowhere")).toBeUndefined();
    });

    it("gives a game opened from History to History (F.43)", () => {
        expect(activeNavItem("/game", "?id=x1&source=history")?.id).toBe(
            "history",
        );
        expect(activeNavItem("/game", "?source=pasted")?.id).toBe("library");
        expect(activeNavItem("/history")?.id).toBe("history");
    });

    it("has unique ids and routes, Settings last", () => {
        const items = allNavItems();
        expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
        expect(new Set(items.map((i) => i.route)).size).toBe(items.length);
        expect(items.at(-1)?.id).toBe("settings");
        expect(NAVIGATION.every((g) => g.items.length > 0)).toBe(true);
    });
});
