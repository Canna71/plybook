import { invoke } from "@tauri-apps/api/core";
import { BookMove } from "../models/books";

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

/** The book the engine plays from when playing against it ("" for none). */
export const ENGINE_BOOK_SETTING = "engine.playing.book";
