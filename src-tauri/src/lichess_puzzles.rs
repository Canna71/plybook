//! The Lichess puzzle database (CC0, database.lichess.org): imported into SQLite, picked by
//! theme and rating, with the user's own puzzle rating (Elo) and per-theme results.
//!
//! In the CSV the first move is the opponent's, which sets the puzzle up; the solution follows.

use crate::db::{db_path, with_db, Database};
use crate::net;
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read};
use std::path::Path;
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, Runtime, State};
use tauri_plugin_dialog::DialogExt;

const DEFAULT_RATING: f64 = 1500.0;
const K_FACTOR: f64 = 32.0;
const PROGRESS_EVERY: u64 = 20_000;

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LichessPuzzle {
    id: String,
    fen: String,
    /// UCI moves: the opponent's set-up move, then the solution
    moves: Vec<String>,
    rating: i64,
    themes: Vec<String>,
    game_url: String,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ThemeStats {
    theme: String,
    attempts: i64,
    solved: i64,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PuzzleStats {
    /// Puzzles in the database
    count: i64,
    rating: f64,
    attempts: i64,
    solved: i64,
    /// Themes tried, the weakest (lowest success rate) first
    themes: Vec<ThemeStats>,
}

#[derive(Clone, Serialize)]
#[serde(tag = "phase", rename_all = "camelCase")]
pub enum PuzzleImportEvent {
    Download {
        bytes: u64,
        total: u64,
    },
    #[serde(rename_all = "camelCase")]
    Import {
        puzzles: u64,
        bytes: u64,
        total: u64,
    },
}

fn puzzle_from_row(row: &Row) -> rusqlite::Result<LichessPuzzle> {
    let moves: String = row.get("moves")?;
    let themes: String = row.get("themes")?;
    Ok(LichessPuzzle {
        id: row.get("id")?,
        fen: row.get("fen")?,
        moves: moves.split_whitespace().map(str::to_string).collect(),
        rating: row.get("rating")?,
        themes: themes.split_whitespace().map(str::to_string).collect(),
        game_url: row.get("game_url")?,
    })
}

/// Imports the CSV; puzzles less popular than `min_popularity` (-100..100) are left out.
/// Re-importing updates the puzzles already there. Returns the puzzles imported.
fn import_csv(
    conn: &Connection,
    input: impl Read,
    min_popularity: i64,
    mut progress: impl FnMut(u64),
) -> Result<u64, String> {
    let mut lines = BufReader::new(input).lines();
    let header = lines
        .next()
        .ok_or("The puzzle file is empty")?
        .map_err(|e| e.to_string())?;
    let columns: Vec<&str> = header.trim().split(',').collect();
    let column = |name: &str| {
        columns
            .iter()
            .position(|c| *c == name)
            .ok_or_else(|| format!("Not a Lichess puzzle file: no {name} column"))
    };
    let (id, fen, moves, rating, popularity, plays, themes, url, opening) = (
        column("PuzzleId")?,
        column("FEN")?,
        column("Moves")?,
        column("Rating")?,
        column("Popularity")?,
        column("NbPlays")?,
        column("Themes")?,
        column("GameUrl")?,
        column("OpeningTags")?,
    );
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let mut imported = 0u64;
    {
        let mut insert = tx
            .prepare(
                "INSERT OR REPLACE INTO lichess_puzzles
                 (id, fen, moves, rating, popularity, plays, themes, game_url, opening)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            )
            .map_err(|e| e.to_string())?;
        for line in lines {
            let line = line.map_err(|e| e.to_string())?;
            // no field of this file contains a comma
            let fields: Vec<&str> = line.split(',').collect();
            let field = |i: usize| fields.get(i).copied().unwrap_or("");
            let number = |i: usize| field(i).parse::<i64>().ok();
            let (Some(r), Some(pop)) = (number(rating), number(popularity)) else {
                continue;
            };
            if pop < min_popularity || field(moves).is_empty() {
                continue;
            }
            insert
                .execute(params![
                    field(id),
                    field(fen),
                    field(moves),
                    r,
                    pop,
                    number(plays).unwrap_or(0),
                    field(themes),
                    field(url),
                    field(opening),
                ])
                .map_err(|e| e.to_string())?;
            imported += 1;
            if imported.is_multiple_of(PROGRESS_EVERY) {
                progress(imported);
            }
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    progress(imported);
    Ok(imported)
}

fn user_rating(conn: &Connection) -> Result<f64, String> {
    Ok(conn
        .query_row(
            "SELECT rating_after FROM puzzle_attempts ORDER BY rowid DESC LIMIT 1",
            [],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .unwrap_or(DEFAULT_RATING))
}

/// Elo update of the user's rating against a puzzle's rating.
fn rate(user: f64, puzzle: f64, solved: bool) -> f64 {
    let expected = 1.0 / (1.0 + 10f64.powf((puzzle - user) / 400.0));
    user + K_FACTOR * (if solved { 1.0 } else { 0.0 } - expected)
}

/// A puzzle not tried yet, with `theme` if given, rated within [min, max]. The start of the
/// rating window is random so consecutive picks differ; uses the rating index.
fn pick(
    conn: &Connection,
    theme: Option<&str>,
    min: i64,
    max: i64,
) -> Result<Option<LichessPuzzle>, String> {
    let theme_pattern = theme.filter(|t| !t.is_empty()).map(|t| format!("% {t} %"));
    let query = |from: i64, offset: i64| {
        conn.query_row(
            "SELECT * FROM lichess_puzzles
             WHERE rating >= ?1 AND rating <= ?2
               AND (?3 IS NULL OR ' ' || themes || ' ' LIKE ?3)
               AND id NOT IN (SELECT puzzle_id FROM puzzle_attempts)
             ORDER BY rating LIMIT 1 OFFSET ?4",
            params![from, max, theme_pattern, offset],
            puzzle_from_row,
        )
        .optional()
        .map_err(|e| e.to_string())
    };
    let from = min + (rand::random::<f64>() * (max - min).max(0) as f64) as i64;
    // a random start and a small random skip vary the picks; if that overshoots the
    // matching puzzles, take the first one of the window
    match query(from, rand::random::<u8>() as i64 % 20)? {
        Some(p) => Ok(Some(p)),
        None => query(min, 0),
    }
}

fn stats(conn: &Connection) -> Result<PuzzleStats, String> {
    let count: i64 = conn
        .query_row("SELECT count(*) FROM lichess_puzzles", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT a.solved, p.themes FROM puzzle_attempts a
             JOIN lichess_puzzles p ON p.id = a.puzzle_id",
        )
        .map_err(|e| e.to_string())?;
    let attempts = stmt
        .query_map([], |r| Ok((r.get::<_, bool>(0)?, r.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())?;
    let mut by_theme: HashMap<String, (i64, i64)> = HashMap::new();
    for (solved, themes) in &attempts {
        for theme in themes.split_whitespace() {
            let entry = by_theme.entry(theme.to_string()).or_default();
            entry.0 += 1;
            entry.1 += *solved as i64;
        }
    }
    let mut themes: Vec<ThemeStats> = by_theme
        .into_iter()
        .map(|(theme, (attempts, solved))| ThemeStats {
            theme,
            attempts,
            solved,
        })
        .collect();
    themes.sort_by(|a, b| {
        let rate = |t: &ThemeStats| t.solved as f64 / t.attempts as f64;
        rate(a)
            .total_cmp(&rate(b))
            .then(b.attempts.cmp(&a.attempts))
            .then(a.theme.cmp(&b.theme))
    });
    Ok(PuzzleStats {
        count,
        rating: user_rating(conn)?,
        attempts: attempts.len() as i64,
        solved: attempts.iter().filter(|(s, _)| *s).count() as i64,
        themes,
    })
}

fn record_attempt(conn: &Connection, id: &str, solved: bool) -> Result<f64, String> {
    let puzzle_rating: f64 = conn
        .query_row(
            "SELECT rating FROM lichess_puzzles WHERE id = ?1",
            [id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let rating = rate(user_rating(conn)?, puzzle_rating, solved);
    conn.execute(
        "INSERT INTO puzzle_attempts (puzzle_id, solved, at, rating_after) VALUES (?1, ?2, ?3, ?4)",
        params![id, solved, chrono::Utc::now().to_rfc3339(), rating],
    )
    .map_err(|e| e.to_string())?;
    Ok(rating)
}

// #region commands

#[tauri::command]
pub async fn lichess_puzzle_stats(db: State<'_, Database>) -> Result<PuzzleStats, String> {
    with_db(&db, stats)
}

#[tauri::command]
pub async fn lichess_puzzle_pick(
    db: State<'_, Database>,
    theme: Option<String>,
    min_rating: i64,
    max_rating: i64,
) -> Result<Option<LichessPuzzle>, String> {
    with_db(&db, |conn| {
        pick(conn, theme.as_deref(), min_rating, max_rating)
    })
}

#[tauri::command]
pub async fn lichess_puzzle_get(
    db: State<'_, Database>,
    id: String,
) -> Result<LichessPuzzle, String> {
    with_db(&db, |conn| {
        conn.query_row(
            "SELECT * FROM lichess_puzzles WHERE id = ?1",
            [&id],
            puzzle_from_row,
        )
        .map_err(|_| format!("Puzzle {id} not found"))
    })
}

/// Records the first try at a puzzle and returns the user's new rating.
#[tauri::command]
pub async fn lichess_puzzle_attempt(
    db: State<'_, Database>,
    id: String,
    solved: bool,
) -> Result<f64, String> {
    with_db(&db, |conn| record_attempt(conn, &id, solved))
}

fn import_path(
    db_file: &Path,
    path: &Path,
    min_popularity: i64,
    on_event: &Channel<PuzzleImportEvent>,
) -> Result<u64, String> {
    let conn = Connection::open(db_file).map_err(|e| e.to_string())?;
    conn.busy_timeout(std::time::Duration::from_secs(30))
        .map_err(|e| e.to_string())?;
    let file = std::fs::File::open(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let total = file.metadata().map(|m| m.len()).unwrap_or(0);
    let count = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0));
    let counted = crate::games::Counting::new(file, count.clone());
    let input: Box<dyn Read> = if path.to_string_lossy().ends_with(".zst") {
        Box::new(zstd::Decoder::new(counted).map_err(|e| e.to_string())?)
    } else {
        Box::new(counted)
    };
    import_csv(&conn, input, min_popularity, |puzzles| {
        let _ = on_event.send(PuzzleImportEvent::Import {
            puzzles,
            bytes: count.load(std::sync::atomic::Ordering::Relaxed),
            total,
        });
    })
}

/// Downloads the Lichess puzzle database and imports it; the download is deleted afterwards.
#[tauri::command]
pub async fn lichess_puzzle_download<R: Runtime>(
    app: AppHandle<R>,
    min_popularity: i64,
    on_event: Channel<PuzzleImportEvent>,
) -> Result<u64, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("downloads");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let file = dir.join("lichess_db_puzzle.csv.zst");
    let events = on_event.clone();
    net::download(net::LICHESS_PUZZLES_URL, &file, move |bytes, total| {
        let _ = events.send(PuzzleImportEvent::Download { bytes, total });
    })
    .await?;
    let db_file = db_path(&app)?;
    let imported = tauri::async_runtime::spawn_blocking({
        let file = file.clone();
        move || import_path(&db_file, &file, min_popularity, &on_event)
    })
    .await
    .map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&file);
    imported
}

/// Imports a puzzle CSV (.csv or .csv.zst) picked with the native dialog; None if cancelled.
#[tauri::command]
pub async fn lichess_puzzle_import_file<R: Runtime>(
    app: AppHandle<R>,
    min_popularity: i64,
    on_event: Channel<PuzzleImportEvent>,
) -> Result<Option<u64>, String> {
    let picker = app.clone();
    let picked = tauri::async_runtime::spawn_blocking(move || {
        picker
            .dialog()
            .file()
            .set_title("Import the Lichess puzzle database")
            .add_filter("Lichess puzzles", &["csv", "zst"])
            .blocking_pick_file()
    })
    .await
    .map_err(|e| e.to_string())?;
    let Some(path) = picked.and_then(|p| p.into_path().ok()) else {
        return Ok(None);
    };
    let db_file = db_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        import_path(&db_file, &path, min_popularity, &on_event)
    })
    .await
    .map_err(|e| e.to_string())?
    .map(Some)
}

// #endregion

#[cfg(test)]
mod tests {
    use super::*;

    const CSV: &str = "PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags,DailyDate
00008,r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2R1/PqP2bPP/7K b - - 0 24,f2g3 e6e7 b2b1 b3c1 b1c1 h6c1,1811,76,95,10282,crushing hangingPiece long middlegame,https://lichess.org/787zsVup/black#48,,
0000D,5rk1/1p3ppp/pq3b2/8/8/1P1Q1N2/P4PPP/3R2K1 w - - 2 27,d3d6 f8d8 d6d8 f6d8,1529,74,96,37506,advantage endgame short,https://lichess.org/F8M8OS71#53,,
0000H,r4rk1/pp3ppp/8/2bqp2b/3N4/P2Bn2P/1PPN1P2/R1BQ1RK1 w - - 1 15,d1h5 d5g2,1554,223,100,11,mate mateIn1 middlegame oneMove,https://lichess.org/EwHRkfas#29,French_Defense French_Defense_Tarrasch_Variation,
0000X,8/8/8/8/8/8/8/K6k w - - 0 1,a1a2 h1h2,900,80,20,5,endgame,https://lichess.org/x,,
";

    fn imported() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        crate::db::migrate(&conn).unwrap();
        assert_eq!(import_csv(&conn, CSV.as_bytes(), 50, |_| {}).unwrap(), 3);
        conn
    }

    #[test]
    fn imports_popular_puzzles_by_column_name() {
        let conn = imported();
        let p = conn
            .query_row(
                "SELECT * FROM lichess_puzzles WHERE id = '0000H'",
                [],
                puzzle_from_row,
            )
            .unwrap();
        assert_eq!(p.moves, ["d1h5", "d5g2"]);
        assert_eq!(p.themes, ["mate", "mateIn1", "middlegame", "oneMove"]);
        assert_eq!(p.rating, 1554);
        // re-importing updates in place
        assert_eq!(import_csv(&conn, CSV.as_bytes(), 50, |_| {}).unwrap(), 3);
        assert_eq!(stats(&conn).unwrap().count, 3);
        assert!(import_csv(&conn, "a,b\n1,2\n".as_bytes(), 0, |_| {}).is_err());
    }

    #[test]
    fn picks_by_theme_and_rating_and_skips_tried_puzzles() {
        let conn = imported();
        for _ in 0..10 {
            let p = pick(&conn, Some("mateIn1"), 1000, 2000).unwrap().unwrap();
            assert_eq!(p.id, "0000H");
        }
        // themes match whole words: "mate" is not "mateIn1"'s prefix match
        assert!(pick(&conn, Some("mateIn"), 0, 3000).unwrap().is_none());
        assert!(pick(&conn, None, 1600, 1700).unwrap().is_none());
        assert_eq!(pick(&conn, None, 1800, 1900).unwrap().unwrap().id, "00008");
        record_attempt(&conn, "0000H", true).unwrap();
        assert!(pick(&conn, Some("mateIn1"), 0, 3000).unwrap().is_none());
    }

    #[test]
    fn rating_moves_with_results() {
        assert!((rate(1500.0, 1500.0, true) - 1516.0).abs() < 1e-9);
        assert!((rate(1500.0, 1500.0, false) - 1484.0).abs() < 1e-9);
        // beating a much harder puzzle gains more
        assert!(rate(1500.0, 1900.0, true) - 1500.0 > 25.0);
        let conn = imported();
        assert_eq!(user_rating(&conn).unwrap(), DEFAULT_RATING);
        let after = record_attempt(&conn, "00008", true).unwrap();
        assert!(after > DEFAULT_RATING);
        assert_eq!(user_rating(&conn).unwrap(), after);
    }

    #[test]
    fn stats_list_the_weakest_themes_first() {
        let conn = imported();
        record_attempt(&conn, "00008", false).unwrap(); // crushing hangingPiece long middlegame
        record_attempt(&conn, "0000H", true).unwrap(); // mate mateIn1 middlegame oneMove
        let s = stats(&conn).unwrap();
        assert_eq!((s.attempts, s.solved), (2, 1));
        let first: Vec<&str> = s.themes.iter().take(3).map(|t| t.theme.as_str()).collect();
        assert_eq!(first, ["crushing", "hangingPiece", "long"]);
        let middlegame = s.themes.iter().find(|t| t.theme == "middlegame").unwrap();
        assert_eq!((middlegame.attempts, middlegame.solved), (2, 1));
    }

    /// Import on the real file: PLYBOOK_BENCH_PUZZLES=/path/lichess_db_puzzle.csv.zst
    /// cargo test --release bench_puzzles -- --ignored --nocapture
    #[test]
    #[ignore]
    fn bench_puzzles() {
        let path = std::env::var("PLYBOOK_BENCH_PUZZLES").expect("PLYBOOK_BENCH_PUZZLES");
        for min_popularity in [90, 80, 50, -100] {
            let db_file =
                std::env::temp_dir().join(format!("plybook-puzzles-{min_popularity}.sqlite"));
            let _ = std::fs::remove_file(&db_file);
            let conn = Connection::open(&db_file).unwrap();
            crate::db::migrate(&conn).unwrap();
            let file = std::fs::File::open(&path).unwrap();
            let start = std::time::Instant::now();
            let n = import_csv(
                &conn,
                zstd::Decoder::new(file).unwrap(),
                min_popularity,
                |_| {},
            )
            .unwrap();
            let elapsed = start.elapsed().as_secs_f64();
            let pick_start = std::time::Instant::now();
            for _ in 0..20 {
                pick(&conn, Some("fork"), 1400, 1600).unwrap().unwrap();
            }
            let size = std::fs::metadata(&db_file).unwrap().len();
            eprintln!(
                "popularity >= {min_popularity}: {n} puzzles in {elapsed:.1}s, {:.0} MB, fork pick {:.1} ms",
                size as f64 / 1e6,
                pick_start.elapsed().as_secs_f64() * 1000.0 / 20.0
            );
            drop(conn);
            let _ = std::fs::remove_file(&db_file);
        }
    }
}
