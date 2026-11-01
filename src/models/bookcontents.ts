// A book's contents for the PDF reader (F.38): the PDF's own outline when it has one, or else
// the headings found in its text by their size, and the reader's own bookmarks. No DOM or
// pdf.js here, for tests.

import { TextItem } from "./booktext";

/** A place to jump to: a chapter, a section or a bookmark. */
export type ContentsEntry = {
    title: string;
    /** From 1 */
    page: number;
    /** 1 for the largest headings (sections), 2 for those below (chapters) */
    level: number;
};

/** Headings are type at least this much larger than the book's body text. */
const HEADING_SCALE = 1.4;
/** A heading size used on fewer pages than this is a title page's, not a heading's. */
const MIN_PAGES = 2;
/** Chapter headings come on at least this share of the pages (and at least 4)... */
const CHAPTER_SHARE = 0.05;
const MIN_CHAPTERS = 4;
/** Runs this close to one baseline (share of the page) are one line. */
const SAME_LINE = 0.006;
const MAX_TITLE = 80;

type Line = { page: number; top: number; size: number; text: string };

/** Words, not a page number or a chess-font symbol read as text (".i.", "l:,") */
const isTitle = (text: string) =>
    (text.match(/\p{L}/gu)?.length ?? 0) >= 3 && text.length <= MAX_TITLE;

/**
 * The headings in a book's text (`pages[0]` is page 1), from lines in type larger than the
 * body text. Chapters (level 2) are the largest such size used on many pages; sections
 * (level 1) any larger size used on more than one page, as an OCR'd book may print them in
 * a few sizes (Collins: 21.8, 18.1 and 17.8 pt, chapters 15.9). The title page's sizes are on
 * one page only. Empty for a book without text (images only) or without larger headings.
 */
export function headingsFromText(pages: TextItem[][]): ContentsEntry[] {
    const heights = pages
        .flat()
        .map((t) => t.y1 - t.y0)
        .sort((a, b) => a - b);
    if (!heights.length) return [];
    const body = heights[Math.floor(heights.length / 2)];

    // lines in large type: a line's size is its longest run's ("Ruy Lopez Part" "1", the 1
    // larger)
    const lines: Line[] = [];
    pages.forEach((items, i) => {
        const large = items
            .filter((t) => t.y1 - t.y0 >= body * HEADING_SCALE)
            .sort((a, b) => a.y1 - b.y1 || a.x0 - b.x0);
        let line: TextItem[] = [];
        const close = () => {
            if (!line.length) return;
            const text = line
                .sort((a, b) => a.x0 - b.x0)
                .map((t) => t.str.trim())
                .join(" ")
                .replace(/\s+/g, " ")
                .trim();
            const longest = line.reduce((a, b) =>
                b.str.trim().length > a.str.trim().length ? b : a,
            );
            lines.push({
                page: i + 1,
                top: Math.min(...line.map((t) => t.y0)),
                // in halves of a thousandth of the page, so that runs of one size compare equal
                size: Math.round((longest.y1 - longest.y0) * 2000),
                text,
            });
            line = [];
        };
        for (const t of large) {
            if (line.length && Math.abs(t.y1 - line[0].y1) > SAME_LINE) close();
            line.push(t);
        }
        close();
    });

    // the sizes headings come in, largest first, with the number of pages each is on
    const pagesBySize = new Map<number, Set<number>>();
    for (const l of lines) {
        if (!isTitle(l.text)) continue;
        if (!pagesBySize.has(l.size)) pagesBySize.set(l.size, new Set());
        pagesBySize.get(l.size)!.add(l.page);
    }
    const sizes = [...pagesBySize]
        .map(([size, p]) => ({ size, pages: p.size }))
        .filter((s) => s.pages >= MIN_PAGES)
        .sort((a, b) => b.size - a.size);
    const many = Math.max(MIN_CHAPTERS, pages.length * CHAPTER_SHARE);
    const chapter = sizes.find((s) => s.pages >= many)?.size;
    const level = (size: number): number | undefined => {
        if (chapter === undefined) {
            // no size is that common: the two largest, as sections and chapters
            const i = sizes.slice(0, 2).findIndex((s) => s.size === size);
            return i < 0 ? undefined : i + 1;
        }
        if (size === chapter) return 2;
        return size > chapter && sizes.some((s) => s.size === size)
            ? 1
            : undefined;
    };

    return lines
        .filter((l) => level(l.size) !== undefined && isTitle(l.text))
        .sort((a, b) => a.page - b.page || a.top - b.top)
        .map((l) => ({
            title: l.text,
            page: l.page,
            level: level(l.size)!,
        }));
}

/** The entry a page is in: the last one starting at or before it. */
export function entryAt(
    entries: ContentsEntry[],
    page: number,
): ContentsEntry | undefined {
    let found: ContentsEntry | undefined;
    for (const e of entries) if (e.page <= page) found = e;
    return found;
}
