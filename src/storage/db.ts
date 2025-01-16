import { invoke } from "@tauri-apps/api/core";

export type Puzzle = {
    /** Foreign key referencing studies */
    /** Scale of 1-5 */
    difficulty: number;
    
    current_interval: number;
    
    /** Nullable field */
    last_played_date?: string;
    
    base_weight: number;
    
    ease_factor: number;
    
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

export async function insertStudy(study: Study): Promise<Study> {
    return await invoke("insert_study", {
       study
    });
}

export async function listStudies(): Promise<Study[]> {
    return await invoke("list_studies");
}

export async function initDB() {
    const ret = await invoke("init_db");
    console.log("initDB", ret);
}

initDB();