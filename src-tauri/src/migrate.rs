// One-time move of user data from the folders named after older bundle identifiers to the ones
// named after the current identifier: first "rechess", then "com.canna71.rechess" until the
// rename to Plybook (F.18). The database file is renamed with it.

use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager, Runtime};

/// Older identifiers, newest first: an entry found in two of them comes from the newer one.
const OLD_IDENTIFIERS: [&str; 2] = ["com.canna71.rechess", "rechess"];
/// The database file before the rename (db.rs names the current one), with SQLite's WAL files
const OLD_DB: &str = "rechess.sqlite";
const DB_SUFFIXES: [&str; 3] = ["", "-wal", "-shm"];

/// Moves each entry of `old_dir` into `new_dir` unless `new_dir` already has an
/// entry with the same name, then removes `old_dir` if it ended up empty.
fn move_entries(old_dir: &Path, new_dir: &Path) -> std::io::Result<()> {
    fs::create_dir_all(new_dir)?;
    for entry in fs::read_dir(old_dir)? {
        let entry = entry?;
        let target = new_dir.join(entry.file_name());
        if target.exists() {
            eprintln!(
                "Not migrating {}: {} already exists",
                entry.path().display(),
                target.display()
            );
            continue;
        }
        if let Err(e) = fs::rename(entry.path(), &target) {
            eprintln!("Failed to move {}: {}", entry.path().display(), e);
        }
    }
    // Only succeeds if nothing was left behind.
    let _ = fs::remove_dir(old_dir);
    Ok(())
}

/// The old database file takes the current name, unless a database of that name exists.
fn rename_database(dir: &Path, db_file: &str) {
    if dir.join(db_file).exists() || !dir.join(OLD_DB).exists() {
        return;
    }
    for suffix in DB_SUFFIXES {
        let old = dir.join(format!("{OLD_DB}{suffix}"));
        if old.exists() {
            if let Err(e) = fs::rename(&old, dir.join(format!("{db_file}{suffix}"))) {
                eprintln!("Failed to rename {}: {}", old.display(), e);
            }
        }
    }
}

/// Moves the old identifiers' folders (beside `new_dir`) into it, and renames the database.
fn migrate_into(new_dir: &Path, db_file: &str) {
    for old in OLD_IDENTIFIERS {
        let Some(old_dir) = new_dir.parent().map(|p| p.join(old)) else {
            continue;
        };
        if old_dir == new_dir || !old_dir.is_dir() {
            continue;
        }
        if let Err(e) = move_entries(&old_dir, new_dir) {
            eprintln!(
                "Failed to migrate data from {} to {}: {}",
                old_dir.display(),
                new_dir.display(),
                e
            );
        }
    }
    rename_database(new_dir, db_file);
}

pub fn migrate_legacy_data<R: Runtime>(app: &AppHandle<R>) {
    let path = app.path();
    let mut dirs: Vec<PathBuf> = [
        path.app_local_data_dir(),
        path.app_data_dir(),
        path.app_config_dir(),
    ]
    .into_iter()
    .flatten()
    .collect();
    // On macOS all three are the same folder.
    dirs.sort();
    dirs.dedup();

    for new_dir in dirs {
        migrate_into(&new_dir, crate::db::DB_FILE);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "plybook-migrate-test-{name}-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn moves_the_old_identifiers_data_and_renames_the_database() {
        let root = temp_root("move");
        let old = root.join("com.canna71.rechess");
        fs::create_dir_all(old.join("Library/Openings")).unwrap();
        fs::write(old.join("Library/Openings/italian.pgn"), "1. e4 *").unwrap();
        fs::write(old.join("rechess.sqlite"), "db").unwrap();
        fs::write(old.join("rechess.sqlite-wal"), "wal").unwrap();
        // from the identifier before that: only what the newer one does not have
        let older = root.join("rechess");
        fs::create_dir_all(older.join("Library")).unwrap();
        fs::write(older.join("settings.json"), "{}").unwrap();

        let new = root.join("com.canna71.plybook");
        migrate_into(&new, "plybook.sqlite");

        assert_eq!(
            fs::read_to_string(new.join("Library/Openings/italian.pgn")).unwrap(),
            "1. e4 *"
        );
        assert_eq!(
            fs::read_to_string(new.join("plybook.sqlite")).unwrap(),
            "db"
        );
        assert_eq!(
            fs::read_to_string(new.join("plybook.sqlite-wal")).unwrap(),
            "wal"
        );
        assert!(!new.join("rechess.sqlite").exists());
        assert!(new.join("settings.json").exists());
        assert!(!old.exists());
        // its Library was not moved over the newer one: the folder stays with it
        assert!(older.join("Library").exists());
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn keeps_a_database_already_there() {
        let root = temp_root("keep");
        let new = root.join("com.canna71.plybook");
        fs::create_dir_all(&new).unwrap();
        fs::write(new.join("plybook.sqlite"), "current").unwrap();
        fs::write(new.join("rechess.sqlite"), "old").unwrap();
        migrate_into(&new, "plybook.sqlite");
        assert_eq!(
            fs::read_to_string(new.join("plybook.sqlite")).unwrap(),
            "current"
        );
        assert!(new.join("rechess.sqlite").exists());
        fs::remove_dir_all(&root).unwrap();
    }
}
