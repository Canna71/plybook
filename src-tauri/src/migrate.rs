// One-time move of user data from the folders named after the old bundle
// identifier ("rechess") to the ones named after the current identifier.

use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager, Runtime};

const OLD_IDENTIFIER: &str = "rechess";

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
        let Some(old_dir) = new_dir.parent().map(|p| p.join(OLD_IDENTIFIER)) else {
            continue;
        };
        if old_dir == new_dir || !old_dir.is_dir() {
            continue;
        }
        if let Err(e) = move_entries(&old_dir, &new_dir) {
            eprintln!(
                "Failed to migrate data from {} to {}: {}",
                old_dir.display(),
                new_dir.display(),
                e
            );
        }
    }
}
