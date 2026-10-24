//! Engine process management and opening library files in the OS.
//!
//! The webview has no shell permissions: it can only ask to start an engine by
//! file name, and only binaries inside `<AppLocalData>/Engines` can be started.
//! The webview's fs scope denies access to that folder, so it cannot plant one.

use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, Runtime, State};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

pub const ENGINES_FOLDER: &str = "Engines";
pub const LIBRARY_FOLDER: &str = "Library";

#[derive(Default)]
pub struct EngineProcesses(Mutex<HashMap<u32, CommandChild>>);

#[derive(Clone, Serialize)]
#[serde(tag = "event", content = "data", rename_all = "camelCase")]
pub enum EngineEvent {
    Stdout(String),
    Stderr(String),
    Error(String),
    Terminated { code: Option<i32> },
}

fn app_local_dir<R: Runtime>(app: &AppHandle<R>, folder: &str) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|dir| dir.join(folder))
        .map_err(|e| e.to_string())
}

/// Resolves `relative` inside `root`, rejecting anything that escapes it (`..`, symlinks).
fn resolve_inside(root: &Path, relative: &str) -> Result<PathBuf, String> {
    let root = root.canonicalize().map_err(|e| e.to_string())?;
    let path = root
        .join(relative)
        .canonicalize()
        .map_err(|e| format!("{relative}: {e}"))?;
    if !path.starts_with(&root) {
        return Err(format!("{relative} is outside {}", root.display()));
    }
    Ok(path)
}

pub fn ensure_engines_folder<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    std::fs::create_dir_all(app_local_dir(app, ENGINES_FOLDER)?).map_err(|e| e.to_string())
}

/// File names of the engines in the Engines folder, sorted, hidden files skipped.
#[tauri::command]
pub fn engine_list<R: Runtime>(app: AppHandle<R>) -> Result<Vec<String>, String> {
    let dir = app_local_dir(&app, ENGINES_FOLDER)?;
    let mut names: Vec<String> = std::fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().is_file())
        .filter_map(|entry| entry.file_name().into_string().ok())
        .filter(|name| !name.starts_with('.'))
        .collect();
    names.sort();
    Ok(names)
}

/// Starts the engine `name` from the Engines folder and streams its output to `on_event`.
/// Returns the process id used by `engine_write` and `engine_kill`.
#[tauri::command]
pub fn engine_spawn<R: Runtime>(
    app: AppHandle<R>,
    processes: State<'_, EngineProcesses>,
    name: String,
    on_event: Channel<EngineEvent>,
) -> Result<u32, String> {
    if name.is_empty() || name.contains(['/', '\\']) || name == "." || name == ".." {
        return Err(format!("invalid engine name: {name}"));
    }
    let dir = app_local_dir(&app, ENGINES_FOLDER)?;
    let path = resolve_inside(&dir, &name)?;
    if !path.is_file() {
        return Err(format!("{name} is not a file"));
    }

    let (mut rx, child) = app
        .shell()
        .command(&path)
        .current_dir(&dir)
        .spawn()
        .map_err(|e| format!("cannot start {name}: {e}"))?;
    let pid = child.pid();
    processes.0.lock().unwrap().insert(pid, child);

    tauri::async_runtime::spawn(async move {
        let text = |bytes: Vec<u8>| {
            String::from_utf8_lossy(&bytes)
                .trim_end_matches(['\r', '\n'])
                .to_string()
        };
        while let Some(event) = rx.recv().await {
            let event = match event {
                CommandEvent::Stdout(bytes) => EngineEvent::Stdout(text(bytes)),
                CommandEvent::Stderr(bytes) => EngineEvent::Stderr(text(bytes)),
                CommandEvent::Error(err) => EngineEvent::Error(err),
                CommandEvent::Terminated(payload) => {
                    app.state::<EngineProcesses>().0.lock().unwrap().remove(&pid);
                    EngineEvent::Terminated { code: payload.code }
                }
                _ => continue,
            };
            if on_event.send(event).is_err() {
                break;
            }
        }
    });

    Ok(pid)
}

#[tauri::command]
pub fn engine_write(
    processes: State<'_, EngineProcesses>,
    pid: u32,
    data: String,
) -> Result<(), String> {
    let mut processes = processes.0.lock().unwrap();
    let child = processes
        .get_mut(&pid)
        .ok_or_else(|| format!("no engine with pid {pid}"))?;
    child.write(data.as_bytes()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn engine_kill(processes: State<'_, EngineProcesses>, pid: u32) -> Result<(), String> {
    match processes.0.lock().unwrap().remove(&pid) {
        Some(child) => child.kill().map_err(|e| e.to_string()),
        None => Ok(()),
    }
}

/// Opens a Library folder or PGN file with the OS default application.
/// `path` is relative to AppLocalData, as used by the file browser.
#[tauri::command]
pub fn open_library_path<R: Runtime>(app: AppHandle<R>, path: String) -> Result<(), String> {
    let base = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    let library = app_local_dir(&app, LIBRARY_FOLDER)?;
    let full = resolve_inside(&base, &path)?;
    if !full.starts_with(library.canonicalize().map_err(|e| e.to_string())?) {
        return Err(format!("{path} is not in the library"));
    }
    let is_pgn = full
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("pgn"));
    let is_bundle = full
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("app"));
    // only folders and PGN files: opening anything else could launch a program
    if !((full.is_dir() && !is_bundle) || (full.is_file() && is_pgn)) {
        return Err(format!("{path} is not a folder or a PGN file"));
    }
    open::that_detached(&full).map_err(|e| e.to_string())
}
