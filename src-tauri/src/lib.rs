#![allow(non_snake_case)]
mod backup;
mod books;
mod capture;
mod db;
mod engine;
mod export;
mod games;
mod library;
mod lichess_puzzles;
mod migrate;
mod model;
mod net;
mod pieces;
mod repertoire;
mod secrets;
mod sites;

use backup::*;
use books::*;
use capture::*;
use db::*;
use engine::*;
use export::*;
use games::*;
use library::*;
use lichess_puzzles::*;
use model::*;
use net::*;
use pieces::*;
use repertoire::*;
use secrets::*;
use sites::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Database::default())
        .manage(EngineProcesses::default())
        .manage(ApprovedExecutables::default())
        .manage(Secrets::default())
        .manage(DroppedFiles::default())
        .on_window_event(library::on_window_event)
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
            library_import_dropped,
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
            scan_capture_screen,
            repertoire_list,
            repertoire_set,
            repertoire_cards,
            repertoire_save_card,
            secret_set,
            secret_delete,
            secret_status,
            open_lichess_token_page,
            model_status,
            model_configure,
            model_forget,
            model_rephrase,
            online_lichess_explorer,
            online_tablebase,
            book_list,
            book_import,
            book_remove,
            book_moves,
            book_build,
            pieces_list,
            pieces_css_of,
            pieces_import,
            pieces_downloadable,
            pieces_download,
            pieces_remove,
            site_open,
            site_is_open,
            site_clipboard,
            export_save,
            backup_create,
            backup_restore,
            backup_auto,
            backup_open_folder,
            open_youtube
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
