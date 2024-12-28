#![allow(non_snake_case)]
// use tauri::Manager;   

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

use pgnparse::parser::*;
/// https://surrealdb.com/docs/surrealdb/embedding/rust
use serde::{Deserialize, Serialize};
use surrealdb::engine::local::Db;
use surrealdb::engine::local::RocksDb;
// use surrealdb::RecordId;
use surrealdb::Surreal;
use tokio::sync::Mutex;

use tauri::State;

// Wrap database connection in a managed state
struct DatabaseConnection(Mutex<Option<Surreal<Db>>>);

#[derive(Debug, Serialize, Deserialize)]
struct Game {
    file: String,
    timeControlInitial: i16,
    timeControlIncrement: i16,
    // orientation: String,
    result: String,
    whiteName: String,
    whiteRating: i16,
    // whiteTitle: String,
    blackName: String,
    blackRating: i16,
    // blackTitle: String,
    eventDate: String,
    round: i16,
}

#[tauri::command]
// #[tokio::main]
async fn init_db(db_state: State<'_, DatabaseConnection>) -> Result<String, String> {
    // Create database connection using RocksDB
    let db = Surreal::new::<RocksDb>("db")
        .await
        .map_err(|e| e.to_string())?;

    // Use the 'test' namespace and database
    db.use_ns("test")
        .use_db("test")
        .await
        .map_err(|e| e.to_string())?;

    // Store the database connection
    *db_state.0.lock().await = Some(db);

    Ok("Database initialized successfully".to_string())
}

// define a string constant for the table name
const GAMES_TABLE: &str = "games";

#[tauri::command]
// #[tokio::main]
async fn index_game(db_state: State<'_, DatabaseConnection>, game: Game) -> Result<Game, String> {
    let db = db_state.0.lock().await;
    let db = db.as_ref().ok_or("Database not initialized")?;

    let created: Game = db
        .create(GAMES_TABLE)
        .content(game)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Failed to create record")?;

    Ok(created)
}

#[tauri::command]
// #[tokio::main]
async fn list_games(db_state: State<'_, DatabaseConnection>) -> Result<Vec<Game>, String> {
    let db = db_state.0.lock().await;
    let db = db.as_ref().ok_or("Database not initialized")?;

    let created: Vec<Game> = db.select(GAMES_TABLE).await.map_err(|e| e.to_string())?;

    Ok(created)
}

#[tauri::command]
// #[tokio::main]
async fn upload_pgn(db_state: State<'_, DatabaseConnection>, pgn: String) -> Result<Game, String> {
    let _db = db_state.0.lock().await;

    println!("Received PGN: {}", pgn);

    let mut parsedPgn = parse_pgn_to_rust_struct(pgn);

    println!("Parsed PGN: {:?}", parsedPgn);

    let timeControl = parsedPgn.get_header("TimeControl");
    let timeControlParts: Vec<&str> = timeControl.split("+").collect();
    // let orientation = parsedPgn.get_header("FEN");
    let result = parsedPgn.get_header("Result");
    let whiteName = parsedPgn.get_header("White");
    let whiteRating = parsedPgn.get_header("WhiteElo");
    // let whiteTitle = parsedPgn.get_header("WhiteTitle");
    let blackName = parsedPgn.get_header("Black");
    let blackRating = parsedPgn.get_header("BlackElo");
    // let blackTitle = parsedPgn.get_header("BlackTitle");
    let eventDate = parsedPgn.get_header("Date");
    let round = parsedPgn.get_header("Round");

    println!("{:?}", parsedPgn.headers);

    let game: Game = Game {
        file: "todo".to_string(),
        timeControlInitial: timeControlParts.get(0).unwrap_or(&"").parse().unwrap_or(-1),
        timeControlIncrement: timeControlParts.get(1).unwrap_or(&"").parse().unwrap_or(-1),
        // orientation: String::new(),
        result: result.to_string(),
        whiteName: whiteName.to_string(),
        whiteRating: whiteRating.parse().unwrap_or(-1),
        // whiteTitle: whiteTitle.to_string(),
        blackName: blackName.to_string(),
        blackRating: blackRating.parse().unwrap_or(-1),
        // blackTitle: blackTitle.to_string(),
        eventDate: eventDate.to_string(),
        round: round.parse().unwrap_or(-1),
    };

    println!("Game: {:?}", game);

    Ok(game)
}

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
            greet, init_db, index_game, list_games, upload_pgn
        ])
        // .setup(|app| {
        //     let _ = app.add_capability(r#"
        //     {
        //     "$schema": "../gen/schemas/desktop-schema.json",
        //     "identifier": "stockfish",
        //     "description": "Stockfish engine",
        //     "windows": [
        //         "main"
        //     ],
        //     "permissions" : [
           
        //     ]
        // }"#);
            // Ok(())
        // })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
