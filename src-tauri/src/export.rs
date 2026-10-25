//! Saving exported files (board images, GIFs) where the user chooses. The webview may only
//! write in the app's data folder; this opens the native save dialog here and writes the bytes
//! to the picked path, so the webview never names a path itself.

use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Runtime};
use tauri_plugin_dialog::DialogExt;

/// The kinds of file that can be exported, with their dialog filter.
fn filter(kind: &str) -> Option<(&'static str, &'static [&'static str])> {
    match kind {
        "png" => Some(("PNG image", &["png"])),
        "gif" => Some(("Animated GIF", &["gif"])),
        _ => None,
    }
}

/// A file name the dialog can suggest: no folders, no characters file systems refuse.
fn safe_name(name: &str, extension: &str) -> String {
    let base: String = name
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            c if c.is_control() => '-',
            c => c,
        })
        .collect();
    let base = base.trim().trim_start_matches('.');
    let base = if base.is_empty() { "board" } else { base };
    if base
        .to_ascii_lowercase()
        .ends_with(&format!(".{extension}"))
    {
        base.to_string()
    } else {
        format!("{base}.{extension}")
    }
}

/// Saves the request body (raw bytes) through a save dialog. Headers: `x-kind` ("png" or
/// "gif") and `x-name` (suggested name, URL-encoded). The saved path, or None if cancelled.
#[tauri::command]
pub async fn export_save<R: Runtime>(
    app: AppHandle<R>,
    request: Request<'_>,
) -> Result<Option<String>, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("Expected the file's bytes".into());
    };
    let bytes = bytes.clone();
    let header = |name: &str| {
        request
            .headers()
            .get(name)
            .and_then(|v| v.to_str().ok())
            .unwrap_or_default()
            .to_string()
    };
    let kind = header("x-kind");
    let (label, extensions) = filter(&kind).ok_or("Unknown export kind")?;
    let name = safe_name(&urldecode(&header("x-name")), extensions[0]);

    let picker = app.clone();
    let picked = tauri::async_runtime::spawn_blocking(move || {
        picker
            .dialog()
            .file()
            .set_title("Export")
            .set_file_name(&name)
            .add_filter(label, extensions)
            .blocking_save_file()
    })
    .await
    .map_err(|e| e.to_string())?;
    let Some(path) = picked.and_then(|p| p.into_path().ok()) else {
        return Ok(None);
    };
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

/// `encodeURIComponent` undone (headers are ASCII; names need not be).
fn urldecode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(b) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(b);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_are_safe_with_one_extension() {
        assert_eq!(
            safe_name("Kasparov: Topalov", "png"),
            "Kasparov- Topalov.png"
        );
        assert_eq!(safe_name("game.gif", "gif"), "game.gif");
        assert_eq!(safe_name("../../etc", "png"), "-..-etc.png");
        assert_eq!(safe_name("  ", "png"), "board.png");
    }

    #[test]
    fn decodes_encoded_names() {
        assert_eq!(urldecode("Caf%C3%A9%20p.12"), "Café p.12");
        assert_eq!(urldecode("100%"), "100%");
        assert_eq!(urldecode("%zz"), "%zz");
    }

    #[test]
    fn knows_its_kinds() {
        assert!(filter("png").is_some());
        assert!(filter("exe").is_none());
    }
}
