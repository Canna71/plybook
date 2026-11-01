import { invoke } from "@tauri-apps/api/core";

// Mirrors src-tauri/src/secrets.rs. Values go into the OS keychain and are never read back:
// the webview only learns whether a secret is set.

export type SecretName = "lichess_token";

export type SecretStatus = { lichessToken: boolean };

export const secretStatus = () => invoke<SecretStatus>("secret_status");

export const saveSecret = (name: SecretName, value: string) =>
    invoke<void>("secret_set", { name, value });

export const deleteSecret = (name: SecretName) =>
    invoke<void>("secret_delete", { name });

/** Lichess's page for creating a personal token, in the default browser. */
export const openLichessTokenPage = () =>
    invoke<void>("open_lichess_token_page");
