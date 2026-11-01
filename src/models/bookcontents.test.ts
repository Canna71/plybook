import { describe, expect, it } from "vitest";
import { entryAt, headingsFromText } from "./bookcontents";
import { TextItem } from "./booktext";

// a run of text: its baseline and type height in shares of the page, as Collins's
const run = (str: string, x0: number, baseline: number, height: number) => ({
    str,
    x0,
    x1: x0 + 0.01 * str.length,
    y0: baseline - height,
    y1: baseline,
});
const BODY = 0.0124;
const SECTION = 0.0335;
const CHAPTER = 0.0245;
const body = (baseline: number) =>
    run("Black has two options:", 0.1, baseline, BODY);
const page = (...extra: TextItem[]) => [
    ...extra,
    ...[0.3, 0.32, 0.34, 0.36, 0.38, 0.4].map(body),
];

describe("headingsFromText", () => {
    it("finds sections and chapters by their size, not the title page", () => {
        const pages = [
            page(run("Understanding the", 0.2, 0.19, 0.048)), // title page
            page(run("Introduction", 0.1, 0.115, SECTION)),
            // a line in two sizes: "Section" "1:" "Open Games"
            page(
                run("Section", 0.1, 0.117, SECTION),
                run("1:", 0.25, 0.117, 0.0275),
                run("Open Games", 0.3, 0.117, SECTION),
            ),
            page(run("Italian Game", 0.1, 0.048, CHAPTER)),
            page(),
            page(run("Giuoco Piano", 0.1, 0.112, CHAPTER)),
            page(
                run("Section", 0.1, 0.115, SECTION),
                run("2:", 0.25, 0.115, 0.0275),
                run("Semi-Open Games", 0.3, 0.115, SECTION),
            ),
            // a chess-font symbol in chapter-size type is not a heading
            page(
                run("Sicilian", 0.1, 0.111, CHAPTER),
                run(".i.", 0.1, 0.5, CHAPTER),
            ),
        ];
        expect(headingsFromText(pages)).toEqual([
            { title: "Introduction", page: 2, level: 1 },
            { title: "Section 1: Open Games", page: 3, level: 1 },
            { title: "Italian Game", page: 4, level: 2 },
            { title: "Giuoco Piano", page: 6, level: 2 },
            { title: "Section 2: Semi-Open Games", page: 7, level: 1 },
            { title: "Sicilian", page: 8, level: 2 },
        ]);
    });

    it("finds nothing in a book of images or of one type size", () => {
        expect(headingsFromText([[], []])).toEqual([]);
        expect(headingsFromText([page(), page(), page()])).toEqual([]);
    });
});

describe("entryAt", () => {
    it("is the last entry starting at or before the page", () => {
        const entries = [
            { title: "A", page: 3, level: 1 },
            { title: "B", page: 7, level: 2 },
        ];
        expect(entryAt(entries, 2)).toBeUndefined();
        expect(entryAt(entries, 6)?.title).toBe("A");
        expect(entryAt(entries, 7)?.title).toBe("B");
    });
});
