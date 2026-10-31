//! Files dragged from the Finder (or Explorer) onto the window, copied into the Library.
//!
//! The drop reaches Rust first, as a window event, and its paths are kept here. The webview
//! only says which Library folder they go to (`library_import_dropped`), so it can never name
//! a file outside the Library: it gets the files the user dropped, and only PGN and PDF ones.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, DragDropEvent, Manager, Runtime, State, Window, WindowEvent};

use crate::engine::{app_local_dir, resolve_inside, LIBRARY_FOLDER};

/// The files of the last drop, until a Library folder takes them.
#[derive(Default)]
pub struct DroppedFiles(Mutex<Vec<PathBuf>>);

/// Remembers the paths of files dropped on the window (from `Builder::on_window_event`).
pub fn on_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    if let WindowEvent::DragDrop(DragDropEvent::Drop { paths, .. }) = event {
        if let Some(dropped) = window.try_state::<DroppedFiles>() {
            if let Ok(mut files) = dropped.0.lock() {
                *files = paths.clone();
            }
        }
    }
}

/// PGN games and PDF books: what the Library opens.
fn importable(path: &Path) -> bool {
    path.is_file()
        && path
            .extension()
            .is_some_and(|ext| ext.eq_ignore_ascii_case("pgn") || ext.eq_ignore_ascii_case("pdf"))
}

/// `name.pgn` in `folder`, or `name (1).pgn`, `name (2).pgn`... if taken (as `createNewDataFile`).
fn free_name(folder: &Path, file_name: &str) -> PathBuf {
    let candidate = folder.join(file_name);
    if !candidate.exists() {
        return candidate;
    }
    let path = Path::new(file_name);
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(file_name);
    let ext = path.extension().and_then(|s| s.to_str());
    (1..)
        .map(|i| match ext {
            Some(ext) => folder.join(format!("{stem} ({i}).{ext}")),
            None => folder.join(format!("{stem} ({i})")),
        })
        .find(|p| !p.exists())
        .unwrap_or(candidate)
}

/// Copies the importable files among `files` into `folder`; returns the new paths.
fn copy_into(folder: &Path, files: &[PathBuf]) -> Result<(Vec<PathBuf>, Vec<String>), String> {
    let mut copied = Vec::new();
    let mut skipped = Vec::new();
    for file in files {
        let name = file.file_name().and_then(|n| n.to_str());
        match name {
            Some(name) if importable(file) => {
                let target = free_name(folder, name);
                fs::copy(file, &target).map_err(|e| format!("{name}: {e}"))?;
                copied.push(target);
            }
            _ => skipped.push(
                file.file_name()
                    .map(|n| n.to_string_lossy().into_owned())
                    .unwrap_or_default(),
            ),
        }
    }
    Ok((copied, skipped))
}

#[derive(Serialize)]
pub struct ImportResult {
    /// The new files, relative to the app's data folder ("Library/Openings/Italian.pgn")
    imported: Vec<String>,
    /// Names of dropped files that are not PGN or PDF (folders, images...)
    skipped: Vec<String>,
}

/// Copies the files of the last drop into `folder`, a Library folder relative to the app's
/// data folder (as the webview's paths are).
#[tauri::command]
pub fn library_import_dropped<R: Runtime>(
    app: AppHandle<R>,
    dropped: State<DroppedFiles>,
    folder: String,
) -> Result<ImportResult, String> {
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let library = app_local_dir(&app, LIBRARY_FOLDER)?
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let target = resolve_inside(&base, &folder)?;
    if !target.starts_with(&library) || !target.is_dir() {
        return Err(format!("{folder} is not a Library folder"));
    }
    let files = std::mem::take(&mut *dropped.0.lock().map_err(|e| e.to_string())?);
    let (copied, skipped) = copy_into(&target, &files)?;
    let imported = copied
        .iter()
        .filter_map(|p| p.strip_prefix(&base).ok())
        .map(|p| p.to_string_lossy().into_owned())
        .collect();
    Ok(ImportResult { imported, skipped })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "plybook-library-test-{name}-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn free_name_numbers_taken_names() {
        let dir = temp("names");
        assert_eq!(free_name(&dir, "a.pgn"), dir.join("a.pgn"));
        fs::write(dir.join("a.pgn"), "").unwrap();
        assert_eq!(free_name(&dir, "a.pgn"), dir.join("a (1).pgn"));
        fs::write(dir.join("a (1).pgn"), "").unwrap();
        assert_eq!(free_name(&dir, "a.pgn"), dir.join("a (2).pgn"));
    }

    #[test]
    fn copies_only_games_and_books() {
        let from = temp("from");
        let to = temp("to");
        for name in ["game.pgn", "book.PDF", "photo.png"] {
            fs::write(from.join(name), name).unwrap();
        }
        fs::create_dir(from.join("folder.pgn")).unwrap();
        let files: Vec<PathBuf> = ["game.pgn", "book.PDF", "photo.png", "folder.pgn"]
            .iter()
            .map(|n| from.join(n))
            .collect();
        let (copied, skipped) = copy_into(&to, &files).unwrap();
        assert_eq!(copied, vec![to.join("game.pgn"), to.join("book.PDF")]);
        assert_eq!(skipped, vec!["photo.png", "folder.pgn"]);
        assert_eq!(fs::read_to_string(to.join("game.pgn")).unwrap(), "game.pgn");
        // a second drop of the same file keeps both
        let (again, _) = copy_into(&to, &files[..1]).unwrap();
        assert_eq!(again, vec![to.join("game (1).pgn")]);
    }
}
