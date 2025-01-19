#![allow(non_snake_case)]
// use tauri::Manager;   
mod db;
// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// https://surrealdb.com/docs/surrealdb/embedding/rust
// use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use db::*;


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
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet, init_db, index_game, list_games, upload_pgn, upsert_study,
            list_studies, list_puzzles, update_puzzle_score, pick_puzzle, 
            update_cached_weights, update_puzzle_base_weight, delete_puzzle, get_study
        ])
        
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
