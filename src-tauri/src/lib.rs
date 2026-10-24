#![allow(non_snake_case)]
// use tauri::Manager;   
mod db;
mod engine;
mod migrate;
// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// https://surrealdb.com/docs/surrealdb/embedding/rust
// use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use db::*;
use engine::*;


// use add_capability to enable an arbitrary engine to run
// #[tauri::command]
// // #[tokio::main]
// async fn enable_program() -> Result<None> {
//    app.

//     Ok(None)
// }
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .manage(DatabaseConnection(Mutex::new(None)))
        .manage(EngineProcesses::default())
        .manage(ApprovedExecutables::default())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Must run before the puzzle DB or any user file is opened.
            migrate::migrate_legacy_data(app.handle());
            // the webview cannot touch the Engines folder, so it is created here
            ensure_engines_folder(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet, init_db, index_game, list_games, upload_pgn, upsert_study,
            list_studies, list_puzzles, update_puzzle_score, pick_puzzle, 
            update_cached_weights, update_puzzle_base_weight, delete_puzzle, get_study,
            add_to_history, list_history,
            engine_list, engine_save_profile, engine_remove_profile, engine_pick_executable, engine_pick_weights,
            engine_folder, engine_open_folder, engine_weights,
            engine_spawn, engine_write, engine_kill, open_library_path
        ])
        
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
