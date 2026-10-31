//! Opening books in the Polyglot format (.bin): imported into `<AppLocalData>/Books`, read with a
//! binary search on disk so large books cost nothing to open.
//!
//! A book is a sorted list of 16-byte entries: position key (u64, the Polyglot Zobrist hash,
//! which shakmaty's Zobrist64 reproduces), move (u16), weight (u16), learn (u32), big-endian.

use crate::games::Counting;
use pgn_reader::{RawTag, Reader, SanPlus, Skip, Visitor};
use serde::{Deserialize, Serialize};
use shakmaty::{
    fen::Fen, san::San, uci::UciMove, zobrist::Zobrist64, CastlingMode, Chess, EnPassantMode, Move,
    Position, Role, Square,
};
use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::ops::ControlFlow;
use std::path::{Path, PathBuf};
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_dialog::DialogExt;

const BOOKS_FOLDER: &str = "Books";
const ENTRY_SIZE: u64 = 16;

#[derive(Debug, Serialize, PartialEq)]
pub struct BookMove {
    uci: String,
    san: String,
    weight: u16,
}

fn books_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join(BOOKS_FOLDER);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// A book in the Books folder: a plain file name ending in .bin.
fn book_path<R: Runtime>(app: &AppHandle<R>, name: &str) -> Result<PathBuf, String> {
    let plain = !name.is_empty()
        && !name.contains(['/', '\\'])
        && name != ".."
        && name.to_ascii_lowercase().ends_with(".bin");
    if !plain {
        return Err(format!("Invalid book name {name:?}"));
    }
    Ok(books_dir(app)?.join(name))
}

fn read_entry(file: &mut File, index: u64) -> std::io::Result<(u64, u16, u16)> {
    let mut buf = [0u8; ENTRY_SIZE as usize];
    file.seek(SeekFrom::Start(index * ENTRY_SIZE))?;
    file.read_exact(&mut buf)?;
    let key = u64::from_be_bytes(buf[0..8].try_into().unwrap());
    let mv = u16::from_be_bytes(buf[8..10].try_into().unwrap());
    let weight = u16::from_be_bytes(buf[10..12].try_into().unwrap());
    Ok((key, mv, weight))
}

/// The (move, weight) entries of `key`: binary search for the first, then read while it matches.
fn entries(path: &Path, key: u64) -> Result<Vec<(u16, u16)>, String> {
    let mut file = File::open(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let count = file.metadata().map_err(|e| e.to_string())?.len() / ENTRY_SIZE;
    let (mut lo, mut hi) = (0, count);
    while lo < hi {
        let mid = (lo + hi) / 2;
        if read_entry(&mut file, mid).map_err(|e| e.to_string())?.0 < key {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    let mut found = Vec::new();
    for i in lo..count {
        let (k, mv, weight) = read_entry(&mut file, i).map_err(|e| e.to_string())?;
        if k != key {
            break;
        }
        found.push((mv, weight));
    }
    Ok(found)
}

/// A Polyglot move as (from, to, promotion): castling is "king takes own rook".
fn polyglot_parts(m: &Move) -> Option<(Square, Square, Option<Role>)> {
    match *m {
        Move::Normal {
            from,
            to,
            promotion,
            ..
        } => Some((from, to, promotion)),
        Move::EnPassant { from, to } => Some((from, to, None)),
        Move::Castle { king, rook } => Some((king, rook, None)),
        Move::Put { .. } => None,
    }
}

/// The legal move a Polyglot move stands for, if any (a stale or broken entry has none).
fn decode(pos: &Chess, mv: u16) -> Option<Move> {
    let to = Square::new(u32::from(mv & 0x3f));
    let from = Square::new(u32::from((mv >> 6) & 0x3f));
    let promotion = match (mv >> 12) & 0x7 {
        0 => None,
        1 => Some(Role::Knight),
        2 => Some(Role::Bishop),
        3 => Some(Role::Rook),
        4 => Some(Role::Queen),
        _ => return None,
    };
    pos.legal_moves()
        .into_iter()
        .find(|m| polyglot_parts(m) == Some((from, to, promotion)))
}

/// The book's moves in `fen`, by weight, as UCI (castling as the king's move) and SAN.
fn moves_in(path: &Path, fen: &str) -> Result<Vec<BookMove>, String> {
    let pos: Chess = Fen::from_ascii(fen.trim().as_bytes())
        .map_err(|e| e.to_string())?
        .into_position(CastlingMode::Standard)
        .map_err(|e| e.to_string())?;
    let key = pos.zobrist_hash::<Zobrist64>(EnPassantMode::Legal).0;
    let mut moves: Vec<BookMove> = entries(path, key)?
        .into_iter()
        .filter_map(|(mv, weight)| {
            let m = decode(&pos, mv)?;
            Some(BookMove {
                uci: UciMove::from_standard(m).to_string(),
                san: San::from_move(&pos, m).to_string(),
                weight,
            })
        })
        .collect();
    moves.sort_by_key(|m| std::cmp::Reverse(m.weight));
    Ok(moves)
}

#[tauri::command]
pub fn book_list<R: Runtime>(app: AppHandle<R>) -> Result<Vec<String>, String> {
    let mut names: Vec<String> = std::fs::read_dir(books_dir(&app)?)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok()?.file_name().into_string().ok())
        .filter(|name| name.to_ascii_lowercase().ends_with(".bin"))
        .collect();
    names.sort();
    Ok(names)
}

/// Copies a Polyglot book picked with the native dialog into the Books folder; its name, or
/// None if cancelled.
#[tauri::command]
pub async fn book_import<R: Runtime>(app: AppHandle<R>) -> Result<Option<String>, String> {
    let picker = app.clone();
    let picked = tauri::async_runtime::spawn_blocking(move || {
        picker
            .dialog()
            .file()
            .set_title("Import a Polyglot opening book")
            .add_filter("Polyglot book", &["bin"])
            .blocking_pick_file()
    })
    .await
    .map_err(|e| e.to_string())?;
    let Some(source) = picked.and_then(|p| p.into_path().ok()) else {
        return Ok(None);
    };
    let name = source
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Unreadable file name")?
        .to_string();
    let len = std::fs::metadata(&source).map_err(|e| e.to_string())?.len();
    if len == 0 || len % ENTRY_SIZE != 0 {
        return Err(format!("{name} is not a Polyglot book"));
    }
    std::fs::copy(&source, book_path(&app, &name)?).map_err(|e| e.to_string())?;
    Ok(Some(name))
}

#[tauri::command]
pub fn book_remove<R: Runtime>(app: AppHandle<R>, name: String) -> Result<(), String> {
    std::fs::remove_file(book_path(&app, &name)?).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn book_moves<R: Runtime>(
    app: AppHandle<R>,
    name: String,
    fen: String,
) -> Result<Vec<BookMove>, String> {
    let path = book_path(&app, &name)?;
    tauri::async_runtime::spawn_blocking(move || moves_in(&path, &fen))
        .await
        .map_err(|e| e.to_string())?
}

// #region making a book from games (P1.7)

/// What a book is made of: games where both players are rated `min_elo` or more (0 takes every
/// game, rated or not), their first `plies` moves, and the moves played in at least
/// `min_games` of them.
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildOptions {
    pub min_elo: u32,
    pub plies: usize,
    pub min_games: u32,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BuildResult {
    /// The new book's file name in the Books folder
    name: String,
    /// Games read, and those that met the conditions
    games: u64,
    used: u64,
    /// Moves in the book
    entries: u64,
}

#[derive(Clone, Serialize)]
#[serde(tag = "event", content = "data", rename_all = "camelCase")]
pub enum BuildEvent {
    #[serde(rename_all = "camelCase")]
    Progress {
        games: u64,
        used: u64,
        bytes: u64,
        total_bytes: u64,
    },
}

/// A move in Polyglot's 16 bits: to, from, promotion (castling as the king taking its rook).
fn encode(m: &Move) -> Option<u16> {
    let (from, to, promotion) = polyglot_parts(m)?;
    let promotion = match promotion {
        None => 0,
        Some(Role::Knight) => 1,
        Some(Role::Bishop) => 2,
        Some(Role::Rook) => 3,
        Some(Role::Queen) => 4,
        Some(_) => return None,
    };
    Some((promotion << 12) | ((u32::from(from) as u16) << 6) | u32::from(to) as u16)
}

#[derive(Default)]
struct BookTags {
    elos: [Option<u32>; 2],
    /// A set-up position or a variant: not an opening from the start
    skip: bool,
    /// White's points from the Result tag: 2 a win, 1 a draw, 0 a loss
    white_points: Option<u32>,
}

struct BookGame {
    pos: Chess,
    /// (position key, move) of each move played, with the side that played it
    moves: Vec<(u64, u16, shakmaty::Color)>,
    white_points: Option<u32>,
}

/// One game's opening moves and White's points, or None for a game that does not count.
type GameMoves = Option<(Vec<(u64, u16, shakmaty::Color)>, Option<u32>)>;

struct Collector {
    options: BuildOptions,
}

impl Visitor for Collector {
    type Tags = BookTags;
    type Movetext = BookGame;
    type Output = GameMoves;

    fn begin_tags(&mut self) -> ControlFlow<Self::Output, Self::Tags> {
        ControlFlow::Continue(BookTags::default())
    }

    fn tag(
        &mut self,
        tags: &mut BookTags,
        name: &[u8],
        value: RawTag<'_>,
    ) -> ControlFlow<Self::Output> {
        let value = value.decode_utf8_lossy();
        match name {
            b"WhiteElo" => tags.elos[0] = value.parse().ok(),
            b"BlackElo" => tags.elos[1] = value.parse().ok(),
            b"FEN" | b"SetUp" => tags.skip = true,
            b"Variant" => tags.skip |= !value.eq_ignore_ascii_case("standard"),
            b"Result" => {
                tags.white_points = match value.as_ref() {
                    "1-0" => Some(2),
                    "1/2-1/2" => Some(1),
                    "0-1" => Some(0),
                    _ => None,
                }
            }
            _ => {}
        }
        ControlFlow::Continue(())
    }

    fn begin_movetext(&mut self, tags: BookTags) -> ControlFlow<Self::Output, Self::Movetext> {
        let min = self.options.min_elo;
        let rated = tags.elos.iter().all(|e| e.is_some_and(|e| e >= min));
        if tags.skip || (min > 0 && !rated) {
            return ControlFlow::Break(None);
        }
        ControlFlow::Continue(BookGame {
            pos: Chess::default(),
            moves: Vec::new(),
            white_points: tags.white_points,
        })
    }

    fn san(&mut self, g: &mut BookGame, san_plus: SanPlus) -> ControlFlow<Self::Output> {
        let Ok(mv) = san_plus.san.to_move(&g.pos) else {
            // an illegal move: what came before still counts
            return ControlFlow::Break(Some((std::mem::take(&mut g.moves), g.white_points)));
        };
        let key = g.pos.zobrist_hash::<Zobrist64>(EnPassantMode::Legal).0;
        if let Some(code) = encode(&mv) {
            g.moves.push((key, code, g.pos.turn()));
        }
        g.pos.play_unchecked(mv);
        if g.moves.len() >= self.options.plies {
            return ControlFlow::Break(Some((std::mem::take(&mut g.moves), g.white_points)));
        }
        ControlFlow::Continue(())
    }

    fn begin_variation(&mut self, _g: &mut BookGame) -> ControlFlow<Self::Output, Skip> {
        ControlFlow::Continue(Skip(true))
    }

    fn end_game(&mut self, g: BookGame) -> Self::Output {
        Some((g.moves, g.white_points))
    }
}

/// A book entry: position key, move, weight
type Entry = (u64, u16, u16);

/// The book's entries (key, move, weight), sorted as Polyglot wants them: by key, then by
/// weight, heaviest first. The weight is Polyglot's usual 2 × wins + draws for the side that
/// played the move (a move that only lost weighs 0: to be avoided), scaled into 16 bits.
/// `progress(games, used)` is called every thousand games. Also returns the games read and
/// those that met the conditions.
fn build_entries(
    input: impl Read,
    options: BuildOptions,
    mut progress: impl FnMut(u64, u64),
) -> Result<(Vec<Entry>, u64, u64), String> {
    let mut counts: HashMap<(u64, u16), (u32, u32)> = HashMap::new();
    let (mut games, mut used) = (0u64, 0u64);
    let mut reader = Reader::new(input);
    let mut collector = Collector { options };
    while let Some(game) = reader
        .read_game(&mut collector)
        .map_err(|e| e.to_string())?
    {
        games += 1;
        if let Some((moves, white_points)) = game {
            if !moves.is_empty() {
                used += 1;
            }
            for (key, mv, side) in moves {
                let points = white_points.map_or(0, |p| if side.is_white() { p } else { 2 - p });
                let entry = counts.entry((key, mv)).or_default();
                entry.0 += 1;
                entry.1 += points;
            }
        }
        if games % 1000 == 0 {
            progress(games, used);
        }
    }
    progress(games, used);
    let kept: Vec<_> = counts
        .into_iter()
        .filter(|(_, (n, _))| *n >= options.min_games)
        .collect();
    let max = kept.iter().map(|(_, (_, p))| *p).max().unwrap_or(0);
    let scale = |p: u32| {
        if max <= u32::from(u16::MAX) {
            p as u16
        } else {
            (u64::from(p) * u64::from(u16::MAX) / u64::from(max)) as u16
        }
    };
    let mut entries: Vec<Entry> = kept
        .into_iter()
        .map(|((key, mv), (_, points))| (key, mv, scale(points)))
        .collect();
    entries.sort_by(|a, b| a.0.cmp(&b.0).then(b.2.cmp(&a.2)).then(a.1.cmp(&b.1)));
    Ok((entries, games, used))
}

fn write_book(path: &Path, entries: &[Entry]) -> Result<(), String> {
    let mut bytes = Vec::with_capacity(entries.len() * ENTRY_SIZE as usize);
    for (key, mv, weight) in entries {
        bytes.extend_from_slice(&key.to_be_bytes());
        bytes.extend_from_slice(&mv.to_be_bytes());
        bytes.extend_from_slice(&weight.to_be_bytes());
        bytes.extend_from_slice(&0u32.to_be_bytes());
    }
    // written beside it first: a book cut short by a failure is never left in the folder
    let partial = path.with_extension("bin.part");
    std::fs::write(&partial, bytes).map_err(|e| e.to_string())?;
    std::fs::rename(&partial, path).map_err(|e| e.to_string())
}

fn build_file(
    source: &Path,
    out: &Path,
    options: BuildOptions,
    on_event: Channel<BuildEvent>,
) -> Result<BuildResult, String> {
    let file = File::open(source).map_err(|e| format!("{}: {e}", source.display()))?;
    let total_bytes = file.metadata().map(|m| m.len()).unwrap_or(0);
    let count = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0));
    let counted = Counting::new(file, count.clone());
    let input: Box<dyn Read> = if source.extension().is_some_and(|e| e == "zst") {
        Box::new(zstd::Decoder::new(counted).map_err(|e| e.to_string())?)
    } else {
        Box::new(counted)
    };
    let (entries, games, used) = build_entries(input, options, |games, used| {
        let _ = on_event.send(BuildEvent::Progress {
            games,
            used,
            bytes: count.load(std::sync::atomic::Ordering::Relaxed),
            total_bytes,
        });
    })?;
    if entries.is_empty() {
        return Err(format!(
            "No move was played in {} of the {used} games that met the conditions (of {games}): \
             try a lower rating or more games",
            options.min_games
        ));
    }
    write_book(out, &entries)?;
    Ok(BuildResult {
        name: out
            .file_name()
            .map_or_else(String::new, |n| n.to_string_lossy().to_string()),
        games,
        used,
        entries: entries.len() as u64,
    })
}

/// Asks for a PGN file (.pgn or .pgn.zst, e.g. a Lichess database month) and makes a book of
/// its games in the Books folder, named after the file, reporting progress. None if cancelled.
#[tauri::command]
pub async fn book_build<R: Runtime>(
    app: AppHandle<R>,
    options: BuildOptions,
    on_event: Channel<BuildEvent>,
) -> Result<Option<BuildResult>, String> {
    let picker = app.clone();
    let picked = tauri::async_runtime::spawn_blocking(move || {
        picker
            .dialog()
            .file()
            .set_title("Make an opening book from games")
            .add_filter("PGN", &["pgn", "zst"])
            .blocking_pick_file()
    })
    .await
    .map_err(|e| e.to_string())?;
    let Some(source) = picked.and_then(|p| p.into_path().ok()) else {
        return Ok(None);
    };
    let stem = source
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Unreadable file name")?
        .trim_end_matches(".zst")
        .trim_end_matches(".pgn")
        .to_string();
    let out = book_path(&app, &format!("{stem}-{}.bin", options.min_elo))?;
    tauri::async_runtime::spawn_blocking(move || build_file(&source, &out, options, on_event))
        .await
        .map_err(|e| e.to_string())?
        .map(Some)
}

// #endregion

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    const START: &str = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const CASTLING: &str = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1";

    fn key(fen: &str) -> u64 {
        let pos: Chess = Fen::from_ascii(fen.as_bytes())
            .unwrap()
            .into_position(CastlingMode::Standard)
            .unwrap();
        pos.zobrist_hash::<Zobrist64>(EnPassantMode::Legal).0
    }

    fn encode(from: Square, to: Square, promotion: u16) -> u16 {
        (promotion << 12) | ((u32::from(from) as u16) << 6) | u32::from(to) as u16
    }

    /// A book with the given (fen, move, weight) entries, sorted by key as Polyglot requires.
    fn book(entries: &[(&str, u16, u16)]) -> PathBuf {
        let mut rows: Vec<(u64, u16, u16)> = entries
            .iter()
            .map(|(fen, mv, w)| (key(fen), *mv, *w))
            .collect();
        rows.sort();
        let path = std::env::temp_dir().join(format!(
            "plybook-book-{}-{}.bin",
            std::process::id(),
            rows.len()
        ));
        let mut file = File::create(&path).unwrap();
        for (k, mv, w) in rows {
            file.write_all(&k.to_be_bytes()).unwrap();
            file.write_all(&mv.to_be_bytes()).unwrap();
            file.write_all(&w.to_be_bytes()).unwrap();
            file.write_all(&0u32.to_be_bytes()).unwrap();
        }
        path
    }

    #[test]
    fn uses_the_polyglot_keys() {
        // reference values from the Polyglot book format description
        assert_eq!(key(START), 0x463b_9618_1691_fc9c);
        assert_eq!(
            key("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"),
            0x823c_9b50_fd11_4196
        );
    }

    #[test]
    fn finds_the_moves_of_a_position_by_weight() {
        let path = book(&[
            (START, encode(Square::D2, Square::D4, 0), 5),
            (START, encode(Square::E2, Square::E4, 0), 10),
            (CASTLING, encode(Square::E1, Square::H1, 0), 3),
            // a broken entry: no piece can make this move
            (START, encode(Square::E5, Square::E6, 0), 99),
        ]);
        let moves = moves_in(&path, START).unwrap();
        assert_eq!(
            moves,
            [
                BookMove {
                    uci: "e2e4".into(),
                    san: "e4".into(),
                    weight: 10
                },
                BookMove {
                    uci: "d2d4".into(),
                    san: "d4".into(),
                    weight: 5
                },
            ]
        );
        // castling is stored as king takes rook, shown as the king's move
        let castle = moves_in(&path, CASTLING).unwrap();
        assert_eq!(
            (castle[0].uci.as_str(), castle[0].san.as_str()),
            ("e1g1", "O-O")
        );
        // positions the book does not know
        assert!(moves_in(&path, "8/8/8/8/8/8/8/K6k w - - 0 1")
            .unwrap()
            .is_empty());
        let _ = std::fs::remove_file(&path);
    }

    /// A real book (e.g. python-chess's data/polyglot/performance.bin):
    /// Makes a book from a real PGN (a Lichess month, .pgn or .pgn.zst) and prints what it holds:
    /// PLYBOOK_BENCH_PGN=/path/games.pgn PLYBOOK_BENCH_ELO=2000 \
    ///   cargo test --release --lib real_games -- --ignored --nocapture
    /// The book is left in the temporary folder, for `real_book` below.
    #[test]
    #[ignore]
    fn real_games() {
        let source = PathBuf::from(std::env::var("PLYBOOK_BENCH_PGN").expect("PLYBOOK_BENCH_PGN"));
        let min_elo = std::env::var("PLYBOOK_BENCH_ELO").map_or(2000, |e| e.parse().unwrap());
        let file = File::open(&source).unwrap();
        let input: Box<dyn Read> = if source.extension().is_some_and(|e| e == "zst") {
            Box::new(zstd::Decoder::new(file).unwrap())
        } else {
            Box::new(file)
        };
        let started = std::time::Instant::now();
        let (entries, games, used) = build_entries(input, options(min_elo, 5), |_, _| {}).unwrap();
        let path = std::env::temp_dir().join("plybook-real-games.bin");
        write_book(&path, &entries).unwrap();
        eprintln!(
            "{games} games, {used} rated {min_elo}+, {} moves, {} KB, {:.1} s -> {}",
            entries.len(),
            entries.len() * 16 / 1024,
            started.elapsed().as_secs_f64(),
            path.display()
        );
        let start = moves_in(&path, START).unwrap();
        eprintln!(
            "start: {:?}",
            start.iter().map(|m| (&m.san, m.weight)).collect::<Vec<_>>()
        );
    }

    /// PLYBOOK_BENCH_BOOK=/path/book.bin cargo test --lib real_book -- --ignored --nocapture
    #[test]
    #[ignore]
    fn real_book() {
        let path = PathBuf::from(std::env::var("PLYBOOK_BENCH_BOOK").expect("PLYBOOK_BENCH_BOOK"));
        let start = moves_in(&path, START).unwrap();
        eprintln!(
            "start: {:?}",
            start.iter().map(|m| (&m.san, m.weight)).collect::<Vec<_>>()
        );
        assert!(!start.is_empty());
        // Ruy Lopez, 4... Nf6: castling is the main move
        let ruy = "r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 5";
        let moves = moves_in(&path, ruy).unwrap();
        eprintln!(
            "ruy: {:?}",
            moves.iter().map(|m| (&m.san, m.weight)).collect::<Vec<_>>()
        );
        assert!(moves.iter().any(|m| m.san == "O-O" && m.uci == "e1g1"));
    }

    #[test]
    fn decodes_promotions() {
        let fen = "8/4P3/8/8/8/8/8/K6k w - - 0 1";
        let path = book(&[(fen, encode(Square::E7, Square::E8, 1), 1)]);
        let moves = moves_in(&path, fen).unwrap();
        assert_eq!(
            (moves[0].uci.as_str(), moves[0].san.as_str()),
            ("e7e8n", "e8=N")
        );
        let _ = std::fs::remove_file(&path);
    }

    const GAMES: &str = r#"[White "A"]
[Black "B"]
[WhiteElo "2300"]
[BlackElo "2250"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0

[White "C"]
[Black "D"]
[WhiteElo "2400"]
[BlackElo "2350"]
[Result "1/2-1/2"]

1. e4 e5 2. Nf3 Nf6 1/2-1/2

[White "E"]
[Black "F"]
[WhiteElo "2200"]
[BlackElo "2210"]
[Result "0-1"]

1. d4 d5 2. O-O-O 0-1

[White "Weak"]
[Black "Player"]
[WhiteElo "1200"]
[BlackElo "1300"]
[Result "1-0"]

1. e4 c5 1-0

[FEN "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"]
[SetUp "1"]
[WhiteElo "2500"]
[BlackElo "2500"]
[Result "1-0"]

1. e4 1-0
"#;

    fn options(min_elo: u32, min_games: u32) -> BuildOptions {
        BuildOptions {
            min_elo,
            plies: 24,
            min_games,
        }
    }

    #[test]
    fn makes_a_book_from_games() {
        let (entries, games, used) =
            build_entries(GAMES.as_bytes(), options(2000, 1), |_, _| {}).unwrap();
        // the weak game and the set-up position are left out; the illegal O-O-O ends its game
        assert_eq!((games, used), (5, 3));
        let path = std::env::temp_dir().join(format!("plybook-made-{}.bin", std::process::id()));
        write_book(&path, &entries).unwrap();
        let start = moves_in(&path, START).unwrap();
        // e4: a win and a draw for White (2 + 1); d4: a loss (0), there to be avoided
        assert_eq!(
            start
                .iter()
                .map(|m| (m.san.as_str(), m.weight))
                .collect::<Vec<_>>(),
            vec![("e4", 3), ("d4", 0)]
        );
        // Black's answers are weighted for Black: Nc6 lost (0), Nf6 drew (1)
        let after_nf3 = "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2";
        let answers = moves_in(&path, after_nf3).unwrap();
        assert_eq!(
            answers
                .iter()
                .map(|m| (m.san.as_str(), m.weight))
                .collect::<Vec<_>>(),
            vec![("Nf6", 1), ("Nc6", 0)]
        );
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn keeps_moves_played_often_enough() {
        let (entries, _, _) = build_entries(GAMES.as_bytes(), options(2000, 2), |_, _| {}).unwrap();
        // only 1.e4 (twice), 1...e5 and 2.Nf3 (twice each)
        assert_eq!(entries.len(), 3);
        // with no rating floor the weak game counts too: 1.e4 three times
        let (all, _, used) = build_entries(GAMES.as_bytes(), options(0, 3), |_, _| {}).unwrap();
        assert_eq!(used, 4);
        assert_eq!(all.len(), 1);
    }

    #[test]
    fn castles_as_the_king_taking_its_rook() {
        let mut pos = Chess::default();
        for san in ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"] {
            let m = san.parse::<San>().unwrap().to_move(&pos).unwrap();
            pos.play_unchecked(m);
        }
        let castle = "O-O".parse::<San>().unwrap().to_move(&pos).unwrap();
        assert_eq!(
            super::encode(&castle),
            Some(encode(Square::E1, Square::H1, 0))
        );
    }
}
