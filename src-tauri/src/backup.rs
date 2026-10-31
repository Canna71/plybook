//! Backups of the user's own data (O.6): a zip with the Library, settings, custom themes and
//! the database tables the user created (puzzle weights, history, puzzle attempts, repertoire
//! training). Bulk data that can be imported again (game databases and their position index,
//! the Lichess puzzle set) stays out, and so do engines: `Engines/engines.json` names
//! executables the app may run, which a backup file must never be able to add.
//!
//! Automatic backups (once a day, the last seven kept) skip PDFs; "Back up now" includes them
//! and the opening books. Restoring first makes an automatic-style backup of the current data,
//! then replaces the tables, overwrites and adds files (files not in the backup are kept).

use crate::db::{migrate, Database};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_dialog::DialogExt;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

const BACKUPS: &str = "Backups";
const MANIFEST: &str = "rechess-backup.json";
const DATA: &str = "data.sqlite";
const SETTINGS: &str = "settings.json";
const BOOKS: &str = "Books";
/// The user's own tables; everything else in the database can be imported again.
const USER_TABLES: [&str; 5] = [
    "puzzles",
    "history",
    "puzzle_attempts",
    "repertoires",
    "repertoire_cards",
];
/// Folders of the app's data folder that are backed up.
const FOLDERS: [&str; 3] = ["Library", "Themes", "History"];
const FORMAT: u32 = 1;
/// Automatic backups kept.
const KEEP_AUTO: usize = 7;
/// An automatic backup is made when the last one is older than this.
const AUTO_EVERY: std::time::Duration = std::time::Duration::from_secs(20 * 3600);

#[derive(Serialize, Deserialize)]
struct Manifest {
    format: u32,
    created: String,
    tables: Vec<String>,
    /// PDFs and opening books are in it
    full: bool,
}

#[derive(Serialize)]
pub struct RestoreReport {
    files: usize,
    /// The backup of the data as it was before restoring
    before: String,
}

/// The app's folders a backup reads from and restores to.
struct Dirs {
    data: PathBuf,
    config: PathBuf,
}

impl Dirs {
    fn of<R: Runtime>(app: &AppHandle<R>) -> Result<Self, String> {
        let path = app.path();
        Ok(Dirs {
            data: path.app_local_data_dir().map_err(|e| e.to_string())?,
            config: path.app_config_dir().map_err(|e| e.to_string())?,
        })
    }

    fn backups(&self) -> Result<PathBuf, String> {
        let dir = self.data.join(BACKUPS);
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        Ok(dir)
    }
}

fn stamp() -> String {
    chrono::Local::now().format("%Y-%m-%d-%H%M%S").to_string()
}

/// Copies the user's tables into a new database file at `dest`, with the current schema.
fn snapshot_tables(conn: &Connection, dest: &Path) -> Result<(), String> {
    let _ = fs::remove_file(dest);
    migrate(&Connection::open(dest).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    conn.execute(
        "ATTACH DATABASE ?1 AS snapshot",
        [dest.to_string_lossy().as_ref()],
    )
    .map_err(|e| e.to_string())?;
    let copied = USER_TABLES.iter().try_for_each(|t| {
        conn.execute(
            &format!("INSERT INTO snapshot.{t} SELECT * FROM main.{t}"),
            [],
        )
        .map(|_| ())
    });
    let detached = conn.execute("DETACH DATABASE snapshot", []);
    copied.map_err(|e| e.to_string())?;
    detached.map_err(|e| e.to_string())?;
    Ok(())
}

/// Replaces the user's tables with those of the database file at `source` (brought up to
/// the current schema first), in one transaction.
fn restore_tables(conn: &Connection, source: &Path) -> Result<(), String> {
    migrate(&Connection::open(source).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    conn.execute(
        "ATTACH DATABASE ?1 AS restored",
        [source.to_string_lossy().as_ref()],
    )
    .map_err(|e| e.to_string())?;
    let replaced = (|| -> rusqlite::Result<()> {
        let tx = conn.unchecked_transaction()?;
        // children before parents, in case of foreign keys
        for t in USER_TABLES.iter().rev() {
            tx.execute(&format!("DELETE FROM main.{t}"), [])?;
        }
        for t in USER_TABLES {
            tx.execute(
                &format!("INSERT INTO main.{t} SELECT * FROM restored.{t}"),
                [],
            )?;
        }
        tx.commit()
    })();
    let detached = conn.execute("DETACH DATABASE restored", []);
    replaced.map_err(|e| e.to_string())?;
    detached.map_err(|e| e.to_string())?;
    Ok(())
}

fn is_pdf(path: &Path) -> bool {
    path.extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("pdf"))
}

/// Adds a folder to the zip under `name`, recursively; `skip` leaves files out.
fn zip_dir<W: Write + io::Seek>(
    zip: &mut ZipWriter<W>,
    dir: &Path,
    name: &str,
    skip: &dyn Fn(&Path) -> bool,
) -> Result<(), String> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Ok(()); // a folder that does not exist yet
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Some(file_name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if file_name == ".DS_Store" {
            continue;
        }
        let entry_name = format!("{name}/{file_name}");
        if path.is_dir() {
            zip_dir(zip, &path, &entry_name, skip)?;
        } else if !skip(&path) {
            zip_file(zip, &path, &entry_name)?;
        }
    }
    Ok(())
}

fn zip_file<W: Write + io::Seek>(
    zip: &mut ZipWriter<W>,
    path: &Path,
    name: &str,
) -> Result<(), String> {
    // PDFs are compressed already
    let method = if is_pdf(path) {
        CompressionMethod::Stored
    } else {
        CompressionMethod::Deflated
    };
    zip.start_file(
        name,
        SimpleFileOptions::default()
            .compression_method(method)
            .large_file(true),
    )
    .map_err(|e| e.to_string())?;
    io::copy(&mut File::open(path).map_err(|e| e.to_string())?, zip)
        .map_err(|e| format!("{}: {e}", path.display()))?;
    Ok(())
}

/// Writes the backup zip at `dest` from the folders and the table snapshot `data`.
fn write_zip(dirs: &Dirs, data: &Path, dest: &Path, full: bool) -> Result<(), String> {
    let partial = dest.with_extension("zip.part");
    let mut zip = ZipWriter::new(File::create(&partial).map_err(|e| e.to_string())?);
    let manifest = Manifest {
        format: FORMAT,
        created: chrono::Local::now().to_rfc3339(),
        tables: USER_TABLES.iter().map(|t| t.to_string()).collect(),
        full,
    };
    zip.start_file(MANIFEST, SimpleFileOptions::default())
        .map_err(|e| e.to_string())?;
    zip.write_all(&serde_json::to_vec_pretty(&manifest).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    zip_file(&mut zip, data, DATA)?;
    let settings = dirs.config.join(SETTINGS);
    if settings.exists() {
        zip_file(&mut zip, &settings, SETTINGS)?;
    }
    let skip_pdfs = |p: &Path| !full && is_pdf(p);
    for folder in FOLDERS {
        zip_dir(&mut zip, &dirs.data.join(folder), folder, &skip_pdfs)?;
    }
    if full {
        zip_dir(&mut zip, &dirs.data.join(BOOKS), BOOKS, &|_| false)?;
    }
    zip.finish().map_err(|e| e.to_string())?;
    fs::rename(&partial, dest).map_err(|e| e.to_string())
}

/// A backup of everything at `dest`; the database is locked only while its tables are copied.
fn create<R: Runtime>(app: &AppHandle<R>, dest: &Path, full: bool) -> Result<(), String> {
    let dirs = Dirs::of(app)?;
    let data = dirs.backups()?.join(format!(".data-{}.sqlite", stamp()));
    {
        let db = app.state::<Database>();
        let guard = db.0.lock().map_err(|e| e.to_string())?;
        snapshot_tables(guard.as_ref().ok_or("Database not initialized")?, &data)?;
    }
    let written = write_zip(&dirs, &data, dest, full);
    let _ = fs::remove_file(&data);
    written
}

/// Only these top-level names are taken from a backup.
fn allowed(path: &Path) -> bool {
    let first = path
        .components()
        .next()
        .and_then(|c| c.as_os_str().to_str())
        .unwrap_or_default();
    matches!(first, MANIFEST | DATA | SETTINGS | BOOKS) || FOLDERS.contains(&first)
}

/// Unpacks a backup into `staging`, refusing anything that is not a Plybook backup and any
/// entry that would land outside it.
fn extract(zip_path: &Path, staging: &Path) -> Result<Manifest, String> {
    let mut zip = ZipArchive::new(File::open(zip_path).map_err(|e| e.to_string())?)
        .map_err(|_| "Not a zip file".to_string())?;
    let manifest: Manifest = {
        let mut entry = zip
            .by_name(MANIFEST)
            .map_err(|_| "Not a Plybook backup".to_string())?;
        let mut text = String::new();
        entry.read_to_string(&mut text).map_err(|e| e.to_string())?;
        serde_json::from_str(&text).map_err(|_| "Not a Plybook backup".to_string())?
    };
    if manifest.format > FORMAT {
        return Err("This backup was made by a newer version of Plybook".into());
    }
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|e| e.to_string())?;
        // enclosed_name rejects absolute paths and "..": nothing escapes the staging folder
        let Some(relative) = entry.enclosed_name() else {
            continue;
        };
        if !allowed(&relative) {
            continue;
        }
        let out = staging.join(&relative);
        if entry.is_dir() {
            fs::create_dir_all(&out).map_err(|e| e.to_string())?;
            continue;
        }
        if let Some(parent) = out.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        io::copy(
            &mut entry,
            &mut File::create(&out).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(manifest)
}

/// Copies the files of `from` into `to`, replacing those with the same name; how many.
fn merge_dir(from: &Path, to: &Path) -> Result<usize, String> {
    let Ok(entries) = fs::read_dir(from) else {
        return Ok(0);
    };
    fs::create_dir_all(to).map_err(|e| e.to_string())?;
    let mut count = 0;
    for entry in entries.flatten() {
        let path = entry.path();
        let target = to.join(entry.file_name());
        if path.is_dir() {
            count += merge_dir(&path, &target)?;
        } else {
            fs::copy(&path, &target).map_err(|e| e.to_string())?;
            count += 1;
        }
    }
    Ok(count)
}

fn restore<R: Runtime>(app: &AppHandle<R>, zip_path: &Path) -> Result<RestoreReport, String> {
    let dirs = Dirs::of(app)?;
    let backups = dirs.backups()?;
    let staging = backups.join(format!(".restore-{}", stamp()));
    let result = (|| {
        extract(zip_path, &staging)?;
        // the data as it is now, restorable the same way
        let before = backups.join(format!("before-restore-{}.zip", stamp()));
        create(app, &before, false)?;

        let staged_data = staging.join(DATA);
        if staged_data.exists() {
            let db = app.state::<Database>();
            let guard = db.0.lock().map_err(|e| e.to_string())?;
            restore_tables(
                guard.as_ref().ok_or("Database not initialized")?,
                &staged_data,
            )?;
        }
        let mut files = 0;
        for folder in FOLDERS.iter().chain([&BOOKS]) {
            files += merge_dir(&staging.join(folder), &dirs.data.join(folder))?;
        }
        let settings = staging.join(SETTINGS);
        if settings.exists() {
            fs::create_dir_all(&dirs.config).map_err(|e| e.to_string())?;
            fs::copy(&settings, dirs.config.join(SETTINGS)).map_err(|e| e.to_string())?;
        }
        Ok(RestoreReport {
            files,
            before: before.to_string_lossy().into_owned(),
        })
    })();
    let _ = fs::remove_dir_all(&staging);
    result
}

/// The automatic backups, newest first.
fn auto_backups(dir: &Path) -> Vec<PathBuf> {
    let mut list: Vec<(std::time::SystemTime, PathBuf)> = fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with("auto-") && n.ends_with(".zip"))
        })
        .filter_map(|p| Some((fs::metadata(&p).ok()?.modified().ok()?, p)))
        .collect();
    list.sort_by_key(|(modified, _)| std::cmp::Reverse(*modified));
    list.into_iter().map(|(_, p)| p).collect()
}

/// Backs up everything (PDFs and opening books too) to a zip the user picks; its path, or
/// None if cancelled.
#[tauri::command]
pub async fn backup_create<R: Runtime>(app: AppHandle<R>) -> Result<Option<String>, String> {
    let picker = app.clone();
    let name = format!(
        "Plybook backup {}.zip",
        chrono::Local::now().format("%Y-%m-%d")
    );
    let picked = tauri::async_runtime::spawn_blocking(move || {
        picker
            .dialog()
            .file()
            .set_title("Back up Plybook")
            .set_file_name(&name)
            .add_filter("Plybook backup", &["zip"])
            .blocking_save_file()
    })
    .await
    .map_err(|e| e.to_string())?;
    let Some(dest) = picked.and_then(|p| p.into_path().ok()) else {
        return Ok(None);
    };
    let worker = app.clone();
    let target = dest.clone();
    tauri::async_runtime::spawn_blocking(move || create(&worker, &target, true))
        .await
        .map_err(|e| e.to_string())??;
    Ok(Some(dest.to_string_lossy().into_owned()))
}

/// Restores a backup the user picks (starting in the Backups folder); None if cancelled.
#[tauri::command]
pub async fn backup_restore<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Option<RestoreReport>, String> {
    let backups = Dirs::of(&app)?.backups()?;
    let picker = app.clone();
    let picked = tauri::async_runtime::spawn_blocking(move || {
        picker
            .dialog()
            .file()
            .set_title("Restore a Plybook backup")
            .set_directory(backups)
            .add_filter("Plybook backup", &["zip"])
            .blocking_pick_file()
    })
    .await
    .map_err(|e| e.to_string())?;
    let Some(source) = picked.and_then(|p| p.into_path().ok()) else {
        return Ok(None);
    };
    let worker = app.clone();
    tauri::async_runtime::spawn_blocking(move || restore(&worker, &source))
        .await
        .map_err(|e| e.to_string())?
        .map(Some)
}

/// The daily automatic backup (no PDFs or books), if the last one is old enough; its path.
/// Keeps the newest seven.
#[tauri::command]
pub async fn backup_auto<R: Runtime>(app: AppHandle<R>) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dir = Dirs::of(&app)?.backups()?;
        let existing = auto_backups(&dir);
        let recent = existing.first().and_then(|p| {
            let age = fs::metadata(p).ok()?.modified().ok()?.elapsed().ok()?;
            Some(age < AUTO_EVERY)
        });
        if recent == Some(true) {
            return Ok(None);
        }
        let dest = dir.join(format!("auto-{}.zip", stamp()));
        create(&app, &dest, false)?;
        for old in auto_backups(&dir).into_iter().skip(KEEP_AUTO) {
            let _ = fs::remove_file(old);
        }
        Ok(Some(dest.to_string_lossy().into_owned()))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn backup_open_folder<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    open::that_detached(Dirs::of(&app)?.backups()?).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("rechess-backup-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// A database with one puzzle of the given weight.
    fn db_with_puzzle(dir: &Path, name: &str, weight: f64) -> Connection {
        let conn = Connection::open(dir.join(name)).unwrap();
        migrate(&conn).unwrap();
        conn.execute(
            "INSERT INTO puzzles (file_path, base_weight, created_at) VALUES ('Library/a.pgn', ?1, 'now')",
            [weight],
        )
        .unwrap();
        conn
    }

    fn weights(conn: &Connection) -> Vec<f64> {
        let mut stmt = conn.prepare("SELECT base_weight FROM puzzles").unwrap();
        stmt.query_map([], |r| r.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect()
    }

    #[test]
    fn tables_round_trip() {
        let dir = temp("tables");
        let live = db_with_puzzle(&dir, "live.sqlite", 300.0);
        snapshot_tables(&live, &dir.join("snap.sqlite")).unwrap();
        // the live data changes; restoring brings the snapshot back
        live.execute("UPDATE puzzles SET base_weight = 500", [])
            .unwrap();
        live.execute(
            "INSERT INTO puzzles (file_path, base_weight, created_at) VALUES ('Library/b.pgn', 1, 'now')",
            [],
        )
        .unwrap();
        restore_tables(&live, &dir.join("snap.sqlite")).unwrap();
        assert_eq!(weights(&live), vec![300.0]);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn zips_and_restores_files_safely() {
        let dir = temp("zip");
        let dirs = Dirs {
            data: dir.join("data"),
            config: dir.join("config"),
        };
        fs::create_dir_all(dirs.data.join("Library/Openings")).unwrap();
        fs::create_dir_all(&dirs.config).unwrap();
        fs::write(dirs.data.join("Library/Openings/italian.pgn"), "1. e4 *").unwrap();
        fs::write(dirs.data.join("Library/book.pdf"), "%PDF").unwrap();
        fs::write(dirs.config.join(SETTINGS), "{}").unwrap();
        let conn = db_with_puzzle(&dir, "live.sqlite", 300.0);
        snapshot_tables(&conn, &dir.join("snap.sqlite")).unwrap();

        let zip = dir.join("auto.zip");
        write_zip(&dirs, &dir.join("snap.sqlite"), &zip, false).unwrap();
        let staging = dir.join("staging");
        let manifest = extract(&zip, &staging).unwrap();
        assert!(!manifest.full);
        assert!(staging.join("Library/Openings/italian.pgn").exists());
        // automatic backups leave PDFs out
        assert!(!staging.join("Library/book.pdf").exists());
        assert!(staging.join(SETTINGS).exists());
        assert!(staging.join(DATA).exists());

        // restoring into a folder keeps files that are not in the backup
        let target = dir.join("restored");
        fs::create_dir_all(&target).unwrap();
        fs::write(target.join("mine.pgn"), "*").unwrap();
        assert_eq!(merge_dir(&staging.join("Library"), &target).unwrap(), 1);
        assert!(target.join("mine.pgn").exists());
        assert!(target.join("Openings/italian.pgn").exists());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn refuses_what_is_not_a_backup_and_entries_outside_it() {
        let dir = temp("evil");
        let zip_path = dir.join("evil.zip");
        let mut zip = ZipWriter::new(File::create(&zip_path).unwrap());
        zip.start_file("hello.txt", SimpleFileOptions::default())
            .unwrap();
        zip.write_all(b"hi").unwrap();
        zip.finish().unwrap();
        assert!(extract(&zip_path, &dir.join("s1")).is_err());

        let mut zip = ZipWriter::new(File::create(&zip_path).unwrap());
        zip.start_file(MANIFEST, SimpleFileOptions::default())
            .unwrap();
        zip.write_all(br#"{"format":1,"created":"","tables":[],"full":false}"#)
            .unwrap();
        zip.start_file("../escaped.txt", SimpleFileOptions::default())
            .unwrap();
        zip.write_all(b"x").unwrap();
        zip.start_file("Engines/engines.json", SimpleFileOptions::default())
            .unwrap();
        zip.write_all(b"{}").unwrap();
        zip.finish().unwrap();
        let staging = dir.join("s2");
        extract(&zip_path, &staging).unwrap();
        assert!(!dir.join("escaped.txt").exists());
        assert!(!staging.join("Engines").exists());
        fs::remove_dir_all(dir).unwrap();
    }
}
