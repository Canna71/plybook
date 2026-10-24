//! The only place that talks to the network. The webview's CSP blocks requests, so each online
//! source is a command here with a fixed host and validated parameters.

use serde::Deserialize;
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

fn client() -> Result<reqwest::Client, String> {
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

#[cfg(test)]
mod tests {
    use super::*;

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
