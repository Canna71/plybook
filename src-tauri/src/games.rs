//! Game databases: large PGN files (also .pgn.zst) imported into SQLite and searchable by player,
//! opening, result, rating and position. The first INDEX_PLIES positions of every game are
//! indexed by Zobrist hash, with the move played next (the basis of an opening explorer).
//!
//! Games are stored as rebuilt PGN: all tags and the mainline; comments and variations are
//! dropped, which suits reference databases and keeps them small.

use crate::db::{db_path, with_db, Database};
use rusqlite::{params, params_from_iter, types::Value, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use shakmaty::{
    fen::Fen, uci::UciMove, zobrist::Zobrist64, CastlingMode, Chess, EnPassantMode, Position,
};
use std::io::{self, Read};
use std::ops::ControlFlow;
use std::path::Path;
use tauri::ipc::Channel;
use tauri::{AppHandle, Runtime, State};
use tauri_plugin_dialog::DialogExt;

use pgn_reader::{Outcome, RawTag, Reader, SanPlus, Skip, Visitor};

/// Positions indexed per game: the opening phase, where position searches are useful.
const INDEX_PLIES: usize = 30;
const PROGRESS_EVERY: u64 = 2_000;

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseInfo {
    id: i64,
    name: String,
    source: String,
    imported_at: String,
    game_count: i64,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GameRow {
    id: i64,
    database_id: i64,
    white: String,
    black: String,
    white_elo: Option<i64>,
    black_elo: Option<i64>,
    result: String,
    date: String,
    event: String,
    eco: String,
    opening: String,
    plies: i64,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GameQuery {
    database_id: Option<i64>,
    /// Either colour
    player: Option<String>,
    white: Option<String>,
    black: Option<String>,
    /// Prefix, e.g. "B9" or "C42"
    eco: Option<String>,
    result: Option<String>,
    /// Both players at least this rated
    min_elo: Option<i64>,
    /// Games that reached this position within the indexed plies
    fen: Option<String>,
    offset: Option<i64>,
    limit: Option<i64>,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct SearchResult {
    total: i64,
    games: Vec<GameRow>,
}

#[derive(Clone, Serialize)]
#[serde(tag = "event", content = "data", rename_all = "camelCase")]
pub enum ImportEvent {
    #[serde(rename_all = "camelCase")]
    Progress {
        games: u64,
        skipped: u64,
        bytes: u64,
        total_bytes: u64,
    },
}

// #region parsing

#[derive(Default)]
struct Tags {
    pairs: Vec<(String, String)>,
    start: Option<Chess>,
    invalid_fen: bool,
}

struct Movetext {
    tags: Vec<(String, String)>,
    pos: Chess,
    first_turn_black: bool,
    first_fullmove: u32,
    sans: Vec<String>,
    /// (hash, next move in UCI) for the first INDEX_PLIES positions
    positions: Vec<(i64, Option<String>)>,
    illegal: bool,
    outcome: Option<String>,
}

struct ParsedGame {
    tags: Vec<(String, String)>,
    sans: Vec<String>,
    first_turn_black: bool,
    first_fullmove: u32,
    positions: Vec<(i64, Option<String>)>,
    result: String,
}

impl ParsedGame {
    fn tag(&self, name: &str) -> &str {
        self.tags
            .iter()
            .find(|(k, _)| k == name)
            .map_or("", |(_, v)| v.as_str())
    }

    fn pgn(&self) -> String {
        let mut text = String::new();
        for (name, value) in &self.tags {
            let value = value.replace('\\', "\\\\").replace('"', "\\\"");
            text.push_str(&format!("[{name} \"{value}\"]\n"));
        }
        text.push('\n');
        let mut fullmove = self.first_fullmove;
        for (i, san) in self.sans.iter().enumerate() {
            let black = (i % 2 == 1) != self.first_turn_black;
            if !black {
                text.push_str(&format!("{fullmove}. "));
            } else if i == 0 {
                text.push_str(&format!("{fullmove}... "));
            }
            text.push_str(san);
            text.push(' ');
            if black {
                fullmove += 1;
            }
        }
        text.push_str(&self.result);
        text.push('\n');
        text
    }
}

fn zobrist(pos: &Chess) -> i64 {
    pos.zobrist_hash::<Zobrist64>(EnPassantMode::Legal).0 as i64
}

struct Indexer;

impl Visitor for Indexer {
    type Tags = Tags;
    type Movetext = Movetext;
    type Output = Option<ParsedGame>;

    fn begin_tags(&mut self) -> ControlFlow<Self::Output, Self::Tags> {
        ControlFlow::Continue(Tags::default())
    }

    fn tag(
        &mut self,
        tags: &mut Tags,
        name: &[u8],
        value: RawTag<'_>,
    ) -> ControlFlow<Self::Output> {
        let name = String::from_utf8_lossy(name).to_string();
        let value = value.decode_utf8_lossy().to_string();
        if name == "FEN" {
            match Fen::from_ascii(value.as_bytes())
                .ok()
                .and_then(|fen| fen.into_position(CastlingMode::Chess960).ok())
            {
                Some(pos) => tags.start = Some(pos),
                None => tags.invalid_fen = true,
            }
        }
        tags.pairs.push((name, value));
        ControlFlow::Continue(())
    }

    fn begin_movetext(&mut self, tags: Tags) -> ControlFlow<Self::Output, Self::Movetext> {
        if tags.invalid_fen {
            return ControlFlow::Break(None);
        }
        let pos = tags.start.unwrap_or_default();
        ControlFlow::Continue(Movetext {
            first_turn_black: pos.turn().is_black(),
            first_fullmove: pos.fullmoves().get(),
            positions: vec![(zobrist(&pos), None)],
            pos,
            tags: tags.pairs,
            sans: Vec::new(),
            illegal: false,
            outcome: None,
        })
    }

    fn san(&mut self, m: &mut Movetext, san_plus: SanPlus) -> ControlFlow<Self::Output> {
        if m.illegal {
            return ControlFlow::Continue(());
        }
        let Ok(mv) = san_plus.san.to_move(&m.pos) else {
            m.illegal = true;
            return ControlFlow::Continue(());
        };
        if m.sans.len() < INDEX_PLIES {
            let uci = UciMove::from_standard(mv).to_string();
            if let Some(last) = m.positions.last_mut() {
                last.1 = Some(uci);
            }
        }
        m.pos.play_unchecked(mv);
        m.sans.push(san_plus.to_string());
        if m.sans.len() < INDEX_PLIES {
            m.positions.push((zobrist(&m.pos), None));
        }
        ControlFlow::Continue(())
    }

    /// Only the mainline is kept (the default differs between pgn-reader versions).
    fn begin_variation(&mut self, _m: &mut Movetext) -> ControlFlow<Self::Output, Skip> {
        ControlFlow::Continue(Skip(true))
    }

    fn outcome(&mut self, m: &mut Movetext, outcome: Outcome) -> ControlFlow<Self::Output> {
        m.outcome = Some(outcome.to_string());
        ControlFlow::Continue(())
    }

    fn end_game(&mut self, m: Movetext) -> Self::Output {
        if m.illegal {
            return None;
        }
        let result = m
            .outcome
            .or_else(|| {
                m.tags
                    .iter()
                    .find(|(k, _)| k == "Result")
                    .map(|(_, v)| v.clone())
            })
            .unwrap_or_else(|| "*".to_string());
        Some(ParsedGame {
            tags: m.tags,
            sans: m.sans,
            first_turn_black: m.first_turn_black,
            first_fullmove: m.first_fullmove,
            positions: m.positions,
            result,
        })
    }
}

/// Counts the bytes read, for progress.
pub(crate) struct Counting<R> {
    inner: R,
    count: std::sync::Arc<std::sync::atomic::AtomicU64>,
}

impl<R> Counting<R> {
    pub(crate) fn new(inner: R, count: std::sync::Arc<std::sync::atomic::AtomicU64>) -> Self {
        Counting { inner, count }
    }
}

impl<R: Read> Read for Counting<R> {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let n = self.inner.read(buf)?;
        self.count
            .fetch_add(n as u64, std::sync::atomic::Ordering::Relaxed);
        Ok(n)
    }
}

// #endregion

// #region storage

fn database_from_row(row: &Row) -> rusqlite::Result<DatabaseInfo> {
    Ok(DatabaseInfo {
        id: row.get("id")?,
        name: row.get("name")?,
        source: row.get("source")?,
        imported_at: row.get("imported_at")?,
        game_count: row.get("game_count")?,
    })
}

fn game_from_row(row: &Row) -> rusqlite::Result<GameRow> {
    Ok(GameRow {
        id: row.get("id")?,
        database_id: row.get("database_id")?,
        white: row.get("white")?,
        black: row.get("black")?,
        white_elo: row.get("white_elo")?,
        black_elo: row.get("black_elo")?,
        result: row.get("result")?,
        date: row.get("date")?,
        event: row.get("event")?,
        eco: row.get("eco")?,
        opening: row.get("opening")?,
        plies: row.get("plies")?,
    })
}

/// Imports every legal game of `input` as a new database, in one transaction.
fn import_games(
    conn: &Connection,
    input: impl Read,
    name: &str,
    source: &str,
    mut progress: impl FnMut(u64, u64),
) -> Result<DatabaseInfo, String> {
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT INTO databases (name, source, imported_at) VALUES (?1, ?2, ?3)",
        params![name, source, chrono::Utc::now().to_rfc3339()],
    )
    .map_err(|e| e.to_string())?;
    let database_id = tx.last_insert_rowid();
    let (mut games, mut skipped) = (0u64, 0u64);
    {
        let mut insert_game = tx
            .prepare(
                "INSERT INTO games (database_id, white, black, white_elo, black_elo, result, date,
                     event, site, eco, opening, plies, pgn)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            )
            .map_err(|e| e.to_string())?;
        let mut insert_position = tx
            .prepare(
                "INSERT INTO positions (hash, game_id, database_id, ply, next_move)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
            )
            .map_err(|e| e.to_string())?;
        let mut reader = Reader::new(input);
        let mut indexer = Indexer;
        while let Some(parsed) = reader.read_game(&mut indexer).map_err(|e| e.to_string())? {
            let Some(game) = parsed else {
                skipped += 1;
                continue;
            };
            let elo = |name: &str| game.tag(name).parse::<i64>().ok();
            insert_game
                .execute(params![
                    database_id,
                    game.tag("White"),
                    game.tag("Black"),
                    elo("WhiteElo"),
                    elo("BlackElo"),
                    game.result,
                    game.tag("Date"),
                    game.tag("Event"),
                    game.tag("Site"),
                    game.tag("ECO"),
                    game.tag("Opening"),
                    game.sans.len() as i64,
                    game.pgn(),
                ])
                .map_err(|e| e.to_string())?;
            let game_id = tx.last_insert_rowid();
            for (ply, (hash, next)) in game.positions.iter().enumerate() {
                insert_position
                    .execute(params![hash, game_id, database_id, ply as i64, next])
                    .map_err(|e| e.to_string())?;
            }
            games += 1;
            if games.is_multiple_of(PROGRESS_EVERY) {
                progress(games, skipped);
            }
        }
    }
    tx.execute(
        "UPDATE databases SET game_count = ?2 WHERE id = ?1",
        params![database_id, games as i64],
    )
    .map_err(|e| e.to_string())?;
    let info = tx
        .query_row(
            "SELECT * FROM databases WHERE id = ?1",
            [database_id],
            database_from_row,
        )
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    progress(games, skipped);
    Ok(info)
}

fn list_databases(conn: &Connection) -> Result<Vec<DatabaseInfo>, String> {
    let mut stmt = conn
        .prepare("SELECT * FROM databases ORDER BY imported_at DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], database_from_row)
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string());
    rows
}

fn delete_database(conn: &Connection, id: i64) -> Result<(), String> {
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    for table in ["positions", "games"] {
        tx.execute(&format!("DELETE FROM {table} WHERE database_id = ?1"), [id])
            .map_err(|e| e.to_string())?;
    }
    tx.execute("DELETE FROM databases WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}

/// The Zobrist hash of a FEN, as stored in `positions`.
fn fen_hash(fen: &str) -> Result<i64, String> {
    let pos: Chess = Fen::from_ascii(fen.trim().as_bytes())
        .map_err(|e| e.to_string())?
        .into_position(CastlingMode::Chess960)
        .map_err(|e| e.to_string())?;
    Ok(zobrist(&pos))
}

fn search_games(conn: &Connection, q: &GameQuery) -> Result<SearchResult, String> {
    let mut clauses: Vec<&str> = Vec::new();
    let mut args: Vec<Value> = Vec::new();
    let like = |text: &str| Value::Text(format!("%{}%", text.trim()));
    if let Some(id) = q.database_id {
        clauses.push("database_id = ?");
        args.push(Value::Integer(id));
    }
    if let Some(player) = q.player.as_deref().filter(|p| !p.trim().is_empty()) {
        clauses.push("(white LIKE ? OR black LIKE ?)");
        args.push(like(player));
        args.push(like(player));
    }
    if let Some(white) = q.white.as_deref().filter(|p| !p.trim().is_empty()) {
        clauses.push("white LIKE ?");
        args.push(like(white));
    }
    if let Some(black) = q.black.as_deref().filter(|p| !p.trim().is_empty()) {
        clauses.push("black LIKE ?");
        args.push(like(black));
    }
    if let Some(eco) = q.eco.as_deref().filter(|e| !e.trim().is_empty()) {
        clauses.push("eco LIKE ?");
        args.push(Value::Text(format!("{}%", eco.trim())));
    }
    if let Some(result) = q.result.as_deref().filter(|r| !r.is_empty()) {
        clauses.push("result = ?");
        args.push(Value::Text(result.to_string()));
    }
    if let Some(min) = q.min_elo {
        clauses.push("white_elo >= ? AND black_elo >= ?");
        args.push(Value::Integer(min));
        args.push(Value::Integer(min));
    }
    if let Some(fen) = q.fen.as_deref().filter(|f| !f.trim().is_empty()) {
        clauses.push("id IN (SELECT game_id FROM positions WHERE hash = ?)");
        args.push(Value::Integer(fen_hash(fen)?));
    }
    let filter = if clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", clauses.join(" AND "))
    };
    let total: i64 = conn
        .query_row(
            &format!("SELECT count(*) FROM games {filter}"),
            params_from_iter(args.iter()),
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let mut page_args = args.clone();
    page_args.push(Value::Integer(q.limit.unwrap_or(100).clamp(1, 1000)));
    page_args.push(Value::Integer(q.offset.unwrap_or(0).max(0)));
    let mut stmt = conn
        .prepare(&format!(
            "SELECT id, database_id, white, black, white_elo, black_elo, result, date, event,
                 eco, opening, plies
             FROM games {filter} ORDER BY date DESC, id LIMIT ? OFFSET ?"
        ))
        .map_err(|e| e.to_string())?;
    let games = stmt
        .query_map(params_from_iter(page_args.iter()), game_from_row)
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())?;
    Ok(SearchResult { total, games })
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerMove {
    pub(crate) uci: String,
    pub(crate) san: String,
    pub(crate) games: i64,
    pub(crate) white_wins: i64,
    pub(crate) draws: i64,
    pub(crate) black_wins: i64,
    /// Average rating of the players, where known
    pub(crate) average_elo: Option<i64>,
}

/// The moves played from a position in the imported games, most played first. A game counts
/// once per move even if it reached the position twice; transpositions are found by hash.
fn explore(
    conn: &Connection,
    fen: &str,
    database_id: Option<i64>,
) -> Result<Vec<ExplorerMove>, String> {
    let pos: Chess = Fen::from_ascii(fen.trim().as_bytes())
        .map_err(|e| e.to_string())?
        .into_position(CastlingMode::Chess960)
        .map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT p.next_move, count(*) AS games,
                 sum(g.result = '1-0'), sum(g.result = '1/2-1/2'), sum(g.result = '0-1'),
                 avg((g.white_elo + g.black_elo) / 2.0)
             FROM (SELECT DISTINCT game_id, next_move FROM positions
                   WHERE hash = ?1 AND next_move IS NOT NULL
                     AND (?2 IS NULL OR database_id = ?2)) AS p
             JOIN games g ON g.id = p.game_id
             GROUP BY p.next_move ORDER BY games DESC LIMIT 40",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![zobrist(&pos), database_id], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, i64>(1)?,
                r.get::<_, i64>(2)?,
                r.get::<_, i64>(3)?,
                r.get::<_, i64>(4)?,
                r.get::<_, Option<f64>>(5)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .filter_map(|(uci, games, white_wins, draws, black_wins, elo)| {
            // a hash collision could name a move that is not legal here
            let mv = uci.parse::<UciMove>().ok()?.to_move(&pos).ok()?;
            Some(ExplorerMove {
                san: shakmaty::san::San::from_move(&pos, mv).to_string(),
                uci,
                games,
                white_wins,
                draws,
                black_wins,
                average_elo: elo.map(|e| e.round() as i64),
            })
        })
        .collect())
}

fn game_pgn(conn: &Connection, id: i64) -> Result<String, String> {
    conn.query_row("SELECT pgn FROM games WHERE id = ?1", [id], |r| r.get(0))
        .optional()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Game {id} not found"))
}

// #endregion

// #region commands

#[tauri::command]
pub async fn gamedb_list(db: State<'_, Database>) -> Result<Vec<DatabaseInfo>, String> {
    with_db(&db, list_databases)
}

#[tauri::command]
pub async fn gamedb_delete(db: State<'_, Database>, id: i64) -> Result<(), String> {
    with_db(&db, |conn| delete_database(conn, id))
}

#[tauri::command]
pub async fn gamedb_search(
    db: State<'_, Database>,
    query: GameQuery,
) -> Result<SearchResult, String> {
    with_db(&db, |conn| search_games(conn, &query))
}

#[tauri::command]
pub async fn gamedb_explore(
    db: State<'_, Database>,
    fen: String,
    database_id: Option<i64>,
) -> Result<Vec<ExplorerMove>, String> {
    with_db(&db, |conn| explore(conn, &fen, database_id))
}

#[tauri::command]
pub async fn gamedb_game(db: State<'_, Database>, id: i64) -> Result<String, String> {
    with_db(&db, |conn| game_pgn(conn, id))
}

/// Asks for a PGN file (.pgn or .pgn.zst) with the native dialog and imports it as a new
/// database, reporting progress. Resolves to None if the dialog was cancelled.
#[tauri::command]
pub async fn gamedb_import<R: Runtime>(
    app: AppHandle<R>,
    on_event: Channel<ImportEvent>,
) -> Result<Option<DatabaseInfo>, String> {
    let picker = app.clone();
    let picked = tauri::async_runtime::spawn_blocking(move || {
        picker
            .dialog()
            .file()
            .set_title("Import a PGN database")
            .add_filter("PGN", &["pgn", "zst"])
            .blocking_pick_file()
    })
    .await
    .map_err(|e| e.to_string())?;
    let Some(path) = picked.and_then(|p| p.into_path().ok()) else {
        return Ok(None);
    };
    let db_file = db_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || import_file(&db_file, &path, on_event))
        .await
        .map_err(|e| e.to_string())?
        .map(Some)
}

fn import_file(
    db_file: &Path,
    path: &Path,
    on_event: Channel<ImportEvent>,
) -> Result<DatabaseInfo, String> {
    // its own connection, so the app keeps using the database during a long import
    let conn = Connection::open(db_file).map_err(|e| e.to_string())?;
    conn.busy_timeout(std::time::Duration::from_secs(30))
        .map_err(|e| e.to_string())?;
    let file = std::fs::File::open(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let total_bytes = file.metadata().map(|m| m.len()).unwrap_or(0);
    let count = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0));
    let counted = Counting::new(file, count.clone());
    let file_name = path
        .file_name()
        .map_or_else(String::new, |n| n.to_string_lossy().to_string());
    let name = file_name
        .trim_end_matches(".zst")
        .trim_end_matches(".pgn")
        .to_string();
    let input: Box<dyn Read> = if file_name.ends_with(".zst") {
        Box::new(zstd::Decoder::new(counted).map_err(|e| e.to_string())?)
    } else {
        Box::new(counted)
    };
    import_games(
        &conn,
        input,
        &name,
        &path.to_string_lossy(),
        |games, skipped| {
            let _ = on_event.send(ImportEvent::Progress {
                games,
                skipped,
                bytes: count.load(std::sync::atomic::Ordering::Relaxed),
                total_bytes,
            });
        },
    )
}

// #endregion

#[cfg(test)]
mod tests {
    use super::*;

    const PGN: &str = r#"[Event "Club"]
[Site "Home"]
[Date "2024.01.02"]
[White "Alice"]
[Black "Bob"]
[Result "1-0"]
[WhiteElo "1800"]
[BlackElo "1700"]
[ECO "C50"]
[Opening "Italian Game"]

1. e4 e5 2. Nf3 {a comment} Nc6 (2... d6 3. d4) 3. Bc4 Bc5 1-0

[Event "Club"]
[Date "2024.03.04"]
[White "Carol"]
[Black "Alice"]
[Result "0-1"]
[WhiteElo "2100"]
[BlackElo "2000"]
[ECO "B90"]

1. e4 c5 2. Nf3 d6 0-1

[Event "Broken"]
[White "X"]
[Black "Y"]
[Result "*"]

1. e4 e4 *

[Event "Endgame"]
[White "Dan"]
[Black "Eve"]
[Result "1/2-1/2"]
[FEN "4k3/8/8/8/8/8/4P3/4K3 b - - 0 40"]
[SetUp "1"]

40... Kd7 41. e4 1/2-1/2
"#;

    fn imported() -> (Connection, DatabaseInfo) {
        let conn = Connection::open_in_memory().unwrap();
        crate::db::migrate(&conn).unwrap();
        let mut calls = 0;
        let info =
            import_games(&conn, PGN.as_bytes(), "Test", "test.pgn", |_, _| calls += 1).unwrap();
        assert!(calls >= 1);
        (conn, info)
    }

    fn search(conn: &Connection, q: GameQuery) -> Vec<String> {
        search_games(conn, &q)
            .unwrap()
            .games
            .into_iter()
            .map(|g| format!("{}-{}", g.white, g.black))
            .collect()
    }

    #[test]
    fn imports_legal_games_and_skips_broken_ones() {
        let (conn, info) = imported();
        assert_eq!(info.game_count, 3);
        assert_eq!(info.name, "Test");
        assert_eq!(list_databases(&conn).unwrap(), vec![info]);
    }

    #[test]
    fn rebuilds_pgn_with_tags_and_mainline_only() {
        let (conn, _) = imported();
        let alice = search_games(
            &conn,
            &GameQuery {
                white: Some("alice".into()),
                ..Default::default()
            },
        )
        .unwrap();
        let pgn = game_pgn(&conn, alice.games[0].id).unwrap();
        assert!(pgn.contains("[Opening \"Italian Game\"]"));
        assert!(
            pgn.ends_with("\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 1-0\n"),
            "{pgn}"
        );
        let endgame = search_games(
            &conn,
            &GameQuery {
                player: Some("dan".into()),
                ..Default::default()
            },
        )
        .unwrap();
        assert!(game_pgn(&conn, endgame.games[0].id)
            .unwrap()
            .ends_with("40... Kd7 41. e4 1/2-1/2\n"));
    }

    #[test]
    fn searches_by_player_eco_result_and_rating() {
        let (conn, _) = imported();
        // newest first
        assert_eq!(
            search(
                &conn,
                GameQuery {
                    player: Some("ALICE".into()),
                    ..Default::default()
                }
            ),
            ["Carol-Alice", "Alice-Bob"]
        );
        assert_eq!(
            search(
                &conn,
                GameQuery {
                    eco: Some("B9".into()),
                    ..Default::default()
                }
            ),
            ["Carol-Alice"]
        );
        assert_eq!(
            search(
                &conn,
                GameQuery {
                    result: Some("1-0".into()),
                    ..Default::default()
                }
            ),
            ["Alice-Bob"]
        );
        assert_eq!(
            search(
                &conn,
                GameQuery {
                    min_elo: Some(1900),
                    ..Default::default()
                }
            ),
            ["Carol-Alice"]
        );
        let page = search_games(
            &conn,
            &GameQuery {
                limit: Some(1),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!((page.total, page.games.len()), (3, 1));
    }

    #[test]
    fn finds_games_by_position() {
        let (conn, _) = imported();
        // after 1. e4: both games from the starting position
        let after_e4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
        assert_eq!(
            search(
                &conn,
                GameQuery {
                    fen: Some(after_e4.into()),
                    ..Default::default()
                }
            )
            .len(),
            2
        );
        // the Sicilian: only Carol's game; move counters do not matter
        let sicilian = "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 7";
        assert_eq!(
            search(
                &conn,
                GameQuery {
                    fen: Some(sicilian.into()),
                    ..Default::default()
                }
            ),
            ["Carol-Alice"]
        );
        // positions of a game set up from a FEN are indexed too
        let endgame = "8/3k4/8/8/8/8/4P3/4K3 w - - 1 41";
        assert_eq!(
            search(
                &conn,
                GameQuery {
                    fen: Some(endgame.into()),
                    ..Default::default()
                }
            ),
            ["Dan-Eve"]
        );
        assert!(search_games(
            &conn,
            &GameQuery {
                fen: Some("nonsense".into()),
                ..Default::default()
            }
        )
        .is_err());
    }

    #[test]
    fn indexes_the_next_move() {
        let (conn, _) = imported();
        let start = fen_hash("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1").unwrap();
        let next: Vec<String> = conn
            .prepare("SELECT next_move FROM positions WHERE hash = ?1")
            .unwrap()
            .query_map([start], |r| r.get(0))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap();
        assert_eq!(next, ["e2e4", "e2e4"]);
    }

    #[test]
    fn explores_the_moves_played_from_a_position() {
        let (conn, info) = imported();
        let start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
        let moves = explore(&conn, start, None).unwrap();
        assert_eq!(moves.len(), 1);
        assert_eq!(
            moves[0],
            ExplorerMove {
                uci: "e2e4".into(),
                san: "e4".into(),
                games: 2,
                white_wins: 1,
                draws: 0,
                black_wins: 1,
                average_elo: Some(1900),
            }
        );
        // after 1. e4 Black chose e5 once and c5 once
        let after_e4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
        let mut sans: Vec<String> = explore(&conn, after_e4, Some(info.id))
            .unwrap()
            .into_iter()
            .map(|m| m.san)
            .collect();
        sans.sort();
        assert_eq!(sans, ["c5", "e5"]);
        assert!(explore(&conn, after_e4, Some(info.id + 1))
            .unwrap()
            .is_empty());
        assert!(explore(&conn, "bad fen", None).is_err());
    }

    #[test]
    fn explorer_counts_a_repeated_position_once() {
        let conn = Connection::open_in_memory().unwrap();
        crate::db::migrate(&conn).unwrap();
        // the knights go out and back: the start position is reached twice, both times with Nf3
        let pgn = "[White \"A\"]\n[Black \"B\"]\n[Result \"1/2-1/2\"]\n\n\
            1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 1/2-1/2\n";
        import_games(&conn, pgn.as_bytes(), "rep", "rep.pgn", |_, _| {}).unwrap();
        let start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
        let moves = explore(&conn, start, None).unwrap();
        assert_eq!(
            (moves[0].san.as_str(), moves[0].games, moves[0].draws),
            ("Nf3", 1, 1)
        );
    }

    #[test]
    fn deleting_a_database_removes_its_games() {
        let (conn, info) = imported();
        delete_database(&conn, info.id).unwrap();
        assert!(list_databases(&conn).unwrap().is_empty());
        let left: i64 = conn
            .query_row(
                "SELECT (SELECT count(*) FROM games) + (SELECT count(*) FROM positions)",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(left, 0);
    }

    /// Import speed on a real file: RECHESS_BENCH_PGN=/path/to/file.pgn cargo test --release
    /// bench_import -- --ignored --nocapture
    #[test]
    #[ignore]
    fn bench_import() {
        let path = std::env::var("RECHESS_BENCH_PGN").expect("RECHESS_BENCH_PGN");
        let db_file =
            std::env::temp_dir().join(format!("rechess-bench-{}.sqlite", std::process::id()));
        let conn = Connection::open(&db_file).unwrap();
        crate::db::migrate(&conn).unwrap();
        let file = std::fs::File::open(&path).unwrap();
        let start = std::time::Instant::now();
        let info = import_games(&conn, file, "bench", &path, |_, _| {}).unwrap();
        let elapsed = start.elapsed().as_secs_f64();
        let search = std::time::Instant::now();
        let found = search_games(
            &conn,
            &GameQuery {
                fen: Some("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1".into()),
                ..Default::default()
            },
        )
        .unwrap();
        let explorer = std::time::Instant::now();
        let start_moves = explore(
            &conn,
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            None,
        )
        .unwrap();
        eprintln!(
            "explorer at the start: {} moves in {:.0} ms",
            start_moves.len(),
            explorer.elapsed().as_secs_f64() * 1000.0
        );
        let size = std::fs::metadata(&db_file).unwrap().len();
        eprintln!(
            "{} games in {elapsed:.2}s ({:.0} games/s), {} after 1. e4 found in {:.0} ms, {:.1} MB",
            info.game_count,
            info.game_count as f64 / elapsed,
            found.total,
            search.elapsed().as_secs_f64() * 1000.0,
            size as f64 / 1e6
        );
        let _ = std::fs::remove_file(&db_file);
    }
}
