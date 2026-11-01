//! Chess sites in a Plybook window (I.5): chess.com, Lichess, Chessable or the user's bookmarks,
//! in a window of their own. The window loads the remote page with no access to the app:
//! capabilities are granted to the main window only, and remote pages get no IPC. What the
//! user takes from a site reaches the app two ways, both started by the user: a PGN downloaded
//! there (a site's own export) is saved to `Library/Downloads` and announced to the main
//! window, and the main window offers what is copied (src/online/sitesclip.ts).

use crate::engine::{app_local_dir, LIBRARY_FOLDER};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::webview::DownloadEvent;
use tauri::{
    AppHandle, Emitter, Manager, Runtime, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};

const SITE_WINDOW: &str = "site";
const DOWNLOADS: &str = "Downloads";

/// A PGN saved from a site, for the main window: its path relative to the app's data folder.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SiteDownload {
    name: String,
    path: String,
}

/// Only web pages: the window must never open a local file or an app URL.
fn site_url(url: &str) -> Result<Url, String> {
    let parsed = Url::parse(url.trim()).map_err(|e| format!("{url}: {e}"))?;
    if parsed.scheme() != "https" || parsed.host_str().is_none() {
        return Err(format!("Only https pages can be opened ({url})"));
    }
    Ok(parsed)
}

/// A download worth keeping in the Library: a PGN by its name, or a site's PGN export.
fn is_pgn(url: &Url, name: &str) -> bool {
    let name = name.to_ascii_lowercase();
    let path = url.path().to_ascii_lowercase();
    name.ends_with(".pgn")
        || path.ends_with(".pgn")
        // Chessable's export, Lichess's game and study exports
        || (url.host_str().is_some_and(|h| h.ends_with("chessable.com")) && path.starts_with("/export"))
        || (url.host_str().is_some_and(|h| h.ends_with("lichess.org")) && path.contains("/export"))
}

/// "name.pgn", made safe for a file system, and not taken in `dir`: "name (2).pgn"…
fn free_path(dir: &Path, suggested: &str) -> PathBuf {
    let stem: String = suggested
        .trim_end_matches(".pgn")
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            c if c.is_control() => '-',
            c => c,
        })
        .collect();
    let stem = stem.trim().trim_start_matches('.');
    let stem = if stem.is_empty() { "download" } else { stem };
    let mut path = dir.join(format!("{stem}.pgn"));
    let mut n = 2;
    while path.exists() {
        path = dir.join(format!("{stem} ({n}).pgn"));
        n += 1;
    }
    path
}

/// Opens `url` in the site window (made on first use, reused after).
#[tauri::command]
pub async fn site_open<R: Runtime>(app: AppHandle<R>, url: String) -> Result<(), String> {
    let url = site_url(&url)?;
    if let Some(mut window) = app.get_webview_window(SITE_WINDOW) {
        window.navigate(url).map_err(|e| e.to_string())?;
        let _ = window.unminimize();
        return window.set_focus().map_err(|e| e.to_string());
    }
    let library = app_local_dir(&app, LIBRARY_FOLDER)?;
    let downloads = library.join(DOWNLOADS);
    // where each download of ours goes: macOS does not say when it finishes
    let pending: Arc<Mutex<HashMap<String, PathBuf>>> = Arc::default();
    let events = app.clone();
    let window = WebviewWindowBuilder::new(&app, SITE_WINDOW, WebviewUrl::External(url))
        .title("Plybook · Sites")
        .inner_size(1200.0, 850.0)
        .on_download(move |_webview, event| {
            match event {
                DownloadEvent::Requested { url, destination } => {
                    let name = destination
                        .file_name()
                        .map_or_else(String::new, |n| n.to_string_lossy().to_string());
                    if is_pgn(&url, &name) && std::fs::create_dir_all(&downloads).is_ok() {
                        let target = free_path(&downloads, &name);
                        *destination = target.clone();
                        if let Ok(mut p) = pending.lock() {
                            p.insert(url.to_string(), target);
                        }
                    }
                }
                DownloadEvent::Finished { url, success, .. } => {
                    let target = pending.lock().ok().and_then(|mut p| p.remove(url.as_str()));
                    if let (true, Some(target)) = (success, target) {
                        let path = target
                            .strip_prefix(library.parent().unwrap_or(&library))
                            .map_or_else(|_| target.clone(), Path::to_path_buf);
                        let _ = events.emit_to(
                            "main",
                            "site-download",
                            SiteDownload {
                                name: target
                                    .file_name()
                                    .map_or_else(String::new, |n| n.to_string_lossy().to_string()),
                                path: path.to_string_lossy().replace('\\', "/"),
                            },
                        );
                    }
                }
                _ => {}
            }
            true
        })
        .build()
        .map_err(|e| e.to_string())?;
    let closed = app.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::Destroyed = event {
            let _ = closed.emit_to("main", "site-closed", ());
        }
    });
    app.emit_to("main", "site-opened", ())
        .map_err(|e| e.to_string())
}

/// Whether the site window is open (the main window watches the clipboard while it is).
#[tauri::command]
pub fn site_is_open<R: Runtime>(app: AppHandle<R>) -> bool {
    app.get_webview_window(SITE_WINDOW).is_some()
}

/// The clipboard's text, only while the site window is open: what the user copies from a site
/// is offered for the Library. The webview has no clipboard permission of its own.
#[tauri::command]
pub fn site_clipboard<R: Runtime>(app: AppHandle<R>) -> Option<String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    app.get_webview_window(SITE_WINDOW)?;
    app.clipboard().read_text().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opens_web_pages_only() {
        assert!(site_url("https://www.chessable.com/").is_ok());
        assert!(site_url("http://example.com").is_err());
        assert!(site_url("file:///etc/passwd").is_err());
        assert!(site_url("tauri://localhost").is_err());
        assert!(site_url("not a url").is_err());
    }

    #[test]
    fn keeps_pgn_downloads() {
        let u = |s: &str| Url::parse(s).unwrap();
        assert!(is_pgn(
            &u("https://www.chessable.com/export?dl=1&bid=1&oid=2"),
            "x"
        ));
        assert!(is_pgn(
            &u("https://lichess.org/game/export/abcd1234"),
            "abcd1234"
        ));
        assert!(is_pgn(&u("https://example.com/a"), "Game.PGN"));
        assert!(!is_pgn(&u("https://example.com/a.zip"), "a.zip"));
    }

    #[test]
    fn finds_a_free_name() {
        let dir = std::env::temp_dir().join(format!("plybook-sites-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        assert_eq!(free_path(&dir, "My: line.pgn"), dir.join("My- line.pgn"));
        std::fs::write(dir.join("My- line.pgn"), "").unwrap();
        assert_eq!(
            free_path(&dir, "My: line.pgn"),
            dir.join("My- line (2).pgn")
        );
        assert_eq!(free_path(&dir, ""), dir.join("download.pgn"));
    }
}
