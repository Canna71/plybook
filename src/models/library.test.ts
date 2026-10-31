import { describe, expect, it } from "vitest";
import {
    displayName,
    folderDepth,
    folderLabel,
    folderOf,
    formatSize,
    kindOf,
    LibraryEntry,
    matchesQuery,
    moveTargets,
    sortEntries,
} from "./library";

const entry = (
    name: string,
    kind: LibraryEntry["kind"],
    modified?: number,
): LibraryEntry => ({ name, path: `Library/${name}`, kind, modified });

describe("kindOf", () => {
    it("knows folders, games and books, and hides the rest", () => {
        expect(kindOf("Openings", true)).toBe("folder");
        expect(kindOf("Italian.PGN", false)).toBe("games");
        expect(kindOf("Book.pdf", false)).toBe("book");
        expect(kindOf("notes.txt", false)).toBeUndefined();
        expect(kindOf(".DS_Store", false)).toBeUndefined();
        expect(kindOf(".hidden", true)).toBeUndefined();
    });
});

describe("displayName", () => {
    it("drops a file's extension but not a folder's", () => {
        expect(displayName(entry("Italian.pgn", "games"))).toBe("Italian");
        expect(displayName(entry("v1.2", "folder"))).toBe("v1.2");
        expect(displayName(entry(".pgn", "games"))).toBe(".pgn");
    });
});

describe("sortEntries", () => {
    const list = [
        entry("Game 10.pgn", "games", 3),
        entry("Book.pdf", "book", 5),
        entry("Zeta", "folder", 1),
        entry("Game 2.pgn", "games", 4),
        entry("alpha", "folder", 2),
    ];
    it("puts folders first and sorts names naturally", () => {
        expect(sortEntries(list, "name").map((e) => e.name)).toEqual([
            "alpha",
            "Zeta",
            "Book.pdf",
            "Game 2.pgn",
            "Game 10.pgn",
        ]);
    });
    it("compares names without their extension", () => {
        expect(
            sortEntries(
                [
                    entry("04 copy 2.pgn", "games"),
                    entry("04.pgn", "games"),
                    entry("04 copy.pgn", "games"),
                ],
                "name",
            ).map((e) => e.name),
        ).toEqual(["04.pgn", "04 copy.pgn", "04 copy 2.pgn"]);
    });
    it("sorts by newest first, folders still first", () => {
        expect(sortEntries(list, "modified").map((e) => e.name)).toEqual([
            "alpha",
            "Zeta",
            "Book.pdf",
            "Game 2.pgn",
            "Game 10.pgn",
        ]);
        expect(
            sortEntries(
                [entry("a.pgn", "games", 1), entry("b.pgn", "games", 9)],
                "modified",
            ).map((e) => e.name),
        ).toEqual(["b.pgn", "a.pgn"]);
    });
});

describe("matchesQuery", () => {
    it("needs every word, in any order and case", () => {
        expect(
            matchesQuery("Italian Game - Two Knights.pgn", "knights ital"),
        ).toBe(true);
        expect(matchesQuery("Italian Game.pgn", "italian sicilian")).toBe(
            false,
        );
        expect(matchesQuery("anything", "  ")).toBe(true);
    });
});

describe("folderOf", () => {
    it("shows the folders below the Library root", () => {
        expect(folderOf("Library/Openings/White/a.pgn", "/")).toBe(
            "Openings / White",
        );
        expect(folderOf("Library/a.pgn", "/")).toBe("");
    });
});

describe("formatSize", () => {
    it("uses B, KB and MB", () => {
        expect(formatSize(500)).toBe("500 B");
        expect(formatSize(2048)).toBe("2 KB");
        expect(formatSize(5 * 1024 * 1024)).toBe("5.0 MB");
        expect(formatSize(25 * 1024 * 1024)).toBe("25 MB");
    });
});

describe("moving within the Library", () => {
    const folders = [
        "Library",
        "Library/Openings",
        "Library/Openings/Italian",
        "Library/Openings/Italiana",
        "Library/Pasted",
    ];

    it("labels and indents folders", () => {
        expect(folderLabel("Library/Openings/Italian", "/")).toBe(
            "Library / Openings / Italian",
        );
        expect(folderDepth("Library", "/")).toBe(0);
        expect(folderDepth("Library/Openings/Italian", "/")).toBe(2);
    });

    it("moves a file anywhere but where it is", () => {
        expect(moveTargets("Library/Pasted/game.pgn", folders, "/")).toEqual([
            "Library",
            "Library/Openings",
            "Library/Openings/Italian",
            "Library/Openings/Italiana",
        ]);
    });

    it("moves a folder neither into itself nor into its own folders", () => {
        expect(moveTargets("Library/Openings/Italian", folders, "/")).toEqual([
            "Library",
            "Library/Openings/Italiana",
            "Library/Pasted",
        ]);
    });
});
