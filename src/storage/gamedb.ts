import { Channel, invoke } from "@tauri-apps/api/core";

// Mirrors the types in src-tauri/src/games.rs

export type DatabaseInfo = {
    id: number;
    name: string;
    source: string;
    importedAt: string;
    gameCount: number;
};

export type GameRow = {
    id: number;
    databaseId: number;
    white: string;
    black: string;
    whiteElo?: number;
    blackElo?: number;
    result: string;
    date: string;
    event: string;
    eco: string;
    opening: string;
    plies: number;
};

export type GameQuery = {
    databaseId?: number;
    /** Either colour, case-insensitive substring */
    player?: string;
    white?: string;
    black?: string;
    /** Prefix, e.g. "B9" */
    eco?: string;
    result?: string;
    minElo?: number;
    /** Games that reached this position in their first 30 plies */
    fen?: string;
    offset?: number;
    limit?: number;
};

export type ImportProgress = {
    games: number;
    skipped: number;
    bytes: number;
    totalBytes: number;
};

type ImportEvent = { event: "progress"; data: ImportProgress };

export const listDatabases = () => invoke<DatabaseInfo[]>("gamedb_list");

export const deleteDatabase = (id: number) =>
    invoke<void>("gamedb_delete", { id });

export const searchGames = (query: GameQuery) =>
    invoke<{ total: number; games: GameRow[] }>("gamedb_search", { query });

export const getDatabaseGame = (id: number) =>
    invoke<string>("gamedb_game", { id });

/** Asks for a .pgn or .pgn.zst file and imports it; undefined if cancelled. */
export async function importDatabase(
    onProgress: (progress: ImportProgress) => void,
): Promise<DatabaseInfo | undefined> {
    const onEvent = new Channel<ImportEvent>();
    onEvent.onmessage = (message) => {
        if (message.event === "progress") onProgress(message.data);
    };
    return (
        (await invoke<DatabaseInfo | null>("gamedb_import", { onEvent })) ??
        undefined
    );
}
