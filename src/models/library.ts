// The Library browser (UX overhaul, step 7): what a folder shows and in which order, and the
// search across the whole Library. No DOM or Tauri here, for tests.

/** Folders, PGN files (games and studies) and PDF books; other files are not shown. */
export type EntryKind = "folder" | "games" | "book";

export type LibraryEntry = {
    name: string;
    /** Relative to the app's data folder, as the fs wrappers take it: "Library/Openings/x.pgn" */
    path: string;
    kind: EntryKind;
    /** Last modified (ms since 1970), when known */
    modified?: number;
    /** Bytes, for files */
    size?: number;
};

export type SortKey = "name" | "modified";

export const KIND_LABEL: Record<EntryKind, string> = {
    folder: "Folder",
    games: "Games",
    book: "PDF book",
};

/** What a directory entry is in the Library, or undefined to leave it out. */
export function kindOf(
    name: string,
    isDirectory: boolean,
): EntryKind | undefined {
    if (name.startsWith(".")) return undefined;
    if (isDirectory) return "folder";
    const lower = name.toLowerCase();
    if (lower.endsWith(".pgn")) return "games";
    if (lower.endsWith(".pdf")) return "book";
    return undefined;
}

/** The name without its extension (folders keep theirs: "v1.2" is a name). */
export function displayName(entry: Pick<LibraryEntry, "name" | "kind">) {
    if (entry.kind === "folder") return entry.name;
    const dot = entry.name.lastIndexOf(".");
    return dot > 0 ? entry.name.slice(0, dot) : entry.name;
}

const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
});

/** Folders first, then by name ("Game 2" before "Game 10") or newest first. */
export function sortEntries(
    entries: LibraryEntry[],
    key: SortKey,
): LibraryEntry[] {
    return [...entries].sort((a, b) => {
        const folders =
            Number(b.kind === "folder") - Number(a.kind === "folder");
        if (folders) return folders;
        if (key === "modified") {
            const newer = (b.modified ?? 0) - (a.modified ?? 0);
            if (newer) return newer;
        }
        // without extensions: "04 copy.pgn" before "04 copy 2.pgn"
        return (
            collator.compare(displayName(a), displayName(b)) ||
            collator.compare(a.name, b.name)
        );
    });
}

/** Every word of the query appears in the name (any case, any order). */
export function matchesQuery(name: string, query: string): boolean {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const lower = name.toLowerCase();
    return words.every((w) => lower.includes(w));
}

/** "Library/Openings/Italian.pgn" -> "Openings": where a search result lives. */
export function folderOf(path: string, separator: string): string {
    const parts = path.split(separator).slice(1, -1);
    return parts.join(" / ");
}

/** "820 KB", "12.4 MB" */
export function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${Math.round(kb)} KB`;
    const mb = kb / 1024;
    return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}
