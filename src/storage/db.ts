import { invoke } from "@tauri-apps/api/core";

export type Study = {
    /** Path to the PGN file */
    file_path: string;
    
    /** Marks if it's a puzzle */
    is_puzzle: boolean;
    
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