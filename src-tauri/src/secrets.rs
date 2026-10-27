//! Secrets (the Lichess token, later model API keys) live in the OS keychain: macOS Keychain or
//! Windows Credential Manager. The webview can store, delete and ask whether a secret is set,
//! but never read one back: Rust attaches them to requests itself (see net.rs).

use serde::{Deserialize, Serialize};
use tauri::State;

/// Keychain service name: one entry per secret under it.
const SERVICE: &str = "com.canna71.rechess";

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

impl SecretStore for Keychain {
    fn get(&self, key: &str) -> Result<Option<String>, String> {
        let entry = keyring::Entry::new(SERVICE, key).map_err(|e| e.to_string())?;
        match entry.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(format!("Could not read the keychain: {e}")),
        }
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

pub struct Secrets(pub Box<dyn SecretStore>);

impl Default for Secrets {
    fn default() -> Self {
        Secrets(Box::new(Keychain))
    }
}

impl Secrets {
    /// For Rust code that needs the value (never sent to the webview).
    pub fn get(&self, secret: Secret) -> Result<Option<String>, String> {
        self.0.get(secret.key())
    }

    fn set(&self, secret: Secret, value: &str) -> Result<(), String> {
        if secret == Secret::ModelProvider {
            return Err("Set the model in Settings → Explanations".to_string());
        }
        let value = value.trim();
        if value.is_empty() || value.len() > 512 || value.chars().any(char::is_whitespace) {
            return Err("That does not look like a token".to_string());
        }
        self.0.set(secret.key(), value)
    }

    fn status(&self) -> Result<SecretStatus, String> {
        Ok(SecretStatus {
            lichess_token: self.get(Secret::LichessToken)?.is_some(),
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
    secrets.0.delete(name.key())
}

#[tauri::command]
pub async fn secret_status(secrets: State<'_, Secrets>) -> Result<SecretStatus, String> {
    secrets.status()
}

/// Opens Lichess's page for creating a personal token (fixed URL, in the default browser).
#[tauri::command]
pub fn open_lichess_token_page() -> Result<(), String> {
    open::that_detached(
        "https://lichess.org/account/oauth/token/create?description=ReChess%20opening%20explorer",
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

    #[test]
    fn stores_tokens_and_reports_only_whether_they_are_set() {
        let secrets = Secrets(Box::new(MemoryStore::default()));
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
        secrets.0.delete(Secret::LichessToken.key()).unwrap();
        assert_eq!(secrets.get(Secret::LichessToken).unwrap(), None);
    }

    #[test]
    fn rejects_values_that_are_not_tokens() {
        let secrets = Secrets(Box::new(MemoryStore::default()));
        for bad in ["", "   ", "two words"] {
            assert!(secrets.set(Secret::LichessToken, bad).is_err(), "{bad:?}");
        }
        assert!(secrets.set(Secret::LichessToken, &"x".repeat(600)).is_err());
    }

    #[test]
    fn the_model_entry_is_not_set_through_secret_set() {
        // model.rs keeps the key bound to its endpoint; a bare value would break that
        let secrets = Secrets(Box::new(MemoryStore::default()));
        assert!(secrets.set(Secret::ModelProvider, "sk-anything").is_err());
        assert_eq!(secrets.get(Secret::ModelProvider).unwrap(), None);
    }

    /// The real OS keychain, with a throwaway entry:
    /// cargo test --lib real_keychain -- --ignored
    #[test]
    #[ignore]
    fn real_keychain_round_trip() {
        let entry = keyring::Entry::new("com.canna71.rechess.test", "round-trip").unwrap();
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
