//! The only place that talks to the network. The webview's CSP blocks requests, so each online
//! source is a command here with a fixed host and validated parameters.

use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::Path;
use std::time::Duration;

const USER_AGENT: &str = concat!(
    "ReChess/",
    env!("CARGO_PKG_VERSION"),
    " (+https://github.com/Canna71/rechess)"
);

#[derive(Deserialize, Clone, Copy, Debug)]
#[serde(rename_all = "lowercase")]
pub enum Site {
    Chesscom,
    Lichess,
}

impl Site {
    fn label(self) -> &'static str {
        match self {
            Site::Chesscom => "chess.com",
            Site::Lichess => "Lichess",
        }
    }
}

/// The HTTP client every request uses (also model.rs, for the explanation model).
pub(crate) fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .connect_timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())
}

/// Both sites allow letters, digits, `_` and `-` in usernames.
fn valid_username(username: &str) -> bool {
    !username.is_empty()
        && username.len() <= 50
        && username
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

/// "YYYY-MM" -> (year, month)
fn parse_month(month: &str) -> Result<(i64, u32), String> {
    let err = || format!("Invalid month {month:?}, expected YYYY-MM");
    let (y, m) = month.split_once('-').ok_or_else(err)?;
    let y: i64 = y.parse().map_err(|_| err())?;
    let m: u32 = m.parse().map_err(|_| err())?;
    if y < 2000 || !(1..=12).contains(&m) {
        return Err(err());
    }
    Ok((y, m))
}

async fn get_text(
    request: reqwest::RequestBuilder,
    site: Site,
    username: &str,
) -> Result<String, String> {
    let response = request
        .send()
        .await
        .map_err(|e| format!("Could not reach {}: {e}", site.label()))?;
    match response.status().as_u16() {
        200 => response.text().await.map_err(|e| e.to_string()),
        404 => Err(format!("{} user {username:?} not found", site.label())),
        429 => Err(format!(
            "{} is rate limiting requests, try again in a minute",
            site.label()
        )),
        code => Err(format!("{} answered with HTTP {code}", site.label())),
    }
}

/// The Lichess puzzle database (CC0), about 300 MB compressed.
pub const LICHESS_PUZZLES_URL: &str = "https://database.lichess.org/lichess_db_puzzle.csv.zst";

/// Downloads `url` (one of the fixed URLs above) to `dest`, reporting (bytes, total bytes).
pub async fn download(
    url: &'static str,
    dest: &Path,
    mut progress: impl FnMut(u64, u64),
) -> Result<(), String> {
    let mut response = client()?
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Could not reach {url}: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("{url} answered with HTTP {}", response.status()));
    }
    let total = response.content_length().unwrap_or(0);
    let partial = dest.with_extension("part");
    let mut file = std::fs::File::create(&partial).map_err(|e| e.to_string())?;
    let mut done = 0u64;
    let mut last_report = 0u64;
    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        done += chunk.len() as u64;
        if done - last_report >= 1 << 20 {
            progress(done, total);
            last_report = done;
        }
    }
    progress(done, total);
    drop(file);
    std::fs::rename(&partial, dest).map_err(|e| e.to_string())
}

#[derive(Deserialize)]
struct ChesscomArchives {
    archives: Vec<String>,
}

async fn chesscom_games(username: &str, since: Option<(i64, u32)>) -> Result<String, String> {
    let client = client()?;
    let base = format!("https://api.chess.com/pub/player/{username}/games");
    let body = get_text(
        client.get(format!("{base}/archives")),
        Site::Chesscom,
        username,
    )
    .await?;
    let archives: ChesscomArchives = serde_json::from_str(&body).map_err(|e| e.to_string())?;

    // Archive URLs end in /YYYY/MM. Only the month is taken from them; the URL is rebuilt so
    // nothing outside api.chess.com is ever requested.
    let mut months: Vec<(i64, u32)> = archives
        .archives
        .iter()
        .filter_map(|url| {
            let mut parts = url.rsplit('/');
            let m = parts.next()?.parse().ok()?;
            let y = parts.next()?.parse().ok()?;
            Some((y, m))
        })
        .filter(|month| since.is_none_or(|since| *month >= since))
        .collect();
    months.sort();

    let mut pgn = String::new();
    for (y, m) in months {
        let text = get_text(
            client.get(format!("{base}/{y}/{m:02}/pgn")),
            Site::Chesscom,
            username,
        )
        .await?;
        pgn.push_str(text.trim());
        pgn.push_str("\n\n");
    }
    Ok(pgn)
}

async fn lichess_games(username: &str, since: Option<(i64, u32)>) -> Result<String, String> {
    let mut request = client()?
        .get(format!("https://lichess.org/api/games/user/{username}"))
        .header("Accept", "application/x-chess-pgn")
        .query(&[("clocks", "true"), ("evals", "true"), ("opening", "true")]);
    if let Some((y, m)) = since {
        let ms = chrono::NaiveDate::from_ymd_opt(y as i32, m, 1)
            .and_then(|d| d.and_hms_opt(0, 0, 0))
            .ok_or("Invalid month")?
            .and_utc()
            .timestamp_millis();
        request = request.query(&[("since", ms.to_string())]);
    }
    get_text(request, Site::Lichess, username).await
}

/// Downloads the user's games as PGN, from the start of `since_month` ("YYYY-MM") or all of them.
/// Lichess streams about 20 games a second, so a first full download can take minutes.
#[tauri::command]
pub async fn online_fetch_games(
    site: Site,
    username: String,
    since_month: Option<String>,
) -> Result<String, String> {
    let username = username.trim().to_lowercase();
    if !valid_username(&username) {
        return Err(format!("Invalid username {username:?}"));
    }
    let since = since_month.as_deref().map(parse_month).transpose()?;
    match site {
        Site::Chesscom => chesscom_games(&username, since).await,
        Site::Lichess => lichess_games(&username, since).await,
    }
}

/// Lichess game ids are 8 letters and digits.
fn valid_game_id(id: &str) -> bool {
    id.len() == 8 && id.chars().all(|c| c.is_ascii_alphanumeric())
}

/// One Lichess game as PGN, with clocks and the analysis evals when it was analysed.
#[tauri::command]
pub async fn online_lichess_game(id: String) -> Result<String, String> {
    if !valid_game_id(&id) {
        return Err(format!("Invalid Lichess game id {id:?}"));
    }
    let response = client()?
        .get(format!("https://lichess.org/game/export/{id}"))
        .header("Accept", "application/x-chess-pgn")
        .query(&[("clocks", "true"), ("evals", "true"), ("opening", "true")])
        .send()
        .await
        .map_err(|e| format!("Could not reach Lichess: {e}"))?;
    match response.status().as_u16() {
        200 => response.text().await.map_err(|e| e.to_string()),
        404 => Err(format!("Lichess game {id} not found")),
        429 => Err("Lichess is rate limiting requests, try again in a minute".to_string()),
        code => Err(format!("Lichess answered with HTTP {code}")),
    }
}

#[derive(Deserialize, Clone, Copy, Debug)]
#[serde(rename_all = "lowercase")]
pub enum ExplorerSource {
    /// Over-the-board games of titled players
    Masters,
    /// Games played on Lichess
    Lichess,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LichessExplorerMove {
    uci: String,
    san: String,
    average_rating: Option<i64>,
    white: i64,
    draws: i64,
    black: i64,
}

#[derive(Deserialize)]
struct LichessExplorer {
    moves: Vec<LichessExplorerMove>,
}

/// A FEN as sent to the explorer: the characters of a FEN, and not too long.
fn plausible_fen(fen: &str) -> bool {
    !fen.is_empty()
        && fen.len() <= 100
        && fen
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '/' || c == ' ' || c == '-')
}

fn explorer_moves(json: &str) -> Result<Vec<crate::games::ExplorerMove>, String> {
    let parsed: LichessExplorer = serde_json::from_str(json).map_err(|e| e.to_string())?;
    Ok(parsed
        .moves
        .into_iter()
        .map(|m| crate::games::ExplorerMove {
            uci: m.uci,
            san: m.san,
            games: m.white + m.draws + m.black,
            white_wins: m.white,
            draws: m.draws,
            black_wins: m.black,
            average_elo: m.average_rating,
        })
        .collect())
}

/// The Lichess opening explorer for a position. It needs the user's Lichess token, which Rust
/// takes from the keychain: the webview never handles it.
#[tauri::command]
pub async fn online_lichess_explorer(
    secrets: tauri::State<'_, crate::secrets::Secrets>,
    fen: String,
    source: ExplorerSource,
) -> Result<Vec<crate::games::ExplorerMove>, String> {
    if !plausible_fen(&fen) {
        return Err("Invalid position".to_string());
    }
    let token = secrets
        .get(crate::secrets::Secret::LichessToken)?
        .ok_or("Add your Lichess token in Settings → Online accounts to use its explorer")?;
    let path = match source {
        ExplorerSource::Masters => "masters",
        ExplorerSource::Lichess => "lichess",
    };
    let response = client()?
        .get(format!("https://explorer.lichess.ovh/{path}"))
        .bearer_auth(token)
        .query(&[("fen", fen.as_str()), ("moves", "20")])
        .send()
        .await
        .map_err(|e| format!("Could not reach the Lichess explorer: {e}"))?;
    match response.status().as_u16() {
        200 => explorer_moves(&response.text().await.map_err(|e| e.to_string())?),
        401 => Err(
            "Lichess did not accept the token: create a new one and save it in Settings"
                .to_string(),
        ),
        429 => Err("The Lichess explorer is rate limiting requests, wait a minute".to_string()),
        code => Err(format!("The Lichess explorer answered with HTTP {code}")),
    }
}

#[derive(Deserialize, Serialize, Debug, PartialEq)]
pub struct TablebaseMove {
    uci: String,
    san: String,
    /// From the point of view of the side to move after this move
    category: String,
    dtz: Option<i64>,
    dtm: Option<i64>,
}

#[derive(Deserialize, Serialize, Debug, PartialEq)]
pub struct Tablebase {
    /// For the side to move: win, loss, draw, cursed-win, blessed-loss, maybe-*, unknown
    category: String,
    dtz: Option<i64>,
    dtm: Option<i64>,
    checkmate: bool,
    stalemate: bool,
    moves: Vec<TablebaseMove>,
}

/// Pieces on the board of a FEN.
fn piece_count(fen: &str) -> usize {
    fen.split(' ')
        .next()
        .unwrap_or("")
        .chars()
        .filter(char::is_ascii_alphabetic)
        .count()
}

/// The Lichess tablebase (Syzygy, up to 7 pieces): the exact result and the result of every
/// move. Free, no token.
#[tauri::command]
pub async fn online_tablebase(fen: String) -> Result<Tablebase, String> {
    if !plausible_fen(&fen) {
        return Err("Invalid position".to_string());
    }
    if piece_count(&fen) > 7 {
        return Err("Tablebases cover positions with up to 7 pieces".to_string());
    }
    let response = client()?
        .get("https://tablebase.lichess.ovh/standard")
        .query(&[("fen", fen.as_str())])
        .send()
        .await
        .map_err(|e| format!("Could not reach the Lichess tablebase: {e}"))?;
    match response.status().as_u16() {
        200 => serde_json::from_str(&response.text().await.map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string()),
        429 => Err("The tablebase is rate limiting requests, wait a minute".to_string()),
        code => Err(format!("The Lichess tablebase answered with HTTP {code}")),
    }
}

/// A YouTube watch page for a video id, starting at `start` seconds; None for anything that
/// is not a video id, so the command below can only open YouTube.
fn youtube_url(id: &str, start: u32) -> Option<String> {
    let valid = id.len() == 11
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    valid.then(|| format!("https://www.youtube.com/watch?v={id}&t={start}s"))
}

/// Opens a YouTube video in the default browser (the embedded player's fallback).
#[tauri::command]
pub fn open_youtube(id: String, start: u32) -> Result<(), String> {
    let url = youtube_url(&id, start).ok_or("Not a YouTube video id")?;
    open::that_detached(url).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opens_only_youtube_videos() {
        assert_eq!(
            youtube_url("dQw4w9WgXcQ", 90).as_deref(),
            Some("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s")
        );
        assert_eq!(youtube_url("short", 0), None);
        assert_eq!(youtube_url("x&url=evil.", 0), None);
    }

    #[test]
    fn reads_the_tablebase_answer() {
        // trimmed answer of tablebase.lichess.ovh for king and rook against king
        let json = r#"{
            "checkmate": false, "stalemate": false, "variant_win": false,
            "variant_loss": false, "insufficient_material": false,
            "dtz": null, "precise_dtz": null, "dtm": null, "dtw": null, "dtc": null,
            "category": "win",
            "moves": [
                {"uci": "a1a7", "san": "Ra7", "zeroing": false, "conversion": false,
                 "checkmate": false, "stalemate": false, "dtz": -22, "precise_dtz": -22,
                 "dtm": -22, "dtw": null, "dtc": null, "category": "loss"}
            ]
        }"#;
        let tb: Tablebase = serde_json::from_str(json).unwrap();
        assert_eq!(tb.category, "win");
        assert_eq!(tb.dtm, None);
        assert_eq!(
            tb.moves[0],
            TablebaseMove {
                uci: "a1a7".into(),
                san: "Ra7".into(),
                category: "loss".into(),
                dtz: Some(-22),
                dtm: Some(-22),
            }
        );
        assert_eq!(piece_count("4k3/8/8/8/8/8/8/R3K3 w Q - 0 1"), 3);
        assert_eq!(
            piece_count("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
            32
        );
    }

    #[test]
    fn reads_the_explorer_answer() {
        // shape of explorer.lichess.ovh answers (fields not used are left out)
        let json = r#"{
            "white": 10, "draws": 5, "black": 7,
            "moves": [
                {"uci": "e7e5", "san": "e5", "averageRating": 2410,
                 "white": 6, "draws": 3, "black": 4, "game": null},
                {"uci": "c7c5", "san": "c5", "averageRating": null,
                 "white": 4, "draws": 2, "black": 3, "game": null}
            ],
            "topGames": [], "opening": {"eco": "B00", "name": "King's Pawn"}
        }"#;
        let moves = explorer_moves(json).unwrap();
        assert_eq!(moves.len(), 2);
        assert_eq!((moves[0].san.as_str(), moves[0].games), ("e5", 13));
        assert_eq!(moves[0].average_elo, Some(2410));
        assert_eq!(moves[1].average_elo, None);
        assert!(explorer_moves("<html>").is_err());
    }

    #[test]
    fn explorer_positions_are_checked() {
        assert!(plausible_fen(
            "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
        ));
        assert!(!plausible_fen("x&callback=evil"));
        assert!(!plausible_fen(""));
    }

    #[test]
    fn game_ids_are_validated() {
        assert!(valid_game_id("k8OVq8Y5"));
        assert!(!valid_game_id("k8OVq8Y5abcd"));
        assert!(!valid_game_id("../x/abc"));
        assert!(!valid_game_id(""));
    }

    #[test]
    fn usernames_and_months_are_validated() {
        assert!(valid_username("magnus_carlsen-1"));
        assert!(!valid_username("../etc"));
        assert!(!valid_username("a b"));
        assert_eq!(parse_month("2024-03"), Ok((2024, 3)));
        assert!(parse_month("2024-13").is_err());
        assert!(parse_month("x").is_err());
    }
}
