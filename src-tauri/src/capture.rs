//! "Scan from screen": the user drags a rectangle over a chessboard anywhere on screen and the
//! image goes to the scanner in the webview. ReChess hides while the user selects.
//!
//! macOS uses the system's interactive capture (`/usr/sbin/screencapture`, fixed arguments).
//! Windows is not supported yet: Win+Shift+S then paste does the same.

use std::path::Path;
use tauri::ipc::Response;
use tauri::{AppHandle, Manager, Runtime};

/// Reads and removes the capture file; None when the user cancelled (no file written).
fn take_capture(path: &Path) -> Result<Option<Vec<u8>>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(path);
    Ok(if bytes.is_empty() { None } else { Some(bytes) })
}

#[cfg(target_os = "macos")]
mod screen_permission {
    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGPreflightScreenCaptureAccess() -> bool;
        fn CGRequestScreenCaptureAccess() -> bool;
    }

    /// Whether ReChess may capture other apps' windows. Without the permission macOS captures
    /// only the wallpaper and our own windows, which would scan as "no board".
    pub fn ensure() -> Result<(), String> {
        // SAFETY: plain CoreGraphics calls without arguments, available since macOS 10.15
        if unsafe { CGPreflightScreenCaptureAccess() } {
            return Ok(());
        }
        // shows the system prompt the first time; later it is a no-op
        unsafe { CGRequestScreenCaptureAccess() };
        Err(
            "ReChess needs the Screen Recording permission to read boards from other apps. \
             Allow it in System Settings → Privacy & Security → Screen Recording, then restart \
             ReChess."
                .to_string(),
        )
    }
}

#[cfg(target_os = "macos")]
fn capture_region(path: &Path) -> Result<(), String> {
    screen_permission::ensure()?;
    // -i interactive selection (Esc cancels, space toggles window mode), -x no sound
    let status = std::process::Command::new("/usr/sbin/screencapture")
        .args(["-i", "-x"])
        .arg(path)
        .status()
        .map_err(|e| format!("Could not start the screen capture: {e}"))?;
    if !status.success() {
        return Err(format!("The screen capture failed ({status})"));
    }
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn capture_region(_path: &Path) -> Result<(), String> {
    Err(
        "Capturing from the screen is not available here yet: take a screenshot of the board \
         (Win+Shift+S on Windows) and paste it with Ctrl+V."
            .to_string(),
    )
}

/// Lets the user select a screen region and returns it as PNG bytes; an empty response means
/// the selection was cancelled.
#[tauri::command]
pub async fn scan_capture_screen<R: Runtime>(app: AppHandle<R>) -> Result<Response, String> {
    let path = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("screen-capture.png");
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let _ = std::fs::remove_file(&path);

    let window = app.get_webview_window("main");
    if let Some(w) = &window {
        let _ = w.hide();
    }
    let captured = tauri::async_runtime::spawn_blocking({
        let path = path.clone();
        move || capture_region(&path)
    })
    .await
    .map_err(|e| e.to_string());
    if let Some(w) = &window {
        let _ = w.show();
        let _ = w.set_focus();
    }
    captured??;
    Ok(Response::new(take_capture(&path)?.unwrap_or_default()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_missing_or_empty_capture_means_cancelled() {
        let dir = std::env::temp_dir().join(format!("rechess-capture-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("capture.png");
        assert_eq!(take_capture(&path).unwrap(), None);
        std::fs::write(&path, b"").unwrap();
        assert_eq!(take_capture(&path).unwrap(), None);
        std::fs::write(&path, b"\x89PNG").unwrap();
        assert_eq!(take_capture(&path).unwrap(), Some(b"\x89PNG".to_vec()));
        // the file is removed once read
        assert!(!path.exists());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
