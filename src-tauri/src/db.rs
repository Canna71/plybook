#![allow(non_snake_case)]

use surrealdb::engine::local::Db;
use surrealdb::engine::local::RocksDb;
use surrealdb::RecordId;
// use surrealdb::RecordId;
use surrealdb::Surreal;
use tauri::State;

use pgnparse::parser::*;
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};
// Wrap database connection in a managed state
pub struct DatabaseConnection(pub Mutex<Option<Surreal<Db>>>);

#[derive(Serialize, Deserialize)]
pub struct Study {
    // id: i32,  // Primary key
    file_path: String,  // Path to the PGN file
    // is_puzzle: bool,  // Marks if it's a puzzle
    puzzle: Option<Puzzle>,  // Nullable field
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Game {
    // id: RecordId,  // Primary key
    study_id: RecordId,  // Foreign key to the study
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

#[derive(Serialize, Deserialize)]
struct Puzzle {
    current_interval: i32,
    last_played_date: Option<String>,  // Nullable field
    base_weight: f64,
    cached_weight: Option<f64>,
    weight_cached_at: Option<String>,
}

#[tauri::command]
// #[tokio::main]
pub async fn init_db(db_state: State<'_, DatabaseConnection>) -> Result<String, String> {
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

    // run this in the background

    update_cached_weignt(db_state).await.unwrap();

    Ok("Database initialized successfully".to_string())
}

async fn update_cached_weignt(db_state: State<'_, DatabaseConnection>) -> Result<(), String> {
    let db = db_state.0.lock().await;
    let db = db.as_ref().ok_or("Database not initialized")?;

    let query = r#"
UPDATE studies

SET puzzle.current_interval = IF performance_score >= 0.8 { current_interval * $ease_factor }
ELSE IF performance_score >= 0.6 { current_interval * 0.5 * $ease_factor }
ELSE { $minimum_interval }
,
puzzle.cached_weight = puzzle.base_weight * math::pow(math::e, duration::days(time::now() - <datetime>(last_played_date OR created_at)) / puzzle.current_interval - 1)
,
puzzle.weight_cached_at = time::now()

WHERE puzzle AND (puzzle.weight_cached_at IS None 
OR puzzle.weight_cached_at < (time::now() - 7d)) ;
"#;

    let ret= db.query(query)
    .bind(("ease_factor", 2.5))
    .bind(("minimum_interval", 1))

        .await
        .map_err(|e| e.to_string())?;
    dbg!(&ret);

    Ok(())
}

// define a string constant for the table name
const GAMES_TABLE: &str = "games";

#[tauri::command]
// #[tokio::main]
pub async fn index_game(db_state: State<'_, DatabaseConnection>, game: Game) -> Result<Game, String> {
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
pub async fn list_games(db_state: State<'_, DatabaseConnection>) -> Result<Vec<Game>, String> {
    let db = db_state.0.lock().await;
    let db = db.as_ref().ok_or("Database not initialized")?;

    let created: Vec<Game> = db.select(GAMES_TABLE).await.map_err(|e| e.to_string())?;

    Ok(created)
}

#[derive(Debug, Deserialize)]
struct Record {
    id: RecordId,
}

#[tauri::command]
// #[tokio::main]
pub async fn upload_pgn(db_state: State<'_, DatabaseConnection>, pgn: String) -> Result<Game, String> {
    let db = db_state.0.lock().await;
    let db = db.as_ref().ok_or("Database not initialized")?;

    println!("Received PGN: {}", pgn);

    let mut parsedPgn = parse_pgn_to_rust_struct(pgn);

    println!("Parsed PGN: {:?}", parsedPgn);

    // first create the study
    let study: Study = Study {
        // id: -1,
        file_path: "todo".to_string(),
        puzzle: None,
        created_at: "todo".to_string(),
    };

    let study:Option<Record> = db
        .create("studies")
        .content(study)
        .await
        .unwrap()
        ;
    let study_id = study.unwrap().id;
    dbg!(&study_id);

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
        study_id: study_id,
        // file: "todo".to_string(),
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

#[tauri::command]
pub async fn insert_study(db_state: State<'_, DatabaseConnection>, study: Study) -> Result<Study, String> {
    let db = db_state.0.lock().await;
    let db = db.as_ref().ok_or("Database not initialized")?;

    // creates a study with the id given by its file path
    let created: Study = db
        .upsert(("studies", &study.file_path))
        .content(study)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Failed to create record")?
        ;
    // dbg!(created);
    Ok(created)
}

// returns all study (service method, to be removed)
#[tauri::command]
pub async fn list_studies(db_state: State<'_, DatabaseConnection>) -> Result<Vec<Study>, String> {
    let db = db_state.0.lock().await;
    let db = db.as_ref().ok_or("Database not initialized")?;

    let studies: Vec<Study> = db.select("studies").await.map_err(|e| e.to_string())?;

    Ok(studies)
}

#[tauri::command]
pub async fn list_puzzles(db_state: State<'_, DatabaseConnection>) -> Result<Vec<Study>, String> {
    let db = db_state.0.lock().await;
    let db = db.as_ref().ok_or("Database not initialized")?;

    let mut result = db.query("SELECT * from studies WHERE puzzle")
    .await
    .map_err(|e| e.to_string())?;

    let studies: Vec<Study> = result.take(0)
    .map_err(|e| e.to_string())?
    ;

    Ok(studies)
}

