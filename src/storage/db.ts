import { invoke } from "@tauri-apps/api/core";

export type Puzzle = {

    current_interval: number;
    
    /** Nullable field */
    last_played_date?: string;
    
    base_weight: number;
    
    cached_weight?: number;
    
    weight_cached_at?: string;
};

export type Study = {
    /** Path to the PGN file */
    file_path: string;
    
    /** Marks if it's a puzzle */
    puzzle?: Puzzle;
    
    /** Creation timestamp */
    created_at: string;
};

export async function upsertStudy(study: Study): Promise<Study> {
    return await invoke("upsert_study", {
       study
    });
}

export async function listStudies(): Promise<Study[]> {
    return await invoke("list_studies");
}

export async function listPuzzles(): Promise<Study[]> {
    return await invoke("list_puzzles");
}

export async function initDB() {
    const ret = await invoke("init_db");
    console.log("initDB", ret);
}

export async function updatePerformanceScore(studyId: string, score: number) {
    return await invoke("update_puzzle", {
        studyId: studyId,
        performanceScore: score
    });  
}

export async function pickPuzzle(): Promise<Study> {
    return await invoke("pick_puzzle");
}

initDB();