//! Engine process management and opening library files in the OS.
//!
//! The webview has no shell permissions: it can only ask to start an engine by
//! profile id. A profile points either at a file inside `<AppLocalData>/Engines`
//! or at an executable the user picked through a native file dialog opened from
//! here. The profiles live in `Engines/engines.json`; the webview's fs scope denies
//! access to that folder, so it can neither plant a binary nor edit the registry.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, Runtime, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

pub const ENGINES_FOLDER: &str = "Engines";
const WEIGHTS_FOLDER: &str = "weights";
const REGISTRY_FILE: &str = "engines.json";
/// Replaced with the absolute path of the Engines folder in arguments.
const ENGINES_PLACEHOLDER: &str = "{engines}";
pub const LIBRARY_FOLDER: &str = "Library";

#[derive(Default)]
pub struct EngineProcesses(Mutex<HashMap<u32, CommandChild>>);

/// Executables the user picked with the file dialog in this session but that are not in a
/// profile yet. `engine_save_profile` accepts an external path only if it is in here or
/// already in the registry, so the webview can never make up a path.
#[derive(Default)]
pub struct ApprovedExecutables(Mutex<HashSet<String>>);

#[derive(Clone, Serialize)]
#[serde(tag = "event", content = "data", rename_all = "camelCase")]
pub enum EngineEvent {
    Stdout(String),
    Stderr(String),
    Error(String),
    #[serde(rename_all = "camelCase")]
    Terminated {
        code: Option<i32>,
        signal: Option<i32>,
    },
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

/// Engines downloaded as archives often lose the execute bit.
#[cfg(unix)]
fn ensure_executable(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    let mut perms = std::fs::metadata(path)
        .map_err(|e| e.to_string())?
        .permissions();
    if perms.mode() & 0o111 == 0 {
        perms.set_mode(perms.mode() | 0o755);
        std::fs::set_permissions(path, perms).map_err(|e| {
            format!(
                "{} is not executable and cannot be made so: {e}",
                path.display()
            )
        })?;
    }
    Ok(())
}

#[cfg(not(unix))]
fn ensure_executable(_path: &Path) -> Result<(), String> {
    Ok(())
}

fn spawn_error_message(name: &str, err: &tauri_plugin_shell::Error) -> String {
    let mut msg = format!("Could not start engine {name}: {err}");
    if cfg!(target_os = "macos") {
        msg.push_str(
            ". If you downloaded this engine, macOS may be blocking it: open it once from Finder \
             (right-click > Open), or allow it in System Settings > Privacy & Security.",
        );
    } else if cfg!(windows) {
        msg.push_str(
            ". Make sure the file is a Windows executable (.exe) and is not blocked by your antivirus.",
        );
    }
    msg
}

pub fn ensure_engines_folder<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    // weights (e.g. Maia nets for Lc0) live in a subfolder so they are not mistaken for engines
    std::fs::create_dir_all(app_local_dir(app, ENGINES_FOLDER)?.join(WEIGHTS_FOLDER))
        .map_err(|e| e.to_string())
}

#[derive(Clone, Serialize, Deserialize)]
pub struct UciOption {
    pub name: String,
    pub value: String,
}

/// How to start an engine and how to talk to it.
#[derive(Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct EngineProfile {
    pub id: String,
    pub name: String,
    /// File name inside the Engines folder, or an absolute path when `external`.
    pub path: String,
    /// Picked by the user with the file dialog; the path can only be set by `engine_add_external`.
    pub external: bool,
    pub args: Vec<String>,
    /// UCI options sent after the handshake, in order.
    pub options: Vec<UciOption>,
    /// Whether `UCI_LimitStrength` / `UCI_Elo` apply (Stockfish yes, Lc0/Maia no).
    pub limit_strength: bool,
    /// Search with `go nodes 1` instead of depth/time (how Maia is meant to be used).
    pub single_node: bool,
    /// Computed on every list: the executable is gone.
    #[serde(skip_deserializing)]
    pub missing: bool,
}

fn engines_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    app_local_dir(app, ENGINES_FOLDER)
}

fn read_registry<R: Runtime>(app: &AppHandle<R>) -> Result<Vec<EngineProfile>, String> {
    let path = engines_dir(app)?.join(REGISTRY_FILE);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let text = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    // an unreadable registry is an error, not an empty list: saving would overwrite it
    serde_json::from_str(&text).map_err(|e| format!("{} is not valid: {e}", path.display()))
}

fn write_registry<R: Runtime>(
    app: &AppHandle<R>,
    profiles: &[EngineProfile],
) -> Result<(), String> {
    let path = engines_dir(app)?.join(REGISTRY_FILE);
    let text = serde_json::to_string_pretty(profiles).map_err(|e| e.to_string())?;
    std::fs::write(&path, text).map_err(|e| e.to_string())
}

fn is_plain_file_name(name: &str) -> bool {
    !(name.is_empty()
        || name.contains(['/', '\\'])
        || name.starts_with('.')
        || name == REGISTRY_FILE)
}

fn file_missing(dir: &Path, profile: &EngineProfile) -> bool {
    if profile.external {
        !Path::new(&profile.path).is_file()
    } else {
        !dir.join(&profile.path).is_file()
    }
}

/// Registered profiles plus a default one for every file dropped in the Engines folder.
fn synced_profiles<R: Runtime>(app: &AppHandle<R>) -> Result<Vec<EngineProfile>, String> {
    let dir = engines_dir(app)?;
    let mut profiles = read_registry(app)?;
    let mut changed = false;

    let mut files: Vec<String> = std::fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().is_file())
        .filter_map(|entry| entry.file_name().into_string().ok())
        .filter(|name| is_plain_file_name(name))
        .collect();
    files.sort();
    for file in files {
        if !profiles.iter().any(|p| !p.external && p.path == file) {
            profiles.push(EngineProfile {
                id: format!("file-{file}"),
                name: file.clone(),
                path: file,
                limit_strength: true,
                ..Default::default()
            });
            changed = true;
        }
    }
    if changed {
        write_registry(app, &profiles)?;
    }
    for profile in &mut profiles {
        profile.missing = file_missing(&dir, profile);
    }
    Ok(profiles)
}

/// The engine profiles, ready to be shown and selected.
#[tauri::command]
pub fn engine_list<R: Runtime>(app: AppHandle<R>) -> Result<Vec<EngineProfile>, String> {
    synced_profiles(&app)
}

/// Creates or updates a profile. The executable of an external profile must be one already picked.
#[tauri::command]
pub fn engine_save_profile<R: Runtime>(
    app: AppHandle<R>,
    approved: State<'_, ApprovedExecutables>,
    mut profile: EngineProfile,
) -> Result<Vec<EngineProfile>, String> {
    profile.name = profile.name.trim().to_string();
    if profile.name.is_empty() {
        return Err("the engine needs a name".to_string());
    }
    if profile.id.is_empty()
        || !profile
            .id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
    {
        return Err(format!("invalid engine id: {}", profile.id));
    }
    synced_profiles(&app)?;
    let mut profiles = read_registry(&app)?;
    let existing = profiles.iter().position(|p| p.id == profile.id);
    if profile.external {
        // the path must come from the file dialog: picked in this session or already saved
        // (a profile may be a copy of another one, e.g. Lc0 with a different net)
        let picked = approved.0.lock().unwrap().contains(&profile.path);
        if !picked
            && !profiles
                .iter()
                .any(|p| p.external && p.path == profile.path)
        {
            return Err(
                "an engine outside the Engines folder can only be added with the file picker"
                    .to_string(),
            );
        }
    } else if !is_plain_file_name(&profile.path) {
        return Err(format!("invalid engine file name: {}", profile.path));
    }
    profile.missing = false;
    match existing {
        Some(i) => profiles[i] = profile,
        None => profiles.push(profile),
    }
    write_registry(&app, &profiles)?;
    synced_profiles(&app)
}

/// Forgets a profile. Never deletes the executable.
#[tauri::command]
pub fn engine_remove_profile<R: Runtime>(
    app: AppHandle<R>,
    id: String,
) -> Result<Vec<EngineProfile>, String> {
    let mut profiles = read_registry(&app)?;
    profiles.retain(|p| p.id != id);
    write_registry(&app, &profiles)?;
    // a file still in the Engines folder gets its default profile back
    synced_profiles(&app)
}

/// Lets the user pick an engine executable anywhere on the machine and approves it for
/// `engine_save_profile`. The dialog is opened here, so the webview never supplies the path.
/// `None` when the dialog is cancelled.
#[tauri::command]
pub async fn engine_pick_executable<R: Runtime>(
    app: AppHandle<R>,
    approved: State<'_, ApprovedExecutables>,
) -> Result<Option<String>, String> {
    let dialog_app = app.clone();
    let picked = tauri::async_runtime::spawn_blocking(move || {
        dialog_app
            .dialog()
            .file()
            .set_title("Choose a UCI chess engine")
            .blocking_pick_file()
    })
    .await
    .map_err(|e| e.to_string())?;
    let Some(picked) = picked else {
        return Ok(None);
    };
    let path = picked
        .into_path()
        .and_then(|p| p.canonicalize().map_err(Into::into))
        .map_err(|e| e.to_string())?;
    if !path.is_file() {
        return Err(format!("{} is not a file", path.display()));
    }
    let path_text = path.to_string_lossy().to_string();
    approved.0.lock().unwrap().insert(path_text.clone());
    Ok(Some(path_text))
}

/// Lets the user pick one or more weights files (e.g. Maia nets) anywhere on the machine.
/// Only returns the paths; they are used as an engine argument, never executed.
#[tauri::command]
pub async fn engine_pick_weights<R: Runtime>(app: AppHandle<R>) -> Result<Vec<String>, String> {
    let picked = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_title("Choose network weights")
            .blocking_pick_files()
    })
    .await
    .map_err(|e| e.to_string())?;
    picked
        .unwrap_or_default()
        .into_iter()
        .map(|f| {
            f.into_path()
                .map(|p| p.to_string_lossy().to_string())
                .map_err(|e| e.to_string())
        })
        .collect()
}

/// Absolute path of the Engines folder, for display and for `{engines}` in options.
#[tauri::command]
pub fn engine_folder<R: Runtime>(app: AppHandle<R>) -> Result<String, String> {
    Ok(engines_dir(&app)?.to_string_lossy().to_string())
}

/// Opens the Engines folder in the OS file manager.
#[tauri::command]
pub fn engine_open_folder<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    open::that_detached(engines_dir(&app)?).map_err(|e| e.to_string())
}

/// Weights files in `Engines/weights` (Maia nets for Lc0), sorted.
#[tauri::command]
pub fn engine_weights<R: Runtime>(app: AppHandle<R>) -> Result<Vec<String>, String> {
    let dir = engines_dir(&app)?.join(WEIGHTS_FOLDER);
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

/// Starts the engine of profile `id` and streams its output to `on_event`.
/// Returns the process id used by `engine_write` and `engine_kill`.
#[tauri::command]
pub fn engine_spawn<R: Runtime>(
    app: AppHandle<R>,
    processes: State<'_, EngineProcesses>,
    id: String,
    on_event: Channel<EngineEvent>,
) -> Result<u32, String> {
    let dir = engines_dir(&app)?;
    let profile = read_registry(&app)?
        .into_iter()
        .find(|p| p.id == id)
        .ok_or_else(|| format!("unknown engine: {id}"))?;
    let name = profile.name.clone();
    let (path, cwd) = if profile.external {
        let path = PathBuf::from(&profile.path);
        if !path.is_file() {
            return Err(format!("{} no longer exists", path.display()));
        }
        let cwd = path.parent().map(Path::to_path_buf).unwrap_or(dir.clone());
        (path, cwd)
    } else {
        if !is_plain_file_name(&profile.path) {
            return Err(format!("invalid engine file name: {}", profile.path));
        }
        let path = resolve_inside(&dir, &profile.path)?;
        if !path.is_file() {
            return Err(format!("{} is not a file", profile.path));
        }
        // only for files we own: an engine the user picked elsewhere is left untouched
        ensure_executable(&path)?;
        (path, dir.clone())
    };
    let engines_text = dir.to_string_lossy().to_string();
    let args: Vec<String> = profile
        .args
        .iter()
        .map(|a| a.replace(ENGINES_PLACEHOLDER, &engines_text))
        .collect();

    let (mut rx, child) = app
        .shell()
        .command(&path)
        .args(args)
        .current_dir(&cwd)
        .spawn()
        .map_err(|e| spawn_error_message(&name, &e))?;
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
                    app.state::<EngineProcesses>()
                        .0
                        .lock()
                        .unwrap()
                        .remove(&pid);
                    EngineEvent::Terminated {
                        code: payload.code,
                        signal: payload.signal,
                    }
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
