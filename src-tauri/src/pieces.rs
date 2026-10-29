//! Piece sets the user installs (U.3): a folder of 12 images imported, or one of the sets that
//! may not be shipped with the app downloaded on the user's request from where its authors'
//! files are published. Each becomes `<AppLocalData>/Themes/pieces/<name>/pieces.css`, the
//! images embedded as data URIs as in the app's own sets (src/assets/styles/pieces), and is
//! read back with `pieces_css` (the webview has no access to the folder; backups include it).

use base64::Engine;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_dialog::DialogExt;

const PIECES_FOLDER: &str = "Themes/pieces";
const ROLES: [(char, &str); 6] = [
    ('p', "pawn"),
    ('n', "knight"),
    ('b', "bishop"),
    ('r', "rook"),
    ('q', "queen"),
    ('k', "king"),
];
const COLORS: [(char, &str); 2] = [('w', "white"), ('b', "black")];

/// Sets whose licence does not allow shipping them ("freeware", no right to redistribute),
/// downloaded from sharechess (GPL-3.0, which lists them with their authors) at a fixed commit.
const DOWNLOADABLE: [&str; 6] = ["cases", "motif", "pirat", "regular", "smart", "traveller"];
const DOWNLOAD_BASE: &str = "https://raw.githubusercontent.com/caderek/sharechess/\
f249b986859523c2c3f39d8f99f9edf824fff5c6/public/pieces";

fn pieces_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join(PIECES_FOLDER);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// A set's name as a folder: letters, digits, `_` and `-`, lower case.
fn valid_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 40
        && name
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_' || c == '-')
}

/// A folder name made into a set name: "My Pieces!" -> "my_pieces"
fn name_from(folder: &str) -> String {
    let name: String = folder
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .collect();
    let name = name.trim_matches('_').to_string();
    if name.is_empty() {
        "my_pieces".into()
    } else {
        name.chars().take(40).collect()
    }
}

fn mime(file: &str) -> Option<&'static str> {
    let lower = file.to_ascii_lowercase();
    if lower.ends_with(".svg") {
        Some("image/svg+xml")
    } else if lower.ends_with(".png") {
        Some("image/png")
    } else if lower.ends_with(".webp") {
        Some("image/webp")
    } else {
        None
    }
}

/// The file of one piece among `files`: Lichess names it colour then role ("wK.svg"),
/// sharechess role then colour ("kw.svg"); either, in any case.
fn piece_file(files: &[String], color: char, role: char) -> Option<&String> {
    let names = [format!("{color}{role}"), format!("{role}{color}")];
    files.iter().find(|f| {
        let stem = f.rsplit_once('.').map_or(f.as_str(), |(s, _)| s);
        mime(f).is_some() && names.iter().any(|n| stem.eq_ignore_ascii_case(n))
    })
}

/// The stylesheet of 12 pieces, each `(file name, bytes)` in ROLES × COLORS order.
fn pieces_css(images: &[(String, Vec<u8>)]) -> String {
    let mut css = String::from("/** Embedded images for all chess pieces */\n");
    let mut i = 0;
    for (_, color) in COLORS {
        for (_, role) in ROLES {
            let (file, bytes) = &images[i];
            let data = base64::engine::general_purpose::STANDARD.encode(bytes);
            css.push_str(&format!(
                ".cg-wrap piece.{role}.{color} {{\n    background-image: url('data:{};base64,{data}');\n}}\n",
                mime(file).unwrap_or("image/svg+xml")
            ));
            i += 1;
        }
    }
    css
}

/// The 12 images of a folder, in ROLES × COLORS order, or which one is missing.
fn read_folder(folder: &Path) -> Result<Vec<(String, Vec<u8>)>, String> {
    let files: Vec<String> = std::fs::read_dir(folder)
        .map_err(|e| format!("{}: {e}", folder.display()))?
        .filter_map(|e| e.ok()?.file_name().into_string().ok())
        .collect();
    let mut images = Vec::new();
    for (c, _) in COLORS {
        for (r, _) in ROLES {
            let file = piece_file(&files, c, r).ok_or_else(|| {
                format!(
                    "No image for the {} {} (e.g. {c}{}.svg)",
                    if c == 'w' { "white" } else { "black" },
                    ROLES.iter().find(|(x, _)| *x == r).map_or("", |(_, n)| n),
                    r.to_ascii_uppercase()
                )
            })?;
            let bytes = std::fs::read(folder.join(file)).map_err(|e| e.to_string())?;
            images.push((file.clone(), bytes));
        }
    }
    Ok(images)
}

fn write_set(dir: &Path, name: &str, css: &str) -> Result<(), String> {
    let folder = dir.join(name);
    std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    std::fs::write(folder.join("pieces.css"), css).map_err(|e| e.to_string())
}

/// The sets installed, by name.
#[tauri::command]
pub fn pieces_list<R: Runtime>(app: AppHandle<R>) -> Result<Vec<String>, String> {
    let dir = pieces_dir(&app)?;
    let mut names: Vec<String> = std::fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| {
            let e = e.ok()?;
            let name = e.file_name().into_string().ok()?;
            (valid_name(&name) && e.path().join("pieces.css").is_file()).then_some(name)
        })
        .collect();
    names.sort();
    Ok(names)
}

/// An installed set's stylesheet.
#[tauri::command]
pub fn pieces_css_of<R: Runtime>(app: AppHandle<R>, name: String) -> Result<String, String> {
    if !valid_name(&name) {
        return Err(format!("Invalid piece set {name:?}"));
    }
    std::fs::read_to_string(pieces_dir(&app)?.join(&name).join("pieces.css"))
        .map_err(|e| format!("{name}: {e}"))
}

/// Asks for a folder of 12 piece images and installs it as a set named after the folder.
/// None if cancelled.
#[tauri::command]
pub async fn pieces_import<R: Runtime>(app: AppHandle<R>) -> Result<Option<String>, String> {
    let picker = app.clone();
    let picked = tauri::async_runtime::spawn_blocking(move || {
        picker
            .dialog()
            .file()
            .set_title("Choose a folder with the 12 piece images (wK.svg, bQ.png…)")
            .blocking_pick_folder()
    })
    .await
    .map_err(|e| e.to_string())?;
    let Some(folder) = picked.and_then(|p| p.into_path().ok()) else {
        return Ok(None);
    };
    let images = read_folder(&folder)?;
    let name = name_from(
        &folder
            .file_name()
            .map_or_else(String::new, |n| n.to_string_lossy().to_string()),
    );
    write_set(&pieces_dir(&app)?, &name, &pieces_css(&images))?;
    Ok(Some(name))
}

/// The sets that can be downloaded on request (not shipped: their licence does not allow it).
#[tauri::command]
pub fn pieces_downloadable() -> Vec<String> {
    DOWNLOADABLE.iter().map(|s| s.to_string()).collect()
}

/// Downloads one of DOWNLOADABLE and installs it under its name.
#[tauri::command]
pub async fn pieces_download<R: Runtime>(app: AppHandle<R>, name: String) -> Result<(), String> {
    if !DOWNLOADABLE.contains(&name.as_str()) {
        return Err(format!("{name} is not a set that can be downloaded"));
    }
    let client = crate::net::client()?;
    let mut images = Vec::new();
    for (c, _) in COLORS {
        for (r, _) in ROLES {
            let file = format!("{r}{c}.svg");
            let url = format!("{DOWNLOAD_BASE}/{name}/{file}");
            let response = client.get(&url).send().await.map_err(|e| e.to_string())?;
            if !response.status().is_success() {
                return Err(format!("{name}/{file}: {}", response.status()));
            }
            let bytes = response.bytes().await.map_err(|e| e.to_string())?;
            images.push((file, bytes.to_vec()));
        }
    }
    write_set(&pieces_dir(&app)?, &name, &pieces_css(&images))
}

/// Removes an installed set.
#[tauri::command]
pub fn pieces_remove<R: Runtime>(app: AppHandle<R>, name: String) -> Result<(), String> {
    if !valid_name(&name) {
        return Err(format!("Invalid piece set {name:?}"));
    }
    std::fs::remove_dir_all(pieces_dir(&app)?.join(&name)).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn folder(files: &[&str]) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "rechess-pieces-{}-{}",
            std::process::id(),
            files.len()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        for f in files {
            std::fs::write(dir.join(f), b"<svg/>").unwrap();
        }
        dir
    }

    const LICHESS: [&str; 12] = [
        "wP.svg", "wN.svg", "wB.svg", "wR.svg", "wQ.svg", "wK.svg", "bP.svg", "bN.svg", "bB.svg",
        "bR.svg", "bQ.svg", "bK.svg",
    ];

    #[test]
    fn reads_lichess_and_sharechess_names() {
        let lichess = read_folder(&folder(&LICHESS)).unwrap();
        assert_eq!(lichess[0].0, "wP.svg");
        assert_eq!(lichess[11].0, "bK.svg");
        let share = [
            "pw.svg",
            "nw.svg",
            "bw.svg",
            "rw.svg",
            "qw.svg",
            "kw.svg",
            "pb.png",
            "nb.png",
            "bb.png",
            "rb.png",
            "qb.png",
            "kb.png",
            "README.txt",
        ];
        let images = read_folder(&folder(&share)).unwrap();
        assert_eq!(images[6].0, "pb.png");
        let css = pieces_css(&images);
        assert!(css.contains(".cg-wrap piece.pawn.white {"));
        assert!(css.contains(
            ".cg-wrap piece.king.black {\n    background-image: url('data:image/png;base64,"
        ));
        assert_eq!(css.matches("background-image").count(), 12);
    }

    #[test]
    fn says_which_piece_is_missing() {
        let err = read_folder(&folder(&LICHESS[..11])).unwrap_err();
        assert!(err.contains("black king"), "{err}");
    }

    #[test]
    fn names_are_folders_only() {
        assert_eq!(name_from("My Pieces!"), "my_pieces");
        assert_eq!(name_from("..."), "my_pieces");
        assert!(valid_name("my_pieces"));
        assert!(!valid_name("../x"));
        assert!(!valid_name("Caps"));
    }
}
