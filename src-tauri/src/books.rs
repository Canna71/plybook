//! Opening books in the Polyglot format (.bin): imported into `<AppLocalData>/Books`, read with a
//! binary search on disk so large books cost nothing to open.
//!
//! A book is a sorted list of 16-byte entries: position key (u64, the Polyglot Zobrist hash,
//! which shakmaty's Zobrist64 reproduces), move (u16), weight (u16), learn (u32), big-endian.

use serde::Serialize;
use shakmaty::{
    fen::Fen, san::San, uci::UciMove, zobrist::Zobrist64, CastlingMode, Chess, EnPassantMode, Move,
    Position, Role, Square,
};
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
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
            "rechess-book-{}-{}.bin",
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
    /// RECHESS_BENCH_BOOK=/path/book.bin cargo test --lib real_book -- --ignored --nocapture
    #[test]
    #[ignore]
    fn real_book() {
        let path = PathBuf::from(std::env::var("RECHESS_BENCH_BOOK").expect("RECHESS_BENCH_BOOK"));
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
}
