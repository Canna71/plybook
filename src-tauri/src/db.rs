#![allow(non_snake_case)]

use std::string;

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
pub struct PuzzleWeight {
   weight: f64,
   id: RecordId,
}

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
    id: Option<RecordId>,  // Foreign key to the study
    pgn: String,  // PGN string
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
    current_interval: Option<f64>,
    last_played_date: Option<String>,  // Nullable field
    base_weight: f64,
    cached_weight: Option<f64>,
    weight_cached_at: Option<String>,
    performance_score: Option<f64>,
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

    update_cached_weights(db_state).await.unwrap();

    Ok("Database initialized successfully".to_string())
}

#[tauri::command]
pub async fn update_cached_weights(db_state: State<'_, DatabaseConnection>) -> Result<(), String> {
    let db = db_state.0.lock().await;
    let db = db.as_ref().ok_or("Database not initialized")?;

    let query = r#"
UPDATE studies

SET puzzle.current_interval = IF puzzle.performance_score >= 0.8 { puzzle.current_interval * $ease_factor }
ELSE IF puzzle.performance_score >= 0.6 { puzzle.current_interval * 0.5 * $ease_factor }
ELSE { $minimum_interval }
,
puzzle.cached_weight = puzzle.base_weight * (1 + duration::days(time::now() - <datetime>(puzzle.last_played_date OR created_at))) * (1 / (0.1 +puzzle.performance_score))
,
puzzle.weight_cached_at = time::now()

WHERE puzzle AND (puzzle.weight_cached_at IS None 
OR puzzle.weight_cached_at < (time::now() - 1h)) ;
"#;

    let _ret= db.query(query)
    .bind(("ease_factor", 2.5))
    .bind(("minimum_interval", 1))

        .await
        .map_err(|e| e.to_string())?;
    // dbg!(&ret);

    Ok(())
}

// define a string constant for the table name
const GAMES_TABLE: &str = "games";
const HISTORY_TABLE: &str = "history";
const STUDIES_TABLE: &str = "studies";

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

fn pgn_to_game(pgn: String) -> Game {
    let mut parsedPgn = parse_pgn_to_rust_struct(pgn.clone());
    
    let timeControl = parsedPgn.get_header("TimeControl");
    let timeControlParts: Vec<&str> = timeControl.split("+").collect();
    
    Game {
        id: None,
        pgn,
        timeControlInitial: timeControlParts.get(0).unwrap_or(&"").parse().unwrap_or(-1),
        timeControlIncrement: timeControlParts.get(1).unwrap_or(&"").parse().unwrap_or(-1),
        result: parsedPgn.get_header("Result").to_string(),
        whiteName: parsedPgn.get_header("White").to_string(),
        whiteRating: parsedPgn.get_header("WhiteElo").parse().unwrap_or(-1),
        blackName: parsedPgn.get_header("Black").to_string(),
        blackRating: parsedPgn.get_header("BlackElo").parse().unwrap_or(-1),
        eventDate: parsedPgn.get_header("Date").to_string(),
        round: parsedPgn.get_header("Round").parse().unwrap_or(-1),
    }
}

#[tauri::command]
// #[tokio::main]
pub async fn upload_pgn(db_state: State<'_, DatabaseConnection>, pgn: String) -> Result<Game, String> {
    let db = db_state.0.lock().await;
    let db = db.as_ref().ok_or("Database not initialized")?;

    println!("Received PGN: {}", pgn);

    let game = pgn_to_game(pgn);
    

    let created: Game = db
        .create(GAMES_TABLE)
        .content(game)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Failed to create record")?;

    println!("Game: {:?}", created);

    Ok(created)
}

#[tauri::command]
// #[tokio::main]
pub async fn add_to_history(db_state: State<'_, DatabaseConnection>, pgn: String) -> Result<Game, String> {
    let db = db_state.0.lock().await;
    let db = db.as_ref().ok_or("Database not initialized")?;

    println!("Received PGN: {}", pgn);

    let game = pgn_to_game(pgn);
    

    let created: Game = db
        .create(HISTORY_TABLE)
        .content(game)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Failed to create record")?;

    println!("Game: {:?}", created);

    Ok(created)
}

// return all games in the history
#[tauri::command]
pub async fn list_history(db_state: State<'_, DatabaseConnection>) -> Result<Vec<Game>, String> {
    let db = db_state.0.lock().await;
    let db = db.as_ref().ok_or("Database not initialized")?;

    let games: Vec<Game> = db.select(HISTORY_TABLE).await.map_err(|e| e.to_string())?;

    Ok(games)
}


#[tauri::command]
pub async fn upsert_study(db_state: State<'_, DatabaseConnection>, study: Study) -> Result<Study, String> {
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

    let studies: Vec<Study> = db.select(STUDIES_TABLE).await.map_err(|e| e.to_string())?;

    Ok(studies)
}

#[tauri::command]
pub async fn list_puzzles(
    db_state: State<'_, DatabaseConnection>, 
    #[allow(unused_variables)] limit: Option<i32>
) -> Result<Vec<Study>, String> {
    let db = db_state.0.lock().await;
    let db = db.as_ref().ok_or("Database not initialized")?;
    let limit = limit.unwrap_or(100); // Default value of 10 if none provided

    let query = r#"
SELECT *, (puzzle.cached_weight OR puzzle.base_weight) AS weight  from studies WHERE puzzle 
ORDER BY weight desc
LIMIT $limit
"#;

    let mut result = db.query(query)
        .bind(("limit", limit))
        .await
        .map_err(|e| e.to_string())?;

    let studies: Vec<Study> = result.take(0)
        .map_err(|e| e.to_string())?;

    Ok(studies)
}

// update the performance score of a puzzle
#[tauri::command]
pub async fn update_puzzle_score(
    db_state: State<'_, DatabaseConnection>, 
    study_id: String, 
    performance_score: f64
) -> Result<(), String> {
    let db = db_state.0.lock().await;
    let db = db.as_ref().ok_or("Database not initialized")?;

    let query = r#"
UPDATE studies
SET puzzle.performance_score = $performance_score,
puzzle.last_played_date = time::now()
WHERE id = type::thing("studies",  $study_id)
"#;

    let _ret = db.query(query)
        .bind(("performance_score", performance_score))
        .bind(("study_id", study_id
        ))
        .await
        .map_err(|e| e.to_string())?;
    // dbg!(&ret);

    Ok(())
}

#[tauri::command]
pub async fn update_puzzle_base_weight(
    db_state: State<'_, DatabaseConnection>, 
    study_id: String, 
    base_weight: f64
) -> Result<(), String> {
    let db = db_state.0.lock().await;
    let db = db.as_ref().ok_or("Database not initialized")?;

    let query = r#"
UPDATE studies
SET puzzle.base_weight = $base_weight
WHERE id = type::thing("studies",  $study_id)
"#;

    let _ret = db.query(query)
        .bind(("base_weight", base_weight))
        .bind(("study_id", study_id
        ))
        .await
        .map_err(|e| e.to_string())?;
    // dbg!(&ret);

    Ok(())
}

// delete a puzzle from a study
#[tauri::command]
pub async fn delete_puzzle(
    db_state: State<'_, DatabaseConnection>, 
    study_id: String
) -> Result<(), String> {
    let db = db_state.0.lock().await;
    let db = db.as_ref().ok_or("Database not initialized")?;

    let query = r#"
UPDATE studies
UNSET puzzle
WHERE id = type::thing("studies",  $study_id)
"#;

    let _ret = db.query(query)
        .bind(("study_id", study_id
        ))
        .await
        .map_err(|e| e.to_string())?;
    // dbg!(&ret);

    Ok(())
}

// get Study by id
#[tauri::command]
pub async fn get_study(
    db_state: State<'_, DatabaseConnection>, 
    study_id: String
) -> Result<Study, String> {
    let db = db_state.0.lock().await;
    let db = db.as_ref().ok_or("Database not initialized")?;

    let study: Option<Study> = db.select((STUDIES_TABLE,study_id))
        .await
        .map_err(|e| e.to_string())?;
    let ret = study.ok_or("Study not found")?;

    Ok(ret)
}


// fetch all puzzles weights
#[tauri::command]
pub async fn pick_puzzle(
    db_state: State<'_, DatabaseConnection>, 
    limit: Option<i32>
) -> Result<Option<Study>, String> {
    let db = db_state.0.lock().await;
    let db = db.as_ref().ok_or("Database not initialized")?;
    let limit = limit.unwrap_or(100000); // Default value of 10 if none provided

    let query = r#"
SELECT (puzzle.cached_weight OR puzzle.base_weight) as weight, id from studies 

WHERE puzzle
ORDER BY weight desc
LIMIT $limit
"#;

    let mut result = db.query(query)
        .bind(("limit", limit))
        .await
        .map_err(|e| e.to_string())?;

    let res: Vec<PuzzleWeight> = result.take(0)
        .map_err(|e| e.to_string())?;

    let mut selected: Option<PuzzleWeight> = None;

    for puzzle in res.iter() {
        // Create new RNG for each iteration
        let random_value = rand::random::<f64>();
        let score: f64 = random_value * puzzle.weight;
        if selected.is_none() || score > selected.as_ref().unwrap().weight {
            selected = Some(PuzzleWeight {
                weight: score,
                id: puzzle.id.clone(),
            });
        }
    }

    // is selected has value gets corresponding study
    if let Some(puzzle_weight) = selected {
        let id = puzzle_weight.id.clone();
        db.select(id).await.map_err(|e| e.to_string())
    } else {
        return Ok(None);
    }
    
}

