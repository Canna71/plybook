import { beforeEach, describe, expect, it, vi } from "vitest";

const files = vi.hoisted(() => new Map<string, string>());
const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/path", () => ({
    join: async (...parts: string[]) => parts.join("/"),
    sep: () => "/",
    appConfigDir: async () => "/config",
    appLocalDataDir: async () => "/data",
}));
vi.mock("@tauri-apps/plugin-fs", () => ({
    BaseDirectory: { AppLocalData: 1, AppConfig: 2 },
    mkdir: vi.fn(),
    exists: async (path: string) => files.has(path),
    writeFile: async (path: string, data: Uint8Array) => {
        files.set(path, new TextDecoder().decode(data));
    },
}));

const { saveMistakePuzzles } = await import("./mistakes");

const puzzle = (name: string, weight = 300) => ({
    name,
    pgn: `[Event "${name}"]\n\n*\n`,
    weight,
});

describe("saveMistakePuzzles", () => {
    beforeEach(() => {
        files.clear();
        invoke.mockReset();
        invoke.mockResolvedValue({});
    });

    it("writes each puzzle to Library/Mistakes and registers it", async () => {
        const result = await saveMistakePuzzles([
            puzzle("a"),
            puzzle("b", 400),
        ]);
        expect(result).toEqual({
            created: ["Library/Mistakes/a.pgn", "Library/Mistakes/b.pgn"],
            skipped: 0,
        });
        expect(files.get("Library/Mistakes/b.pgn")).toContain('[Event "b"]');
        expect(invoke).toHaveBeenCalledWith("upsert_study", {
            study: expect.objectContaining({
                file_path: "Library/Mistakes/b.pgn",
                puzzle: expect.objectContaining({ base_weight: 400 }),
            }),
        });
    });

    it("leaves puzzles that already exist alone", async () => {
        files.set("Library/Mistakes/a.pgn", "my notes");
        const result = await saveMistakePuzzles([puzzle("a"), puzzle("c")]);
        expect(result).toEqual({
            created: ["Library/Mistakes/c.pgn"],
            skipped: 1,
        });
        expect(files.get("Library/Mistakes/a.pgn")).toBe("my notes");
        expect(invoke).toHaveBeenCalledTimes(1);
    });
});
