//! Secrets (the Lichess token, later model API keys) live in the OS keychain: macOS Keychain or
//! Windows Credential Manager. The webview can store, delete and ask whether a secret is set,
//! but never read one back: Rust attaches them to requests itself (see net.rs).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

/// Keychain service name: one entry per secret under it.
const SERVICE: &str = "com.canna71.plybook";
/// The service before the rename to Plybook (F.18): a secret found only there moves over
const OLD_SERVICE: &str = "com.canna71.rechess";

/// The secrets the app knows; nothing else can be stored.
#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Secret {
    /// A Lichess personal API token (no permissions needed), for the opening explorer
    LichessToken,
    /// The explanation model's provider, endpoint and key together (model.rs); set only
    /// through model_configure, which keeps the key bound to its endpoint
    ModelProvider,
}

impl Secret {
    pub(crate) fn key(self) -> &'static str {
        match self {
            Secret::LichessToken => "lichess-token",
            Secret::ModelProvider => "model-provider",
        }
    }
}

pub trait SecretStore: Send + Sync {
    fn get(&self, key: &str) -> Result<Option<String>, String>;
    fn set(&self, key: &str, value: &str) -> Result<(), String>;
    fn delete(&self, key: &str) -> Result<(), String>;
}

/// The OS keychain. Note that macOS asks once per build for unsigned (ad-hoc) builds, as their
/// identity changes; signed builds (`pnpm build:mac`) keep access.
pub struct Keychain;

fn read_entry(service: &str, key: &str) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(service, key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Could not read the keychain: {e}")),
    }
}

impl SecretStore for Keychain {
    fn get(&self, key: &str) -> Result<Option<String>, String> {
        if let Some(value) = read_entry(SERVICE, key)? {
            return Ok(Some(value));
        }
        // saved before the rename: moved under the new service the first time it is read
        let Some(value) = read_entry(OLD_SERVICE, key)? else {
            return Ok(None);
        };
        if self.set(key, &value).is_ok() {
            if let Ok(old) = keyring::Entry::new(OLD_SERVICE, key) {
                let _ = old.delete_credential();
            }
        }
        Ok(Some(value))
    }

    fn set(&self, key: &str, value: &str) -> Result<(), String> {
        keyring::Entry::new(SERVICE, key)
            .and_then(|entry| entry.set_password(value))
            .map_err(|e| format!("Could not save to the keychain: {e}"))
    }

    fn delete(&self, key: &str) -> Result<(), String> {
        let entry = keyring::Entry::new(SERVICE, key).map_err(|e| e.to_string())?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!("Could not delete from the keychain: {e}")),
        }
    }
}

/// The secrets, read from the keychain only when a value is used, and once per run: each read
/// may ask the user (an unsigned build is a stranger to the keychain every time it is built),
/// so asking whether something is set must not read it. That is answered from the index, a
/// file of what is set and its non-secret summary (the model's provider and endpoint), never a
/// value.
pub struct Secrets {
    store: Box<dyn SecretStore>,
    /// Values read this run; None: none stored
    cache: Mutex<HashMap<&'static str, Option<String>>>,
    index: Mutex<Index>,
}

/// What is set, by key: its summary (true when there is nothing to say), null when not set. A
/// key missing from it is unknown (written before the index existed): read once to fill it.
#[derive(Default)]
struct Index {
    path: Option<PathBuf>,
    entries: Option<HashMap<String, Value>>,
}

impl Index {
    fn entries(&mut self) -> &mut HashMap<String, Value> {
        let path = self.path.clone();
        self.entries.get_or_insert_with(|| {
            path.and_then(|p| fs::read_to_string(p).ok())
                .and_then(|text| serde_json::from_str(&text).ok())
                .unwrap_or_default()
        })
    }

    fn record(&mut self, key: &str, summary: Value) {
        self.entries().insert(key.to_string(), summary);
        if let (Some(path), Some(entries)) = (&self.path, &self.entries) {
            if let Ok(text) = serde_json::to_string_pretty(entries) {
                let _ = fs::write(path, text);
            }
        }
    }
}

impl Default for Secrets {
    fn default() -> Self {
        Secrets::new(Box::new(Keychain))
    }
}

impl Secrets {
    pub fn new(store: Box<dyn SecretStore>) -> Self {
        Secrets {
            store,
            cache: Mutex::new(HashMap::new()),
            index: Mutex::new(Index::default()),
        }
    }

    /// Where the index is kept (set up at start; without it, it lives for the run only).
    pub fn set_index_path(&self, path: PathBuf) {
        let mut index = self.index.lock().unwrap();
        index.path = Some(path);
        index.entries = None;
    }

    /// For Rust code that needs the value (never sent to the webview). The first use in a run
    /// reads the keychain.
    pub fn get(&self, secret: Secret) -> Result<Option<String>, String> {
        let key = secret.key();
        if let Some(value) = self.cache.lock().unwrap().get(key) {
            return Ok(value.clone());
        }
        let value = self.store.get(key)?;
        self.cache.lock().unwrap().insert(key, value.clone());
        Ok(value)
    }

    /// Stores a value, with what may be said about it without reading it (`summary`).
    pub(crate) fn put(&self, secret: Secret, value: &str, summary: Value) -> Result<(), String> {
        self.store.set(secret.key(), value)?;
        self.cache
            .lock()
            .unwrap()
            .insert(secret.key(), Some(value.to_string()));
        self.index.lock().unwrap().record(secret.key(), summary);
        Ok(())
    }

    pub(crate) fn remove(&self, secret: Secret) -> Result<(), String> {
        self.store.delete(secret.key())?;
        self.cache.lock().unwrap().insert(secret.key(), None);
        self.index.lock().unwrap().record(secret.key(), Value::Null);
        Ok(())
    }

    /// What may be said about a secret without reading it: its summary, or None when it is not
    /// set. Only a secret the index does not know yet is read, once, and `summarize` turns its
    /// value into the summary.
    pub(crate) fn summary(
        &self,
        secret: Secret,
        summarize: impl Fn(&str) -> Value,
    ) -> Result<Option<Value>, String> {
        let known = self
            .index
            .lock()
            .unwrap()
            .entries()
            .get(secret.key())
            .cloned();
        let summary = match known {
            Some(summary) => summary,
            None => {
                let summary = self
                    .get(secret)?
                    .map_or(Value::Null, |value| summarize(&value));
                self.index
                    .lock()
                    .unwrap()
                    .record(secret.key(), summary.clone());
                summary
            }
        };
        Ok((!summary.is_null()).then_some(summary))
    }

    fn set(&self, secret: Secret, value: &str) -> Result<(), String> {
        if secret == Secret::ModelProvider {
            return Err("Set the model in Settings → Explanations".to_string());
        }
        let value = value.trim();
        if value.is_empty() || value.len() > 512 || value.chars().any(char::is_whitespace) {
            return Err("That does not look like a token".to_string());
        }
        self.put(secret, value, Value::Bool(true))
    }

    fn status(&self) -> Result<SecretStatus, String> {
        Ok(SecretStatus {
            lichess_token: self
                .summary(Secret::LichessToken, |_| Value::Bool(true))?
                .is_some(),
        })
    }
}

/// Which secrets are set; values are never returned.
#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SecretStatus {
    lichess_token: bool,
}

#[tauri::command]
pub async fn secret_set(
    secrets: State<'_, Secrets>,
    name: Secret,
    value: String,
) -> Result<(), String> {
    secrets.set(name, &value)
}

#[tauri::command]
pub async fn secret_delete(secrets: State<'_, Secrets>, name: Secret) -> Result<(), String> {
    secrets.remove(name)
}

#[tauri::command]
pub async fn secret_status(secrets: State<'_, Secrets>) -> Result<SecretStatus, String> {
    secrets.status()
}

/// Opens Lichess's page for creating a personal token (fixed URL, in the default browser).
#[tauri::command]
pub fn open_lichess_token_page() -> Result<(), String> {
    open::that_detached(
        "https://lichess.org/account/oauth/token/create?description=Plybook%20opening%20explorer",
    )
    .map_err(|e| e.to_string())
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::sync::Mutex;

    /// Keeps secrets in memory, so tests never touch the real keychain.
    #[derive(Default)]
    pub(crate) struct MemoryStore(Mutex<HashMap<String, String>>);

    impl SecretStore for MemoryStore {
        fn get(&self, key: &str) -> Result<Option<String>, String> {
            Ok(self.0.lock().unwrap().get(key).cloned())
        }
        fn set(&self, key: &str, value: &str) -> Result<(), String> {
            self.0.lock().unwrap().insert(key.into(), value.into());
            Ok(())
        }
        fn delete(&self, key: &str) -> Result<(), String> {
            self.0.lock().unwrap().remove(key);
            Ok(())
        }
    }

    /// Counts the keychain reads, which are what may ask the user.
    #[derive(Default)]
    struct CountingStore {
        inner: MemoryStore,
        reads: std::sync::Arc<std::sync::atomic::AtomicUsize>,
    }

    impl SecretStore for CountingStore {
        fn get(&self, key: &str) -> Result<Option<String>, String> {
            self.reads.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            self.inner.get(key)
        }
        fn set(&self, key: &str, value: &str) -> Result<(), String> {
            self.inner.set(key, value)
        }
        fn delete(&self, key: &str) -> Result<(), String> {
            self.inner.delete(key)
        }
    }

    #[test]
    fn status_reads_the_keychain_at_most_once_ever() {
        let dir = std::env::temp_dir().join(format!("plybook-secrets-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let index = dir.join("secrets-index.json");
        let _ = fs::remove_file(&index);

        // a token saved before the index existed: the first status reads it, once
        let store = CountingStore::default();
        store.inner.set("lichess-token", "lip_old").unwrap();
        let reads = store.reads.clone();
        let secrets = Secrets::new(Box::new(store));
        secrets.set_index_path(index.clone());
        assert!(secrets.status().unwrap().lichess_token);
        assert!(secrets.status().unwrap().lichess_token);
        assert_eq!(reads.load(std::sync::atomic::Ordering::SeqCst), 1);

        // a new run (a new build) with the index: no read at all
        let store = CountingStore::default();
        let reads = store.reads.clone();
        let secrets = Secrets::new(Box::new(store));
        secrets.set_index_path(index.clone());
        assert!(secrets.status().unwrap().lichess_token);
        assert_eq!(reads.load(std::sync::atomic::Ordering::SeqCst), 0);
        // using the value reads it, once per run
        secrets.get(Secret::LichessToken).unwrap();
        secrets.get(Secret::LichessToken).unwrap();
        assert_eq!(reads.load(std::sync::atomic::Ordering::SeqCst), 1);
        // the index never holds the value
        assert!(!fs::read_to_string(&index).unwrap().contains("lip_old"));
        secrets.remove(Secret::LichessToken).unwrap();
        assert!(!secrets.status().unwrap().lichess_token);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn stores_tokens_and_reports_only_whether_they_are_set() {
        let secrets = Secrets::new(Box::new(MemoryStore::default()));
        assert_eq!(
            secrets.status().unwrap(),
            SecretStatus {
                lichess_token: false
            }
        );
        secrets.set(Secret::LichessToken, "  lip_abc123  ").unwrap();
        assert_eq!(
            secrets.get(Secret::LichessToken).unwrap().as_deref(),
            Some("lip_abc123")
        );
        let status = serde_json::to_value(secrets.status().unwrap()).unwrap();
        assert_eq!(status, serde_json::json!({ "lichessToken": true }));
        secrets.remove(Secret::LichessToken).unwrap();
        assert_eq!(secrets.get(Secret::LichessToken).unwrap(), None);
    }

    #[test]
    fn rejects_values_that_are_not_tokens() {
        let secrets = Secrets::new(Box::new(MemoryStore::default()));
        for bad in ["", "   ", "two words"] {
            assert!(secrets.set(Secret::LichessToken, bad).is_err(), "{bad:?}");
        }
        assert!(secrets.set(Secret::LichessToken, &"x".repeat(600)).is_err());
    }

    #[test]
    fn the_model_entry_is_not_set_through_secret_set() {
        // model.rs keeps the key bound to its endpoint; a bare value would break that
        let secrets = Secrets::new(Box::new(MemoryStore::default()));
        assert!(secrets.set(Secret::ModelProvider, "sk-anything").is_err());
        assert_eq!(secrets.get(Secret::ModelProvider).unwrap(), None);
    }

    /// The real OS keychain, with a throwaway entry:
    /// cargo test --lib real_keychain -- --ignored
    #[test]
    #[ignore]
    fn real_keychain_round_trip() {
        let entry = keyring::Entry::new("com.canna71.plybook.test", "round-trip").unwrap();
        entry.set_password("lip_test").unwrap();
        assert_eq!(entry.get_password().unwrap(), "lip_test");
        entry.delete_credential().unwrap();
        assert!(matches!(entry.get_password(), Err(keyring::Error::NoEntry)));
    }

    #[test]
    fn only_known_secrets_can_be_named() {
        assert_eq!(
            serde_json::from_str::<Secret>("\"lichess_token\"").unwrap(),
            Secret::LichessToken
        );
        assert!(serde_json::from_str::<Secret>("\"anything_else\"").is_err());
    }
}
