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

// Mirrors Game in src-tauri/src/db.rs
export type Game = {
    id?: string;
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

export async function listPuzzles(): Promise<Study[]> {
    return await invoke("list_puzzles");
}

export async function initDB() {
    try {
        await invoke("init_db");
    } catch (error) {
        log.error("initDB", error);
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

// History

/**
 * Played games, newest first: `limit` of them (all without) after the first `offset`. Their
 * `pgn` is empty: `getHistoryGame` reads a game's.
 */
export async function getHistoryGames(
    limit?: number,
    offset = 0,
): Promise<Game[]> {
    try {
        return await invoke<Game[]>("list_history", { limit, offset });
    } catch (e) {
        log.error("Failed to get history games", e);
        return [];
    }
}

/** Deletes a played game. */
export async function deleteHistoryGame(id: string): Promise<void> {
    await invoke<boolean>("delete_history_game", { id });
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
