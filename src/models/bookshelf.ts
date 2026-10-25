// The Books screen (UX overhaul, step 7b): every PDF in the Library with where you left it, and
// the diagrams scanned from it (Library/Scanned/<book>). No DOM or Tauri here, for tests.
// (Opening books, Polyglot, are models/books.ts.)

import { displayName, folderOf } from "./library";
import { collectionName } from "./scancollection";
import { RecentFile } from "./today";

export type Book = {
    path: string;
    title: string;
    /** The Library folders it is in, "" at the top */
    folder: string;
    /** The page it was left at */
    page?: number;
    /** When it was last opened (ms since 1970), if recently */
    opened?: number;
    /** Diagrams scanned from it (PGN files in its Scanned folder) */
    diagrams: number;
    /** Its Scanned folder's name, when there is one */
    collection?: string;
};

/** A Scanned folder whose PDF is not in the Library (scanned from images, or moved). */
export type Collection = { name: string; diagrams: number };

export type Shelf = { books: Book[]; collections: Collection[] };

export function bookshelf(
    pdfs: { name: string; path: string }[],
    separator: string,
    /** reader.places: the page (and scroll and zoom) by path */
    places: Record<string, { page: number }>,
    /** reader.pages: the page by path, from before `places` */
    pages: Record<string, number>,
    recent: RecentFile[],
    /** PGN files in each Library/Scanned folder, by folder name */
    scanned: Map<string, number>,
): Shelf {
    const opened = new Map(recent.map((r) => [r.path, r.at]));
    const used = new Set<string>();
    const books = pdfs.map((pdf): Book => {
        const collection = collectionName(pdf.name);
        const has = scanned.has(collection);
        if (has) used.add(collection);
        return {
            path: pdf.path,
            title: displayName({ name: pdf.name, kind: "book" }),
            folder: folderOf(pdf.path, separator),
            page: places[pdf.path]?.page ?? pages[pdf.path],
            opened: opened.get(pdf.path),
            diagrams: scanned.get(collection) ?? 0,
            collection: has ? collection : undefined,
        };
    });
    // the last opened first, then the others by title
    books.sort(
        (a, b) =>
            (b.opened ?? 0) - (a.opened ?? 0) ||
            a.title.localeCompare(b.title, undefined, { numeric: true }),
    );
    const collections = [...scanned]
        .filter(([name]) => !used.has(name))
        .map(([name, diagrams]) => ({ name, diagrams }))
        .sort((a, b) => a.name.localeCompare(b.name));
    return { books, collections };
}
