import { invoke } from "@tauri-apps/api/core";
import { BookMove, bookPlies } from "../models/books";

/** Polyglot books in the Books folder, by file name. */
export const listBooks = () => invoke<string[]>("book_list");

/** Asks for a .bin book and copies it into the Books folder; its name, or undefined. */
export const importBook = async () =>
    (await invoke<string | null>("book_import")) ?? undefined;

export const removeBook = (name: string) =>
    invoke<void>("book_remove", { name });

/** The book's moves in `fen`, heaviest first. */
export const bookMoves = (name: string, fen: string) =>
    invoke<BookMove[]>("book_moves", { name, fen });

/**
 * The moves every book in the Books folder has in a position, for the review's book moves
 * (P1.5). A book that cannot be read counts as having none.
 */
export async function allBooksLookup(): Promise<
    (fen: string) => Promise<BookMove[]>
> {
    const names = await listBooks().catch(() => [] as string[]);
    return async (fen) =>
        (
            await Promise.all(
                names.map((n) => bookMoves(n, fen).catch(() => [])),
            )
        ).flat();
}

/** How many of the game's first moves are in the user's books (models/books.ts bookPlies). */
export const gameBookPlies = async (line: { fen?: string; san?: string }[]) =>
    bookPlies(line, await allBooksLookup());

/** The book the engine plays from when playing against it ("" for none). */
export const ENGINE_BOOK_SETTING = "engine.playing.book";
