// The Library on disk, for the Library browser: folder listings with dates, a walk of the
// whole Library for search, and files dropped on the window (copied by Rust, library.rs).

import { invoke } from "@tauri-apps/api/core";
import { sep } from "@tauri-apps/api/path";
import { BaseDirectory, readDir, stat } from "@tauri-apps/plugin-fs";
import { kindOf, LibraryEntry } from "../models/library";

export const LIBRARY_ROOT = "Library";

/** The folder's folders, games and books, with their dates and sizes. */
export async function listFolder(folder: string): Promise<LibraryEntry[]> {
    const items = await readDir(folder, {
        baseDir: BaseDirectory.AppLocalData,
    });
    const entries = items.flatMap((item) => {
        const kind = kindOf(item.name, item.isDirectory);
        return kind
            ? [{ name: item.name, path: `${folder}${sep()}${item.name}`, kind }]
            : [];
    });
    return withInfo(entries);
}

/** The entries with their dates and file sizes, where the file system tells them. */
export function withInfo(entries: LibraryEntry[]): Promise<LibraryEntry[]> {
    return Promise.all(
        entries.map(async (e): Promise<LibraryEntry> => {
            try {
                const info = await stat(e.path, {
                    baseDir: BaseDirectory.AppLocalData,
                });
                return {
                    ...e,
                    modified: info.mtime?.getTime(),
                    size: e.kind === "folder" ? undefined : info.size,
                };
            } catch {
                return e;
            }
        }),
    );
}

/** Every game and book file under `folder`, for search (no dates: names are enough). */
export async function listAllFiles(
    folder = LIBRARY_ROOT,
): Promise<LibraryEntry[]> {
    const items = await readDir(folder, {
        baseDir: BaseDirectory.AppLocalData,
    });
    const nested = await Promise.all(
        items.map(async (item): Promise<LibraryEntry[]> => {
            const kind = kindOf(item.name, item.isDirectory);
            const path = `${folder}${sep()}${item.name}`;
            if (kind === "folder") return listAllFiles(path);
            return kind ? [{ name: item.name, path, kind }] : [];
        }),
    );
    return nested.flat();
}

/** Library/Scanned: each book's folder with how many diagrams (PGN files) it holds. */
export async function listScanned(): Promise<Map<string, number>> {
    const root = `${LIBRARY_ROOT}${sep()}Scanned`;
    const scanned = new Map<string, number>();
    try {
        const folders = await readDir(root, {
            baseDir: BaseDirectory.AppLocalData,
        });
        for (const f of folders.filter((f) => f.isDirectory)) {
            const files = await readDir(`${root}${sep()}${f.name}`, {
                baseDir: BaseDirectory.AppLocalData,
            });
            scanned.set(
                f.name,
                files.filter((x) => kindOf(x.name, false) === "games").length,
            );
        }
    } catch {
        // nothing scanned yet
    }
    return scanned;
}

export type ImportResult = { imported: string[]; skipped: string[] };

/** Copies the files just dropped on the window into a Library folder. */
export const importDropped = (folder: string) =>
    invoke<ImportResult>("library_import_dropped", { folder });
