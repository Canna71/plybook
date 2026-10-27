//! An optional AI model that words move explanations as a coach would (P2.4b). The chess is
//! computed by the app (models/explain.ts); the model only rewrites that text, under a fixed
//! system prompt kept here, so the webview cannot use the key for anything else.
//!
//! Providers: Anthropic, or any OpenAI-compatible endpoint (Ollama or LM Studio on this
//! computer, or a hosted service). The provider, its URL and its key are stored together in the
//! keychain: changing the URL needs the key again, so the key can never be sent to a host the
//! user did not enter it for. The webview learns the provider and URL, never the key.

use crate::net;
use crate::secrets::{Secret, Secrets};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;
use tauri::State;

const ANTHROPIC_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2026-10-21";
/// Retries a declined request on the model Anthropic recommends for the decline's category
const FALLBACK_BETA: &str = "server-side-fallback-2026-07-01";
/// The longest explanation sent, in characters (a few sentences are a few hundred)
const MAX_TEXT: usize = 4000;
const TIMEOUT: Duration = Duration::from_secs(90);

const SYSTEM_PROMPT: &str = "You reword chess move explanations for a club player. You are \
given an explanation computed by a chess engine and chess rules. Rewrite it as a short paragraph \
a coach would say: natural, plain words, no more than four sentences. Use only what the text \
says: do not add moves, variations, evaluations, pieces or squares that are not in it, and keep \
every move and square exactly as written (for example Nf3, exd5, the knight on d5). No markdown, \
no lists, no headings. Reply with the paragraph only.";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Provider {
    Anthropic,
    /// An OpenAI-compatible chat completions endpoint
    Openai,
}

/// What is kept in the keychain, as JSON.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
struct Stored {
    provider: Provider,
    /// The OpenAI-compatible base URL ("http://localhost:11434/v1"); none for Anthropic
    url: Option<String>,
    key: Option<String>,
}

/// What the webview may know: no key.
#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ModelStatus {
    provider: Option<Provider>,
    url: Option<String>,
    has_key: bool,
}

fn load(secrets: &Secrets) -> Result<Option<Stored>, String> {
    match secrets.0.get(Secret::ModelProvider.key())? {
        Some(text) => serde_json::from_str(&text)
            .map(Some)
            .map_err(|_| "The saved model settings are unreadable: set them again".to_string()),
        None => Ok(None),
    }
}

fn is_local(url: &reqwest::Url) -> bool {
    matches!(
        url.host_str(),
        Some("localhost") | Some("127.0.0.1") | Some("[::1]") | Some("::1")
    )
}

/// An OpenAI-compatible base URL: https, or http on this computer only.
fn check_url(url: &str) -> Result<reqwest::Url, String> {
    let parsed = reqwest::Url::parse(url.trim()).map_err(|_| format!("{url:?} is not a URL"))?;
    let ok = parsed.scheme() == "https" || (parsed.scheme() == "http" && is_local(&parsed));
    if !ok || parsed.host_str().is_none() {
        return Err("The endpoint must be https, or http on this computer (localhost)".into());
    }
    Ok(parsed)
}

fn check_key(key: &str) -> Result<(), String> {
    if key.is_empty() || key.len() > 512 || key.chars().any(char::is_whitespace) {
        return Err("That does not look like an API key".into());
    }
    Ok(())
}

/// The configuration to store, from what the user entered and what is stored now. A key left
/// empty keeps the stored one only for the same provider and URL.
fn configure(
    current: Option<Stored>,
    provider: Provider,
    url: Option<String>,
    key: Option<String>,
) -> Result<Stored, String> {
    let url = match provider {
        Provider::Anthropic => None,
        Provider::Openai => {
            let url = url.ok_or("Enter the endpoint URL")?;
            Some(check_url(&url)?.as_str().trim_end_matches('/').to_string())
        }
    };
    let key = key.map(|k| k.trim().to_string()).filter(|k| !k.is_empty());
    let key = match key {
        Some(k) => {
            check_key(&k)?;
            Some(k)
        }
        None => current
            .filter(|c| c.provider == provider && c.url == url)
            .and_then(|c| c.key),
    };
    let local = url
        .as_deref()
        .and_then(|u| reqwest::Url::parse(u).ok())
        .is_some_and(|u| is_local(&u));
    if key.is_none() && !local {
        return Err("Enter the API key".into());
    }
    Ok(Stored { provider, url, key })
}

#[tauri::command]
pub async fn model_status(secrets: State<'_, Secrets>) -> Result<ModelStatus, String> {
    let stored = load(&secrets)?;
    Ok(ModelStatus {
        provider: stored.as_ref().map(|s| s.provider),
        url: stored.as_ref().and_then(|s| s.url.clone()),
        has_key: stored.is_some_and(|s| s.key.is_some()),
    })
}

#[tauri::command]
pub async fn model_configure(
    secrets: State<'_, Secrets>,
    provider: Provider,
    url: Option<String>,
    key: Option<String>,
) -> Result<(), String> {
    let stored = configure(load(&secrets)?, provider, url, key)?;
    let text = serde_json::to_string(&stored).map_err(|e| e.to_string())?;
    secrets.0.set(Secret::ModelProvider.key(), &text)
}

#[tauri::command]
pub async fn model_forget(secrets: State<'_, Secrets>) -> Result<(), String> {
    secrets.0.delete(Secret::ModelProvider.key())
}

/// Claude models that take `output_config.effort`
fn takes_effort(model: &str) -> bool {
    [
        "claude-opus-5",
        "claude-sonnet-5",
        "claude-haiku-5",
        "claude-fable-5",
    ]
    .iter()
    .any(|p| model.starts_with(p))
}

/// Claude models with server-side fallbacks on refusal (Haiku has none)
fn has_fallbacks(model: &str) -> bool {
    model.starts_with("claude-opus-5")
        || model == "claude-sonnet-5-5"
        || model.starts_with("claude-fable-5")
}

fn anthropic_body(model: &str, text: &str) -> Value {
    let mut body = json!({
        "model": model,
        // room for the model's own thinking on top of a short paragraph
        "max_tokens": 4000,
        "system": SYSTEM_PROMPT,
        "messages": [{ "role": "user", "content": text }],
    });
    if takes_effort(model) {
        body["output_config"] = json!({ "effort": "low" });
    }
    if has_fallbacks(model) {
        body["fallbacks"] = json!("default");
    }
    body
}

/// The paragraph in a Messages API response; a refusal is an error.
fn anthropic_text(response: &Value) -> Result<String, String> {
    if response["stop_reason"] == "refusal" {
        return Err("The model declined to reword this explanation".into());
    }
    let text: Vec<&str> = response["content"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|b| b["type"] == "text")
        .filter_map(|b| b["text"].as_str())
        .collect();
    let text = text.join("").trim().to_string();
    if text.is_empty() {
        return Err("The model gave no text".into());
    }
    Ok(text)
}

fn openai_body(model: &str, text: &str) -> Value {
    json!({
        "model": model,
        "max_tokens": 600,
        "messages": [
            { "role": "system", "content": SYSTEM_PROMPT },
            { "role": "user", "content": text },
        ],
    })
}

fn openai_text(response: &Value) -> Result<String, String> {
    let text = response["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string();
    if text.is_empty() {
        return Err("The model gave no text".into());
    }
    Ok(text)
}

/// An error answer in words: the provider's own message when it gives one.
fn http_error(status: u16, body: &str) -> String {
    let message = serde_json::from_str::<Value>(body)
        .ok()
        .and_then(|v| v["error"]["message"].as_str().map(str::to_string));
    match status {
        401 | 403 => "The API key was not accepted".into(),
        429 => "The model provider is rate limiting requests: try again in a minute".into(),
        _ => match message {
            Some(m) => format!("The model provider answered with HTTP {status}: {m}"),
            None => format!("The model provider answered with HTTP {status}"),
        },
    }
}

/// Rewords a computed explanation (plain text) as a coach would.
#[tauri::command]
pub async fn model_rephrase(
    secrets: State<'_, Secrets>,
    model: String,
    text: String,
) -> Result<String, String> {
    let stored = load(&secrets)?.ok_or("No model is set up (Settings → Explanations)")?;
    let model = model.trim();
    if model.is_empty() || model.len() > 100 {
        return Err("Enter a model name (Settings → Explanations)".into());
    }
    if text.trim().is_empty() || text.len() > MAX_TEXT {
        return Err("Nothing to reword".into());
    }
    let client = net::client()?;
    let request = match stored.provider {
        Provider::Anthropic => {
            let key = stored
                .key
                .ok_or("Enter the API key (Settings → Explanations)")?;
            let mut request = client
                .post(ANTHROPIC_URL)
                .header("x-api-key", key)
                .header("anthropic-version", ANTHROPIC_VERSION)
                .header("content-type", "application/json");
            if has_fallbacks(model) {
                request = request.header("anthropic-beta", FALLBACK_BETA);
            }
            request.body(anthropic_body(model, &text).to_string())
        }
        Provider::Openai => {
            let base = stored.url.ok_or("Enter the endpoint URL")?;
            let url = check_url(&format!("{base}/chat/completions"))?;
            let mut request = client.post(url).header("content-type", "application/json");
            if let Some(key) = stored.key {
                request = request.bearer_auth(key);
            }
            request.body(openai_body(model, &text).to_string())
        }
    };
    let response = request
        .timeout(TIMEOUT)
        .send()
        .await
        .map_err(|e| format!("Could not reach the model provider: {e}"))?;
    let status = response.status().as_u16();
    let body = response.text().await.map_err(|e| e.to_string())?;
    if !(200..300).contains(&status) {
        return Err(http_error(status, &body));
    }
    let value: Value =
        serde_json::from_str(&body).map_err(|_| "The model provider's answer is unreadable")?;
    match stored.provider {
        Provider::Anthropic => anthropic_text(&value),
        Provider::Openai => openai_text(&value),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const LOCAL: &str = "http://localhost:11434/v1";

    #[test]
    fn endpoints_are_https_or_local() {
        assert!(check_url("https://api.groq.com/openai/v1").is_ok());
        assert!(check_url(LOCAL).is_ok());
        assert!(check_url("http://127.0.0.1:1234/v1").is_ok());
        assert!(check_url("http://example.com/v1").is_err());
        assert!(check_url("ftp://localhost/v1").is_err());
        assert!(check_url("not a url").is_err());
    }

    #[test]
    fn a_key_stays_with_its_endpoint() {
        let first = configure(
            None,
            Provider::Openai,
            Some("https://a.example/v1".into()),
            Some("sk-one".into()),
        )
        .unwrap();
        // the same endpoint without a key keeps the key
        let same = configure(
            Some(first.clone()),
            Provider::Openai,
            Some("https://a.example/v1/".into()),
            None,
        )
        .unwrap();
        assert_eq!(same.key.as_deref(), Some("sk-one"));
        // another endpoint needs the key again: it is never sent elsewhere
        assert!(configure(
            Some(first.clone()),
            Provider::Openai,
            Some("https://b.example/v1".into()),
            None,
        )
        .is_err());
        // nor does it move to Anthropic
        assert!(configure(Some(first), Provider::Anthropic, None, None).is_err());
    }

    #[test]
    fn a_local_endpoint_needs_no_key() {
        let local = configure(None, Provider::Openai, Some(LOCAL.into()), None).unwrap();
        assert_eq!(local.key, None);
        assert!(configure(None, Provider::Anthropic, None, Some("two words".into())).is_err());
    }

    #[test]
    fn anthropic_requests_fit_the_model() {
        let opus = anthropic_body("claude-opus-5-5", "Nf3 develops the knight.");
        assert_eq!(opus["fallbacks"], "default");
        assert_eq!(opus["output_config"]["effort"], "low");
        assert!(opus.get("temperature").is_none());
        let haiku = anthropic_body("claude-haiku-5-5", "Nf3 develops the knight.");
        assert!(haiku.get("fallbacks").is_none());
        assert_eq!(haiku["output_config"]["effort"], "low");
        let older = anthropic_body("claude-haiku-4-5", "x");
        assert!(older.get("output_config").is_none());
    }

    #[test]
    fn reads_the_answers() {
        let reply = json!({
            "stop_reason": "end_turn",
            "content": [
                { "type": "thinking", "thinking": "" },
                { "type": "text", "text": " Nf3 brings the knight out. " }
            ]
        });
        assert_eq!(
            anthropic_text(&reply).unwrap(),
            "Nf3 brings the knight out."
        );
        let refused = json!({ "stop_reason": "refusal", "content": [] });
        assert!(anthropic_text(&refused).is_err());
        let openai = json!({ "choices": [{ "message": { "content": "Good move." } }] });
        assert_eq!(openai_text(&openai).unwrap(), "Good move.");
        assert!(openai_text(&json!({ "choices": [] })).is_err());
    }

    #[test]
    fn errors_say_what_went_wrong() {
        assert_eq!(http_error(401, ""), "The API key was not accepted");
        let body = r#"{"type":"error","error":{"type":"invalid_request_error","message":"model: not found"}}"#;
        assert_eq!(
            http_error(404, body),
            "The model provider answered with HTTP 404: model: not found"
        );
    }
}
