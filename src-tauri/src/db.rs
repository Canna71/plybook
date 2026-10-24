#![allow(non_snake_case)]

use std::string;

use surrealdb::engine::local::Db;
use surrealdb::engine::local::RocksDb;
use surrealdb::RecordId;
// use surrealdb::RecordId;
use surrealdb::Surreal;
use tauri::{AppHandle, Manager, State};

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


/// Opens the puzzle database in the app's local data folder. The process
/// working directory is not writable in an installed app (`/` for a macOS
/// .app launched from Finder, Program Files on Windows), so a relative path
/// only worked under `tauri dev`.
#[tauri::command]
pub async fn init_db(app: AppHandle, db_state: State<'_, DatabaseConnection>) -> Result<String, String> {
    if db_state.0.lock().await.is_some() {
        return Ok("Database already initialized".to_string());
    }

    let db_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Cannot resolve app data folder: {}", e))?
        .join("db");
    std::fs::create_dir_all(&db_dir)
        .map_err(|e| format!("Cannot create database folder {}: {}", db_dir.display(), e))?;

    // Create database connection using RocksDB
    let db = Surreal::new::<RocksDb>(db_dir)
        .await
        .map_err(|e| e.to_string())?;

    // Use the 'test' namespace and database
    db.use_ns("test")
        .use_db("test")
        .await
        .map_err(|e| e.to_string())?;

    // Store the database connection
    *db_state.0.lock().await = Some(db);

    update_cached_weights(db_state).await?;

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

/// History record ids come from the game's Timestamp header without separators.
fn valid_history_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_alphanumeric())
}

async fn history_save(db: &Surreal<Db>, id: &str, pgn: String) -> Result<Game, String> {
    if !valid_history_id(id) {
        return Err(format!("Invalid history id {id:?}"));
    }
    db.upsert((HISTORY_TABLE, id))
        .content(pgn_to_game(pgn))
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Failed to save the game".to_string())
}

async fn history_get(db: &Surreal<Db>, id: &str) -> Result<Option<Game>, String> {
    if !valid_history_id(id) {
        return Err(format!("Invalid history id {id:?}"));
    }
    db.select((HISTORY_TABLE, id)).await.map_err(|e| e.to_string())
}

async fn history_list(db: &Surreal<Db>) -> Result<Vec<Game>, String> {
    db.query("SELECT * FROM type::table($table) ORDER BY eventDate DESC, id DESC")
        .bind(("table", HISTORY_TABLE))
        .await
        .map_err(|e| e.to_string())?
        .take(0)
        .map_err(|e| e.to_string())
}

/// Creates or replaces a played game; the play view saves after every move.
#[tauri::command]
pub async fn save_history_game(
    db_state: State<'_, DatabaseConnection>,
    id: String,
    pgn: String,
) -> Result<Game, String> {
    let db = db_state.0.lock().await;
    let db = db.as_ref().ok_or("Database not initialized")?;
    history_save(db, &id, pgn).await
}

#[tauri::command]
pub async fn get_history_game(
    db_state: State<'_, DatabaseConnection>,
    id: String,
) -> Result<Option<Game>, String> {
    let db = db_state.0.lock().await;
    let db = db.as_ref().ok_or("Database not initialized")?;
    history_get(db, &id).await
}

/// All played games, newest first.
#[tauri::command]
pub async fn list_history(db_state: State<'_, DatabaseConnection>) -> Result<Vec<Game>, String> {
    let db = db_state.0.lock().await;
    let db = db.as_ref().ok_or("Database not initialized")?;
    history_list(db).await
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
/// Picks a puzzle at random, favouring higher weights. With `folder`, only puzzles whose file is
/// inside it (e.g. the Mistakes folder) are considered.
async fn pick_puzzle_in(db: &Surreal<Db>, folder: Option<String>) -> Result<Option<Study>, String> {
    let query = r#"
SELECT (puzzle.cached_weight OR puzzle.base_weight) as weight, id from studies
WHERE puzzle AND ($folder IS NONE OR string::starts_with(file_path, $folder))
"#;
    let weights: Vec<PuzzleWeight> = db
        .query(query)
        .bind(("folder", folder))
        .await
        .map_err(|e| e.to_string())?
        .take(0)
        .map_err(|e| e.to_string())?;

    let selected = weights
        .into_iter()
        .map(|p| (rand::random::<f64>() * p.weight, p.id))
        .max_by(|a, b| a.0.total_cmp(&b.0));
    match selected {
        Some((_, id)) => db.select(id).await.map_err(|e| e.to_string()),
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn pick_puzzle(
    db_state: State<'_, DatabaseConnection>,
    folder: Option<String>,
) -> Result<Option<Study>, String> {
    let db = db_state.0.lock().await;
    let db = db.as_ref().ok_or("Database not initialized")?;
    pick_puzzle_in(db, folder).await
}


#[cfg(test)]
mod tests {
    use super::*;

    const PGN: &str = "[White \"Player\"]\n[Black \"maia-1100\"]\n[Result \"*\"]\n\
        [Date \"2026-10-24\"]\n[TimeControl \"300+5\"]\n\n1. e4 e5 *\n";

    async fn temp_db(name: &str) -> Surreal<Db> {
        let dir = std::env::temp_dir().join(format!(
            "rechess-test-{name}-{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        let db = Surreal::new::<RocksDb>(dir).await.unwrap();
        db.use_ns("test").use_db("test").await.unwrap();
        db
    }

    #[test]
    fn pgn_headers_become_fields() {
        let game = pgn_to_game(PGN.to_string());
        assert_eq!(game.whiteName, "Player");
        assert_eq!(game.blackName, "maia-1100");
        assert_eq!(game.result, "*");
        assert_eq!(game.eventDate, "2026-10-24");
        assert_eq!((game.timeControlInitial, game.timeControlIncrement), (300, 5));
        assert_eq!(game.whiteRating, -1);
    }

    #[test]
    fn history_ids_are_validated() {
        assert!(valid_history_id("20261024T141526208Z"));
        assert!(!valid_history_id(""));
        assert!(!valid_history_id("a:b"));
        assert!(!valid_history_id("history:x"));
    }

    #[tokio::test]
    async fn saving_twice_updates_one_game() {
        let db = temp_db("history").await;
        let id = "20261024T141526208Z";
        history_save(&db, id, PGN.to_string()).await.unwrap();
        let finished = PGN.replace("*", "1-0");
        history_save(&db, id, finished.clone()).await.unwrap();

        let all = history_list(&db).await.unwrap();
        assert_eq!(all.len(), 1);
        let game = history_get(&db, id).await.unwrap().unwrap();
        assert_eq!(game.result, "1-0");
        assert_eq!(game.pgn, finished);
        assert!(history_get(&db, "unknown").await.unwrap().is_none());
        assert!(history_save(&db, "bad id", PGN.to_string()).await.is_err());
    }

    #[tokio::test]
    async fn puzzles_can_be_picked_from_a_folder() {
        let db = temp_db("puzzles").await;
        assert!(pick_puzzle_in(&db, None).await.unwrap().is_none());
        for (path, weight) in [("Library/Mistakes/a.pgn", 300.0), ("Library/Other/b.pgn", 500.0)] {
            let _: Option<Study> = db
                .upsert(("studies", path))
                .content(Study {
                    file_path: path.to_string(),
                    puzzle: Some(Puzzle {
                        current_interval: Some(1.0),
                        last_played_date: None,
                        base_weight: weight,
                        cached_weight: None,
                        weight_cached_at: None,
                        performance_score: None,
                    }),
                    created_at: "2026-10-24T00:00:00Z".to_string(),
                })
                .await
                .unwrap();
        }
        for _ in 0..10 {
            let picked = pick_puzzle_in(&db, Some("Library/Mistakes".into())).await.unwrap();
            assert_eq!(picked.unwrap().file_path, "Library/Mistakes/a.pgn");
        }
        let any = pick_puzzle_in(&db, None).await.unwrap().unwrap();
        assert!(any.file_path.starts_with("Library/"));
        assert!(pick_puzzle_in(&db, Some("Library/None".into())).await.unwrap().is_none());
    }

    #[tokio::test]
    async fn history_is_newest_first() {
        let db = temp_db("order").await;
        for (id, date) in [("a1", "2026-10-01"), ("a2", "2026-10-24"), ("a3", "2026-09-30")] {
            history_save(&db, id, PGN.replace("2026-10-24", date)).await.unwrap();
        }
        let dates: Vec<String> = history_list(&db)
            .await
            .unwrap()
            .into_iter()
            .map(|g| g.eventDate)
            .collect();
        assert_eq!(dates, ["2026-10-24", "2026-10-01", "2026-09-30"]);
    }
}
