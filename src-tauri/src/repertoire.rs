//! Repertoires: Library PGN files marked as the user's lines for one side, and the spaced
//! repetition state of each position where it is the user's move. The scheduling itself lives
//! in the frontend (src/models/repertoire.ts); this only stores it.

use crate::db::{with_db, Database};
use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Repertoire {
    file_path: String,
    side: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct RepertoireCard {
    fen: String,
    #[serde(rename = "box")]
    box_: i64,
    due: String,
    reviews: i64,
    lapses: i64,
}

fn card_from_row(row: &Row) -> rusqlite::Result<RepertoireCard> {
    Ok(RepertoireCard {
        fen: row.get("fen")?,
        box_: row.get("box")?,
        due: row.get("due")?,
        reviews: row.get("reviews")?,
        lapses: row.get("lapses")?,
    })
}

fn list(conn: &Connection) -> Result<Vec<Repertoire>, String> {
    let mut stmt = conn
        .prepare("SELECT file_path, side FROM repertoires ORDER BY file_path")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Repertoire {
                file_path: r.get(0)?,
                side: r.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string());
    rows
}

/// Marks a file as a repertoire for `side`, or with None stops treating it as one (its
/// training history goes too).
fn set(conn: &Connection, file_path: &str, side: Option<&str>) -> Result<(), String> {
    match side {
        Some(side @ ("white" | "black")) => conn
            .execute(
                "INSERT INTO repertoires (file_path, side, created_at) VALUES (?1, ?2, ?3)
                 ON CONFLICT(file_path) DO UPDATE SET side = excluded.side",
                params![file_path, side, chrono::Utc::now().to_rfc3339()],
            )
            .map(drop),
        Some(other) => return Err(format!("Invalid side {other:?}")),
        None => conn
            .execute("DELETE FROM repertoires WHERE file_path = ?1", [file_path])
            .and_then(|_| {
                conn.execute(
                    "DELETE FROM repertoire_cards WHERE file_path = ?1",
                    [file_path],
                )
            })
            .map(drop),
    }
    .map_err(|e| e.to_string())
}

fn cards(conn: &Connection, file_path: &str) -> Result<Vec<RepertoireCard>, String> {
    let mut stmt = conn
        .prepare("SELECT * FROM repertoire_cards WHERE file_path = ?1")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([file_path], card_from_row)
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string());
    rows
}

fn save_card(conn: &Connection, file_path: &str, card: &RepertoireCard) -> Result<(), String> {
    conn.execute(
        "INSERT OR REPLACE INTO repertoire_cards (file_path, fen, box, due, reviews, lapses)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            file_path,
            card.fen,
            card.box_,
            card.due,
            card.reviews,
            card.lapses
        ],
    )
    .map(drop)
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn repertoire_list(db: State<'_, Database>) -> Result<Vec<Repertoire>, String> {
    with_db(&db, list)
}

#[tauri::command]
pub async fn repertoire_set(
    db: State<'_, Database>,
    file_path: String,
    side: Option<String>,
) -> Result<(), String> {
    with_db(&db, |conn| set(conn, &file_path, side.as_deref()))
}

#[tauri::command]
pub async fn repertoire_cards(
    db: State<'_, Database>,
    file_path: String,
) -> Result<Vec<RepertoireCard>, String> {
    with_db(&db, |conn| cards(conn, &file_path))
}

#[tauri::command]
pub async fn repertoire_save_card(
    db: State<'_, Database>,
    file_path: String,
    card: RepertoireCard,
) -> Result<(), String> {
    with_db(&db, |conn| save_card(conn, &file_path, &card))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn memory_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        crate::db::migrate(&conn).unwrap();
        conn
    }

    fn card(fen: &str, box_: i64) -> RepertoireCard {
        RepertoireCard {
            fen: fen.into(),
            box_,
            due: "2026-10-25T12:00:00Z".into(),
            reviews: 1,
            lapses: 0,
        }
    }

    #[test]
    fn marks_files_as_repertoires() {
        let conn = memory_db();
        set(&conn, "Library/w.pgn", Some("white")).unwrap();
        set(&conn, "Library/b.pgn", Some("black")).unwrap();
        set(&conn, "Library/w.pgn", Some("black")).unwrap();
        assert_eq!(
            list(&conn).unwrap(),
            [
                Repertoire {
                    file_path: "Library/b.pgn".into(),
                    side: "black".into()
                },
                Repertoire {
                    file_path: "Library/w.pgn".into(),
                    side: "black".into()
                },
            ]
        );
        assert!(set(&conn, "Library/x.pgn", Some("red")).is_err());
    }

    #[test]
    fn stores_cards_per_file_and_forgets_them_with_the_repertoire() {
        let conn = memory_db();
        set(&conn, "Library/w.pgn", Some("white")).unwrap();
        save_card(&conn, "Library/w.pgn", &card("a", 1)).unwrap();
        save_card(&conn, "Library/w.pgn", &card("a", 2)).unwrap();
        save_card(&conn, "Library/w.pgn", &card("b", 1)).unwrap();
        save_card(&conn, "Library/other.pgn", &card("a", 5)).unwrap();
        let mut saved = cards(&conn, "Library/w.pgn").unwrap();
        saved.sort_by(|x, y| x.fen.cmp(&y.fen));
        assert_eq!(saved, [card("a", 2), card("b", 1)]);
        // the JSON field is "box", as in the frontend
        assert_eq!(serde_json::to_value(card("a", 3)).unwrap()["box"], 3);

        set(&conn, "Library/w.pgn", None).unwrap();
        assert!(list(&conn).unwrap().is_empty());
        assert!(cards(&conn, "Library/w.pgn").unwrap().is_empty());
        assert_eq!(cards(&conn, "Library/other.pgn").unwrap().len(), 1);
    }
}
