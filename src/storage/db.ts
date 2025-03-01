import { invoke } from "@tauri-apps/api/core";
import anylogger from "anylogger";
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

export async function pickPuzzle(): Promise<Study> {
    return await invoke("pick_puzzle");
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
        console.error("Failed to get history games", e);
        return [];
    }
}

(window as any).getHistoryGames = getHistoryGames;

export async function addToHistory(pgn: string): Promise<Game | undefined> {
    try {
        const game = (await invoke("add_to_history", { pgn })) as Game;
        return game;
    } catch (e) {
        console.error("Failed to add game to history", e);
        return undefined;
    }
}

setTimeout(initDB, 10);
