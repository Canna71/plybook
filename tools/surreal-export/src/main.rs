//! Exports puzzles and played games from the old SurrealDB database (`<AppLocalData>/db`) to
//! `<AppLocalData>/surreal-export.json`, which ReChess imports into SQLite on its next start.
//!
//! Usage: surreal-export <AppLocalData folder>
//! Close ReChess first: RocksDB allows a single process.

use serde_json::{json, Value};
use std::path::PathBuf;
use surrealdb::engine::local::{Db, RocksDb};
use surrealdb::Surreal;

async fn export(db: &Surreal<Db>) -> surrealdb::Result<(Value, i64)> {
    let puzzles: Vec<Value> = db
        .query(
            "SELECT file_path, <string> created_at AS created_at,
                puzzle.base_weight AS base_weight,
                puzzle.performance_score AS performance_score,
                IF puzzle.last_played_date THEN <string> puzzle.last_played_date END AS last_played
             FROM studies WHERE puzzle",
        )
        .await?
        .take(0)?;
    let history: Vec<Value> = db
        .query("SELECT <string> meta::id(id) AS id, pgn FROM history")
        .await?
        .take(0)?;
    // studies without puzzle data carry nothing else worth keeping
    let counts: Vec<Value> = db
        .query("SELECT count() AS count FROM studies GROUP ALL")
        .await?
        .take(0)?;
    let all = counts
        .first()
        .and_then(|c| c["count"].as_i64())
        .unwrap_or(0);
    let skipped = all - puzzles.len() as i64;
    Ok((json!({ "puzzles": puzzles, "history": history }), skipped))
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let data_dir: PathBuf = std::env::args()
        .nth(1)
        .ok_or("usage: surreal-export <AppLocalData folder>")?
        .into();
    let db = Surreal::new::<RocksDb>(data_dir.join("db")).await?;
    db.use_ns("test").use_db("test").await?;

    let (data, skipped) = export(&db).await?;
    if skipped > 0 {
        println!("Skipped {skipped} studies that are not puzzles");
    }
    let out = data_dir.join("surreal-export.json");
    std::fs::write(&out, serde_json::to_string_pretty(&data)?)?;
    println!(
        "Exported {} puzzles and {} played games to {}",
        data["puzzles"].as_array().map_or(0, Vec::len),
        data["history"].as_array().map_or(0, Vec::len),
        out.display()
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn exports_puzzles_as_the_old_app_stored_them() {
        let dir = std::env::temp_dir().join(format!("surreal-export-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let db = Surreal::new::<RocksDb>(dir.clone()).await.unwrap();
        db.use_ns("test").use_db("test").await.unwrap();
        // what upsert_study, update_puzzle_score and delete_puzzle wrote
        db.query(
            r#"
            UPSERT type::thing("studies", "Library/a.pgn") CONTENT {
                file_path: "Library/a.pgn", created_at: "2026-01-02T03:04:05.000Z",
                puzzle: { current_interval: 1, base_weight: 400 } };
            UPSERT type::thing("studies", "Library/b.pgn") CONTENT {
                file_path: "Library/b.pgn", created_at: "2026-01-02T03:04:05.000Z",
                puzzle: { current_interval: 1, base_weight: 300 } };
            UPDATE type::thing("studies", "Library/b.pgn")
                SET puzzle.performance_score = 0.8, puzzle.last_played_date = time::now();
            UPSERT type::thing("studies", "Library/c.pgn") CONTENT {
                file_path: "Library/c.pgn", created_at: "2026-01-02T03:04:05.000Z" };
            CREATE history CONTENT { pgn: "1. e4 *" };
            "#,
        )
        .await
        .unwrap()
        .check()
        .unwrap();

        let (data, skipped) = export(&db).await.unwrap();
        let mut puzzles = data["puzzles"].as_array().unwrap().clone();
        puzzles.sort_by_key(|p| p["file_path"].as_str().unwrap().to_string());
        assert_eq!(puzzles.len(), 2);
        assert_eq!(skipped, 1);
        assert_eq!(puzzles[0]["base_weight"], 400);
        assert!(puzzles[0]["last_played"].is_null());
        assert_eq!(puzzles[1]["performance_score"], 0.8);
        assert!(puzzles[1]["last_played"]
            .as_str()
            .unwrap()
            .starts_with("20"));
        assert_eq!(puzzles[1]["created_at"], "2026-01-02T03:04:05.000Z");
        let history = data["history"].as_array().unwrap();
        assert_eq!(history[0]["pgn"], "1. e4 *");
        assert!(history[0]["id"].as_str().unwrap().len() > 5);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
