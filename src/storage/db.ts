import { invoke } from "@tauri-apps/api/core";
import anylogger from "anylogger";
import { historyId } from "../models/history";
import { makeGame } from "../models/pgn";
const log = anylogger("db");

export type Puzzle = {
    current_interval: number;

    /** Nullable field */
    last_played_date?: string;

    base_weight: number;

    cached_weight?: number;

    weight_cached_at?: string;

    performance_score?: number;
};

export type Study = {
    /** Path to the PGN file */
    file_path: string;

    /** Marks if it's a puzzle */
    puzzle?: Puzzle;

    /** Creation timestamp */
    created_at: string;
};

export type Id =
    | { String: string }
    | { Number: number }
    | { Uuid: string }
    | { Array: any[] }
    | { Object: Record<string, any> }
    | { Generate: "Rand" | "Ulid" | "Uuid" }
    | { Range: { start: Id | null; end: Id | null } };

// You could add this helper function to your db.ts file
export function getIdValue(id: Id | undefined): string | undefined {
    if (!id) return undefined;

    if ("Number" in id) return id.Number.toString();
    if ("String" in id) return id.String;
    if ("Uuid" in id) return id.Uuid;
    if ("Array" in id) return JSON.stringify(id.Array);
    if ("Object" in id) return JSON.stringify(id.Object);
    if ("Generate" in id) return `${id.Generate}()`;
    if ("Range" in id) {
        const start = id.Range.start ? getIdValue(id.Range.start) : "*";
        const end = id.Range.end ? getIdValue(id.Range.end) : "*";
        return `${start}..${end}`;
    }

    return undefined;
}

export type RecordId = {
    id: Id;
    tb: string;
};

export type Game = {
    id?: RecordId;
    pgn: string;
    timeControlInitial: number;
    timeControlIncrement: number;
    result: string;
    whiteName: string;
    whiteRating: number;
    blackName: string;
    blackRating: number;
    eventDate: string;
    round: number;
};

export async function upsertStudy(study: Study): Promise<Study> {
    return await invoke("upsert_study", {
        study,
    });
}

export async function listStudies(): Promise<Study[]> {
    return await invoke("list_studies");
}

export async function listPuzzles(): Promise<Study[]> {
    return await invoke("list_puzzles");
}

export async function initDB() {
    try {
        await invoke("init_db");
    } catch (error) {
        if (
            (error as string).includes(
                "The process cannot access the file because it is being used by another process",
            ) ||
            (error as string).includes("lock hold by current process")
        ) {
            log.debug("DB already initialized");
        } else {
            log.warn("initDB", error);
        }
    }
}

export async function updatePerformanceScore(studyId: string, score: number) {
    return await invoke("update_puzzle_score", {
        studyId: studyId,
        performanceScore: score,
    });
}

export async function updateBaseWeight(studyId: string, weight: number) {
    return await invoke("update_puzzle_base_weight", {
        studyId: studyId,
        baseWeight: weight,
    });
}

export async function deletePuzzle(studyId: string) {
    return await invoke("delete_puzzle", {
        studyId: studyId,
    });
}

// get study by id
export async function getStudy(studyId: string): Promise<Study> {
    return await invoke("get_study", {
        studyId: studyId,
    });
}

export async function createPuzzle(studyId: string, baseWeight?: number) {
    return await invoke("upsert_study", {
        study: {
            file_path: studyId,
            puzzle: {
                current_interval: 1,
                base_weight: baseWeight || 300,
            },
            created_at: new Date().toISOString(),
        } as Study,
    });
}

/** A weighted random puzzle, optionally only from one Library folder; undefined if none. */
export async function pickPuzzle(folder?: string): Promise<Study | undefined> {
    return (await invoke<Study | null>("pick_puzzle", { folder })) ?? undefined;
}

export async function updateCachedWeights() {
    return await invoke("update_cached_weights");
}

// History

export async function getHistoryGames(): Promise<Game[]> {
    try {
        const games = (await invoke("list_history")) as Game[];
        log.debug("getHistoryGames", games);
        return games;
    } catch (e) {
        log.error("Failed to get history games", e);
        return [];
    }
}

/**
 * Saves a played game, by default under its Timestamp id (older records have random ids).
 * Games without an id or without moves are skipped.
 */
export async function saveHistoryGame(
    pgn: string,
    id = historyId(pgn),
): Promise<Game | undefined> {
    if (!id || makeGame(pgn).mainline.length === 0) return undefined;
    try {
        return await invoke<Game>("save_history_game", { id, pgn });
    } catch (e) {
        log.error("Failed to save game to history", e);
        return undefined;
    }
}

export async function getHistoryGame(id: string): Promise<Game | undefined> {
    return (await invoke<Game | null>("get_history_game", { id })) ?? undefined;
}
