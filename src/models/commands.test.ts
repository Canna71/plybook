import { describe, expect, it } from "vitest";
import { rankCommands } from "./commands";

const items = [
    { label: "Puzzles", keywords: "tactics lichess mistakes" },
    { label: "Play the engine", keywords: "game clock" },
    { label: "Library", keywords: "files pgn" },
    { label: "Italian Game.pgn", keywords: "Library/Openings" },
    { label: "Databases", keywords: "search import" },
];
const labels = (q: string) => rankCommands(q, items).map((i) => i.label);

describe("rankCommands", () => {
    it("keeps everything, in order, for an empty query", () => {
        expect(labels("")).toEqual(items.map((i) => i.label));
    });

    it("prefers matches at the start of a word, and in the label", () => {
        expect(labels("pl")[0]).toBe("Play the engine");
        expect(labels("lib")[0]).toBe("Library");
        expect(labels("tactics")).toEqual(["Puzzles"]);
    });

    it("matches every word, letters in order", () => {
        expect(labels("ital game")).toEqual(["Italian Game.pgn"]);
        expect(labels("lbr")).toContain("Library");
        expect(labels("zzz")).toEqual([]);
    });

    it("doesn't match letters scattered across a long name or path", () => {
        const files = [
            {
                label: "file with somewhat a long name.pgn",
                keywords: "Library/New/Deleteme",
            },
            { label: "Test Eval.pgn", keywords: "Library/TestData" },
        ];
        expect(rankCommands("ital", files)).toEqual([]);
    });

    it("finds files by their folder", () => {
        expect(labels("openings")).toEqual(["Italian Game.pgn"]);
    });
});
