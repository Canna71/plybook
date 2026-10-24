#![allow(non_snake_case)]
// use tauri::Manager;
mod capture;
mod db;
mod engine;
mod games;
mod lichess_puzzles;
mod migrate;
mod net;
// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// use serde::{Deserialize, Serialize};
use capture::*;
use db::*;
use engine::*;
use games::*;
use lichess_puzzles::*;
use net::*;

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
        .manage(Database::default())
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
            greet,
            init_db,
            upsert_study,
            list_puzzles,
            update_puzzle_score,
            pick_puzzle,
            update_puzzle_base_weight,
            delete_puzzle,
            get_study,
            save_history_game,
            get_history_game,
            list_history,
            engine_list,
            engine_save_profile,
            engine_remove_profile,
            engine_pick_executable,
            engine_pick_weights,
            engine_folder,
            engine_open_folder,
            engine_weights,
            engine_spawn,
            engine_write,
            engine_kill,
            open_library_path,
            online_fetch_games,
            online_lichess_game,
            gamedb_list,
            gamedb_delete,
            gamedb_search,
            gamedb_game,
            gamedb_import,
            gamedb_explore,
            lichess_puzzle_stats,
            lichess_puzzle_pick,
            lichess_puzzle_get,
            lichess_puzzle_attempt,
            lichess_puzzle_download,
            lichess_puzzle_import_file,
            scan_capture_screen
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
