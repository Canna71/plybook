//! The app database, SQLite in `<AppLocalData>/plybook.sqlite`: puzzles (spaced repetition over
//! Library files) and games played against the engine. The JSON shapes are the ones the
//! frontend used with the former SurrealDB database.

use chrono::{DateTime, Utc};
use pgnparse::parser::*;
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

#[derive(Default)]
pub struct Database(pub Mutex<Option<Connection>>);

/// Named rechess.sqlite before the rename to Plybook; migrate.rs renames an old one (F.18)
pub(crate) const DB_FILE: &str = "plybook.sqlite";
/// Written by tools/surreal-export from the old SurrealDB database; imported once.
const SURREAL_EXPORT: &str = "surreal-export.json";

/// Schema steps; `PRAGMA user_version` counts the ones applied. Append, never edit.
const SCHEMA: &[&str] = &[
    r#"
CREATE TABLE puzzles (
    file_path TEXT PRIMARY KEY,
    base_weight REAL NOT NULL,
    performance_score REAL,
    last_played TEXT,
    created_at TEXT NOT NULL
);
CREATE TABLE history (
    id TEXT PRIMARY KEY,
    pgn TEXT NOT NULL,
    white TEXT NOT NULL,
    black TEXT NOT NULL,
    white_elo INTEGER NOT NULL,
    black_elo INTEGER NOT NULL,
    result TEXT NOT NULL,
    date TEXT NOT NULL,
    round INTEGER NOT NULL,
    time_control_initial INTEGER NOT NULL,
    time_control_increment INTEGER NOT NULL
);
"#,
    r#"
CREATE TABLE databases (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    source TEXT NOT NULL,
    imported_at TEXT NOT NULL,
    game_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE games (
    id INTEGER PRIMARY KEY,
    database_id INTEGER NOT NULL,
    white TEXT NOT NULL,
    black TEXT NOT NULL,
    white_elo INTEGER,
    black_elo INTEGER,
    result TEXT NOT NULL,
    date TEXT NOT NULL,
    event TEXT NOT NULL,
    site TEXT NOT NULL,
    eco TEXT NOT NULL,
    opening TEXT NOT NULL,
    plies INTEGER NOT NULL,
    pgn TEXT NOT NULL
);
CREATE INDEX games_database ON games (database_id);
CREATE INDEX games_white ON games (white COLLATE NOCASE);
CREATE INDEX games_black ON games (black COLLATE NOCASE);
CREATE INDEX games_eco ON games (eco);
CREATE INDEX games_date ON games (date);
-- the opening positions of every game (see games.rs); database_id makes deleting cheap
CREATE TABLE positions (
    hash INTEGER NOT NULL,
    game_id INTEGER NOT NULL,
    database_id INTEGER NOT NULL,
    ply INTEGER NOT NULL,
    next_move TEXT
);
CREATE INDEX positions_hash ON positions (hash);
"#,
    r#"
CREATE TABLE lichess_puzzles (
    id TEXT PRIMARY KEY,
    fen TEXT NOT NULL,
    moves TEXT NOT NULL,
    rating INTEGER NOT NULL,
    popularity INTEGER NOT NULL,
    plays INTEGER NOT NULL,
    themes TEXT NOT NULL,
    game_url TEXT NOT NULL,
    opening TEXT NOT NULL
);
CREATE INDEX lichess_puzzles_rating ON lichess_puzzles (rating);
CREATE TABLE puzzle_attempts (
    puzzle_id TEXT NOT NULL,
    solved INTEGER NOT NULL,
    at TEXT NOT NULL,
    rating_after REAL NOT NULL
);
CREATE INDEX puzzle_attempts_puzzle ON puzzle_attempts (puzzle_id);
"#,
    r#"
CREATE TABLE repertoires (
    file_path TEXT PRIMARY KEY,
    side TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE repertoire_cards (
    file_path TEXT NOT NULL,
    fen TEXT NOT NULL,
    box INTEGER NOT NULL,
    due TEXT NOT NULL,
    reviews INTEGER NOT NULL,
    lapses INTEGER NOT NULL,
    PRIMARY KEY (file_path, fen)
);
"#,
];

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct Puzzle {
    /// Sent by the frontend when creating a puzzle; not used by the scheduler.
    #[serde(default)]
    current_interval: Option<f64>,
    last_played_date: Option<String>,
    base_weight: f64,
    performance_score: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct Study {
    /// Path to the PGN file, relative to AppLocalData
    file_path: String,
    puzzle: Option<Puzzle>,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Game {
    id: Option<String>,
    pgn: String,
    time_control_initial: i64,
    time_control_increment: i64,
    result: String,
    white_name: String,
    white_rating: i64,
    black_name: String,
    black_rating: i64,
    event_date: String,
    round: i64,
}

/// Where the database lives; game imports open their own connection to it.
pub fn db_path<R: tauri::Runtime>(app: &AppHandle<R>) -> Result<std::path::PathBuf, String> {
    Ok(app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Cannot resolve app data folder: {e}"))?
        .join(DB_FILE))
}

fn open(path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    // a game import writes from its own connection
    conn.busy_timeout(std::time::Duration::from_secs(10))?;
    migrate(&conn)?;
    Ok(conn)
}

pub(crate) fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    let applied: usize = conn.pragma_query_value(None, "user_version", |r| r.get(0))?;
    for (step, sql) in SCHEMA.iter().enumerate().skip(applied) {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(sql)?;
        tx.pragma_update(None, "user_version", step + 1)?;
        tx.commit()?;
    }
    Ok(())
}

pub(crate) fn with_db<T>(
    db: &State<'_, Database>,
    f: impl FnOnce(&Connection) -> Result<T, String>,
) -> Result<T, String> {
    let guard = db.0.lock().map_err(|e| e.to_string())?;
    f(guard.as_ref().ok_or("Database not initialized")?)
}

fn now() -> String {
    Utc::now().to_rfc3339()
}

/// Opens the database in the app's local data folder (an installed app's working directory
/// is not writable) and imports the SurrealDB export if there is one.
#[tauri::command]
pub async fn init_db(app: AppHandle, db: State<'_, Database>) -> Result<String, String> {
    let mut guard = db.0.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        return Ok("Database already initialized".to_string());
    }
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Cannot resolve app data folder: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Cannot create {}: {e}", dir.display()))?;
    let conn = open(&dir.join(DB_FILE)).map_err(|e| e.to_string())?;

    let export = dir.join(SURREAL_EXPORT);
    if export.exists() {
        let (puzzles, games) = import_surreal_export(&conn, &export)?;
        println!("Imported {puzzles} puzzles and {games} played games from the SurrealDB export");
        std::fs::rename(&export, dir.join("surreal-export.imported.json"))
            .map_err(|e| e.to_string())?;
    }
    *guard = Some(conn);
    Ok("Database initialized successfully".to_string())
}

fn import_surreal_export(conn: &Connection, path: &Path) -> Result<(usize, usize), String> {
    let text = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    let data: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let mut puzzles = 0;
    for p in data["puzzles"].as_array().into_iter().flatten() {
        let (Some(file_path), Some(base_weight)) =
            (p["file_path"].as_str(), p["base_weight"].as_f64())
        else {
            continue;
        };
        puzzles += tx
            .execute(
                "INSERT OR IGNORE INTO puzzles
                 (file_path, base_weight, performance_score, last_played, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    file_path,
                    base_weight,
                    p["performance_score"].as_f64(),
                    p["last_played"].as_str(),
                    p["created_at"].as_str().map_or_else(now, str::to_string),
                ],
            )
            .map_err(|e| e.to_string())?;
    }
    let mut games = 0;
    for g in data["history"].as_array().into_iter().flatten() {
        if let (Some(id), Some(pgn)) = (g["id"].as_str(), g["pgn"].as_str()) {
            if valid_history_id(id) {
                history_save(&tx, id, pgn.to_string())?;
                games += 1;
            }
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok((puzzles, games))
}

// #region puzzles

/// How much a puzzle is due: its base weight, growing by one each day since it was last played
/// (or created), divided by how well it went last time (unplayed puzzles count as failed).
fn puzzle_weight(
    base_weight: f64,
    performance_score: Option<f64>,
    since: &str,
    now: DateTime<Utc>,
) -> f64 {
    let days = DateTime::parse_from_rfc3339(since)
        .map(|t| (now - t.with_timezone(&Utc)).num_seconds() as f64 / 86_400.0)
        .unwrap_or(0.0)
        .max(0.0);
    base_weight * (1.0 + days) / (0.1 + performance_score.unwrap_or(0.0).max(0.0))
}

fn study_from_row(row: &Row) -> rusqlite::Result<Study> {
    Ok(Study {
        file_path: row.get("file_path")?,
        created_at: row.get("created_at")?,
        puzzle: Some(Puzzle {
            current_interval: None,
            last_played_date: row.get("last_played")?,
            base_weight: row.get("base_weight")?,
            performance_score: row.get("performance_score")?,
        }),
    })
}

/// Puzzles with their current weight, optionally only those inside `folder`.
fn weighted_puzzles(conn: &Connection, folder: Option<&str>) -> Result<Vec<(f64, Study)>, String> {
    // a folder matches whole folder names only: "Mistakes" is not "Mistakes_old"
    let folder = folder.map(|f| f.trim_end_matches(['/', '\\']));
    let mut stmt = conn
        .prepare(
            "SELECT * FROM puzzles WHERE ?1 IS NULL
             OR substr(file_path, 1, length(?1) + 1) IN (?1 || '/', ?1 || '\\')",
        )
        .map_err(|e| e.to_string())?;
    let studies = stmt
        .query_map([folder], study_from_row)
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())?;
    let now = Utc::now();
    Ok(studies
        .into_iter()
        .map(|s| {
            let p = s.puzzle.as_ref().unwrap();
            let since = p.last_played_date.as_deref().unwrap_or(&s.created_at);
            (
                puzzle_weight(p.base_weight, p.performance_score, since, now),
                s,
            )
        })
        .collect())
}

fn pick_puzzle_in(conn: &Connection, folder: Option<&str>) -> Result<Option<Study>, String> {
    Ok(weighted_puzzles(conn, folder)?
        .into_iter()
        .map(|(weight, s)| (rand::random::<f64>() * weight, s))
        .max_by(|a, b| a.0.total_cmp(&b.0))
        .map(|(_, s)| s))
}

/// Creates or updates a puzzle; a study without puzzle data removes it.
#[tauri::command]
pub async fn upsert_study(db: State<'_, Database>, study: Study) -> Result<Study, String> {
    with_db(&db, |conn| {
        match &study.puzzle {
            Some(p) => conn.execute(
                "INSERT INTO puzzles (file_path, base_weight, performance_score, last_played, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(file_path) DO UPDATE SET base_weight = excluded.base_weight",
                params![study.file_path, p.base_weight, p.performance_score, p.last_played_date, study.created_at],
            ),
            None => conn.execute("DELETE FROM puzzles WHERE file_path = ?1", [&study.file_path]),
        }
        .map_err(|e| e.to_string())?;
        Ok(study)
    })
}

/// Puzzles, most due first.
#[tauri::command]
pub async fn list_puzzles(
    db: State<'_, Database>,
    limit: Option<usize>,
) -> Result<Vec<Study>, String> {
    with_db(&db, |conn| {
        let mut puzzles = weighted_puzzles(conn, None)?;
        puzzles.sort_by(|a, b| b.0.total_cmp(&a.0));
        Ok(puzzles
            .into_iter()
            .take(limit.unwrap_or(100))
            .map(|(_, s)| s)
            .collect())
    })
}

#[tauri::command]
pub async fn update_puzzle_score(
    db: State<'_, Database>,
    study_id: String,
    performance_score: f64,
) -> Result<(), String> {
    with_db(&db, |conn| {
        conn.execute(
            "UPDATE puzzles SET performance_score = ?2, last_played = ?3 WHERE file_path = ?1",
            params![study_id, performance_score, now()],
        )
        .map(drop)
        .map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub async fn update_puzzle_base_weight(
    db: State<'_, Database>,
    study_id: String,
    base_weight: f64,
) -> Result<(), String> {
    with_db(&db, |conn| {
        conn.execute(
            "UPDATE puzzles SET base_weight = ?2 WHERE file_path = ?1",
            params![study_id, base_weight],
        )
        .map(drop)
        .map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub async fn delete_puzzle(db: State<'_, Database>, study_id: String) -> Result<(), String> {
    with_db(&db, |conn| {
        conn.execute("DELETE FROM puzzles WHERE file_path = ?1", [study_id])
            .map(drop)
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub async fn get_study(db: State<'_, Database>, study_id: String) -> Result<Study, String> {
    with_db(&db, |conn| {
        conn.query_row(
            "SELECT * FROM puzzles WHERE file_path = ?1",
            [study_id],
            study_from_row,
        )
        .optional()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Study not found".to_string())
    })
}

/// A random puzzle, favouring the most due; with `folder`, only puzzles inside it.
#[tauri::command]
pub async fn pick_puzzle(
    db: State<'_, Database>,
    folder: Option<String>,
) -> Result<Option<Study>, String> {
    with_db(&db, |conn| pick_puzzle_in(conn, folder.as_deref()))
}

// #endregion

// #region history

fn pgn_to_game(id: Option<String>, pgn: String) -> Game {
    let mut parsed = parse_pgn_to_rust_struct(pgn.clone());
    let time_control = parsed.get_header("TimeControl");
    let mut parts = time_control.split('+');
    let number = |text: Option<&str>| text.and_then(|t| t.parse().ok()).unwrap_or(-1);
    let time_control_initial = number(parts.next());
    let time_control_increment = number(parts.next());
    Game {
        id,
        time_control_initial,
        time_control_increment,
        result: parsed.get_header("Result").to_string(),
        white_name: parsed.get_header("White").to_string(),
        white_rating: parsed.get_header("WhiteElo").parse().unwrap_or(-1),
        black_name: parsed.get_header("Black").to_string(),
        black_rating: parsed.get_header("BlackElo").parse().unwrap_or(-1),
        event_date: parsed.get_header("Date").to_string(),
        round: parsed.get_header("Round").parse().unwrap_or(-1),
        pgn,
    }
}

/// History record ids come from the game's Timestamp header without separators.
fn valid_history_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_alphanumeric())
}

fn game_from_row(row: &Row) -> rusqlite::Result<Game> {
    Ok(Game {
        id: row.get("id")?,
        pgn: row.get("pgn")?,
        time_control_initial: row.get("time_control_initial")?,
        time_control_increment: row.get("time_control_increment")?,
        result: row.get("result")?,
        white_name: row.get("white")?,
        white_rating: row.get("white_elo")?,
        black_name: row.get("black")?,
        black_rating: row.get("black_elo")?,
        event_date: row.get("date")?,
        round: row.get("round")?,
    })
}

fn history_save(conn: &Connection, id: &str, pgn: String) -> Result<Game, String> {
    if !valid_history_id(id) {
        return Err(format!("Invalid history id {id:?}"));
    }
    let game = pgn_to_game(Some(id.to_string()), pgn);
    conn.execute(
        "INSERT INTO history (id, pgn, white, black, white_elo, black_elo, result, date, round,
             time_control_initial, time_control_increment)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT(id) DO UPDATE SET pgn = excluded.pgn, white = excluded.white,
             black = excluded.black, white_elo = excluded.white_elo, black_elo = excluded.black_elo,
             result = excluded.result, date = excluded.date, round = excluded.round,
             time_control_initial = excluded.time_control_initial,
             time_control_increment = excluded.time_control_increment",
        params![
            id,
            game.pgn,
            game.white_name,
            game.black_name,
            game.white_rating,
            game.black_rating,
            game.result,
            game.event_date,
            game.round,
            game.time_control_initial,
            game.time_control_increment
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(game)
}

fn history_get(conn: &Connection, id: &str) -> Result<Option<Game>, String> {
    if !valid_history_id(id) {
        return Err(format!("Invalid history id {id:?}"));
    }
    conn.query_row("SELECT * FROM history WHERE id = ?1", [id], game_from_row)
        .optional()
        .map_err(|e| e.to_string())
}

/// A page of played games, newest first, without their PGN (empty): a long history is listed
/// without reading every game, and a game is read when it opens (F.35).
fn history_list(conn: &Connection, limit: Option<u32>, offset: u32) -> Result<Vec<Game>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, '' AS pgn, white, black, white_elo, black_elo, result, date, round,
                 time_control_initial, time_control_increment
             FROM history ORDER BY date DESC, id DESC LIMIT ?1 OFFSET ?2",
        )
        .map_err(|e| e.to_string())?;
    // SQLite reads a negative limit as none
    let limit = limit.map_or(-1, i64::from);
    let games = stmt
        .query_map(params![limit, offset], game_from_row)
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string());
    games
}

/// Deletes a played game; whether there was one.
fn history_delete(conn: &Connection, id: &str) -> Result<bool, String> {
    if !valid_history_id(id) {
        return Err(format!("Invalid history id {id:?}"));
    }
    conn.execute("DELETE FROM history WHERE id = ?1", [id])
        .map(|n| n > 0)
        .map_err(|e| e.to_string())
}

/// Creates or replaces a played game; the play view saves after every move.
#[tauri::command]
pub async fn save_history_game(
    db: State<'_, Database>,
    id: String,
    pgn: String,
) -> Result<Game, String> {
    with_db(&db, |conn| history_save(conn, &id, pgn))
}

#[tauri::command]
pub async fn get_history_game(db: State<'_, Database>, id: String) -> Result<Option<Game>, String> {
    with_db(&db, |conn| history_get(conn, &id))
}

/// Played games, newest first, `limit` of them (all without) after the first `offset`; their
/// `pgn` is empty (`get_history_game` reads it).
#[tauri::command]
pub async fn list_history(
    db: State<'_, Database>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<Vec<Game>, String> {
    with_db(&db, |conn| history_list(conn, limit, offset.unwrap_or(0)))
}

#[tauri::command]
pub async fn delete_history_game(db: State<'_, Database>, id: String) -> Result<bool, String> {
    with_db(&db, |conn| history_delete(conn, &id))
}

// #endregion

#[cfg(test)]
mod tests {
    use super::*;

    const PGN: &str = "[White \"Player\"]\n[Black \"maia-1100\"]\n[Result \"*\"]\n\
        [Date \"2026-10-24\"]\n[TimeControl \"300+5\"]\n\n1. e4 e5 *\n";

    fn memory_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        conn
    }

    fn add_puzzle(conn: &Connection, path: &str, weight: f64) {
        conn.execute(
            "INSERT INTO puzzles (file_path, base_weight, created_at) VALUES (?1, ?2, ?3)",
            params![path, weight, now()],
        )
        .unwrap();
    }

    #[test]
    fn migrations_are_applied_once() {
        let conn = memory_db();
        migrate(&conn).unwrap();
        let version: usize = conn
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .unwrap();
        assert_eq!(version, SCHEMA.len());
    }

    #[test]
    fn pgn_headers_become_fields() {
        let game = pgn_to_game(None, PGN.to_string());
        assert_eq!(game.white_name, "Player");
        assert_eq!(game.black_name, "maia-1100");
        assert_eq!(game.result, "*");
        assert_eq!(game.event_date, "2026-10-24");
        assert_eq!(
            (game.time_control_initial, game.time_control_increment),
            (300, 5)
        );
        assert_eq!(game.white_rating, -1);
    }

    #[test]
    fn games_serialize_as_before() {
        let json = serde_json::to_value(pgn_to_game(Some("x1".into()), PGN.to_string())).unwrap();
        assert_eq!(json["id"], "x1");
        assert_eq!(json["whiteName"], "Player");
        assert_eq!(json["eventDate"], "2026-10-24");
        assert_eq!(json["timeControlInitial"], 300);
    }

    #[test]
    fn history_ids_are_validated() {
        assert!(valid_history_id("20261024T141526208Z"));
        assert!(!valid_history_id(""));
        assert!(!valid_history_id("a:b"));
        assert!(!valid_history_id("history:x"));
    }

    #[test]
    fn saving_twice_updates_one_game() {
        let conn = memory_db();
        let id = "20261024T141526208Z";
        history_save(&conn, id, PGN.to_string()).unwrap();
        let finished = PGN.replace('*', "1-0");
        history_save(&conn, id, finished.clone()).unwrap();

        assert_eq!(history_list(&conn, None, 0).unwrap().len(), 1);
        let game = history_get(&conn, id).unwrap().unwrap();
        assert_eq!(game.result, "1-0");
        assert_eq!(game.pgn, finished);
        assert!(history_get(&conn, "unknown").unwrap().is_none());
        assert!(history_save(&conn, "bad id", PGN.to_string()).is_err());
    }

    #[test]
    fn history_is_newest_first() {
        let conn = memory_db();
        for (id, date) in [
            ("a1", "2026-10-01"),
            ("a2", "2026-10-24"),
            ("a3", "2026-09-30"),
        ] {
            history_save(&conn, id, PGN.replace("2026-10-24", date)).unwrap();
        }
        let dates = |limit, offset| -> Vec<String> {
            history_list(&conn, limit, offset)
                .unwrap()
                .into_iter()
                .map(|g| g.event_date)
                .collect()
        };
        assert_eq!(dates(None, 0), ["2026-10-24", "2026-10-01", "2026-09-30"]);
        // in pages, and without the PGN
        assert_eq!(dates(Some(2), 0), ["2026-10-24", "2026-10-01"]);
        assert_eq!(dates(Some(2), 2), ["2026-09-30"]);
        assert!(history_list(&conn, None, 0)
            .unwrap()
            .iter()
            .all(|g| g.pgn.is_empty()));
    }

    #[test]
    fn history_games_can_be_deleted() {
        let conn = memory_db();
        history_save(&conn, "a1", PGN.to_string()).unwrap();
        history_save(&conn, "a2", PGN.to_string()).unwrap();
        assert!(history_delete(&conn, "a1").unwrap());
        assert!(!history_delete(&conn, "a1").unwrap());
        assert!(history_delete(&conn, "bad id").is_err());
        let left: Vec<_> = history_list(&conn, None, 0)
            .unwrap()
            .into_iter()
            .filter_map(|g| g.id)
            .collect();
        assert_eq!(left, ["a2"]);
    }

    #[test]
    fn puzzle_weight_grows_with_time_and_shrinks_with_success() {
        let now = DateTime::parse_from_rfc3339("2026-10-11T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let ten_days_ago = "2026-10-01T00:00:00Z";
        let today = "2026-10-11T00:00:00Z";
        // unplayed: base / 0.1
        assert!((puzzle_weight(300.0, None, today, now) - 3000.0).abs() < 1e-6);
        // ten days later it is eleven times more due
        assert!((puzzle_weight(300.0, None, ten_days_ago, now) - 33000.0).abs() < 1e-6);
        // solved well (score 0.9): ten times less due than unplayed
        assert!((puzzle_weight(300.0, Some(0.9), today, now) - 300.0).abs() < 1e-6);
        // unreadable dates count as today
        assert!((puzzle_weight(300.0, Some(0.9), "garbage", now) - 300.0).abs() < 1e-6);
    }

    #[test]
    fn puzzles_can_be_picked_from_a_folder() {
        let conn = memory_db();
        assert!(pick_puzzle_in(&conn, None).unwrap().is_none());
        add_puzzle(&conn, "Library/Mistakes/a.pgn", 300.0);
        add_puzzle(&conn, "Library/Other/b.pgn", 500.0);
        add_puzzle(&conn, "Library/Mistakes_old/c.pgn", 500.0);
        add_puzzle(&conn, "Library\\Mistakes\\w.pgn", 1.0); // Windows separators
        for folder in ["Library/Mistakes", "Library/Mistakes/"] {
            for _ in 0..10 {
                let picked = pick_puzzle_in(&conn, Some(folder)).unwrap().unwrap();
                assert_eq!(picked.file_path, "Library/Mistakes/a.pgn", "from {folder}");
            }
        }
        let windows = pick_puzzle_in(&conn, Some("Library\\Mistakes"))
            .unwrap()
            .unwrap();
        assert_eq!(windows.file_path, "Library\\Mistakes\\w.pgn");
        assert!(pick_puzzle_in(&conn, None).unwrap().is_some());
        assert!(pick_puzzle_in(&conn, Some("Library/None"))
            .unwrap()
            .is_none());
        // LIKE wildcards in a folder name are taken literally
        assert!(pick_puzzle_in(&conn, Some("Library/%")).unwrap().is_none());
    }

    #[test]
    fn surreal_export_is_imported() {
        let conn = memory_db();
        let dir = std::env::temp_dir().join(format!("plybook-import-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join(SURREAL_EXPORT);
        std::fs::write(
            &path,
            serde_json::json!({
                "puzzles": [
                    { "file_path": "Library/a.pgn", "created_at": "2026-01-02T03:04:05.000Z",
                      "base_weight": 400, "performance_score": null, "last_played": null },
                    { "file_path": "Library/b.pgn", "created_at": "2026-01-02T03:04:05.000Z",
                      "base_weight": 300, "performance_score": 0.8,
                      "last_played": "2026-10-20T10:00:00.123Z" },
                    { "base_weight": 1 }
                ],
                "history": [
                    { "id": "kleejb36la9p9su23aeq", "pgn": PGN },
                    { "id": "bad:id", "pgn": PGN }
                ]
            })
            .to_string(),
        )
        .unwrap();
        assert_eq!(import_surreal_export(&conn, &path).unwrap(), (2, 1));
        let b = conn
            .query_row(
                "SELECT * FROM puzzles WHERE file_path = 'Library/b.pgn'",
                [],
                study_from_row,
            )
            .unwrap();
        assert_eq!(b.puzzle.unwrap().performance_score, Some(0.8));
        assert_eq!(
            history_get(&conn, "kleejb36la9p9su23aeq")
                .unwrap()
                .unwrap()
                .white_name,
            "Player"
        );
        // importing again changes nothing
        assert_eq!(import_surreal_export(&conn, &path).unwrap(), (0, 1));
        assert_eq!(history_list(&conn, None, 0).unwrap().len(), 1);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
