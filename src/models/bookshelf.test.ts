import { describe, expect, it } from "vitest";
import { bookshelf } from "./bookshelf";

describe("bookshelf", () => {
    const pdfs = [
        { name: "Zurich 1953.pdf", path: "Library/Books/Zurich 1953.pdf" },
        { name: "My System.pdf", path: "Library/My System.pdf" },
        { name: "Endgames.PDF", path: "Library/Books/Old/Endgames.PDF" },
    ];

    it("puts the last opened first, then by title, with page and folder", () => {
        const shelf = bookshelf(
            pdfs,
            "/",
            { "Library/My System.pdf": { page: 40 } },
            { "Library/Books/Old/Endgames.PDF": 7 },
            [{ path: "Library/My System.pdf", kind: "book", at: 100 }],
            new Map(),
        );
        expect(shelf.books.map((b) => b.title)).toEqual([
            "My System",
            "Endgames",
            "Zurich 1953",
        ]);
        expect(shelf.books[0]).toMatchObject({
            page: 40,
            opened: 100,
            folder: "",
        });
        expect(shelf.books[1]).toMatchObject({
            page: 7,
            folder: "Books / Old",
        });
        expect(shelf.books[2].page).toBeUndefined();
    });

    it("matches scanned diagrams to their book, and lists the rest", () => {
        const shelf = bookshelf(
            pdfs,
            "/",
            {},
            {},
            [],
            new Map([
                ["Zurich 1953", 12],
                ["From photos", 3],
            ]),
        );
        expect(
            shelf.books.find((b) => b.title === "Zurich 1953"),
        ).toMatchObject({ diagrams: 12, collection: "Zurich 1953" });
        expect(shelf.books.find((b) => b.title === "My System")).toMatchObject({
            diagrams: 0,
            collection: undefined,
        });
        expect(shelf.collections).toEqual([
            { name: "From photos", diagrams: 3 },
        ]);
    });
});
