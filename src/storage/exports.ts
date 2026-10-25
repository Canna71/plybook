import { invoke } from "@tauri-apps/api/core";

/**
 * Saves an exported file where the user picks, through a save dialog opened by Rust (the
 * webview cannot write outside the app's folder). The bytes travel raw, not as JSON. The
 * saved path, or undefined if cancelled.
 */
export const saveExport = async (
    bytes: Uint8Array,
    kind: "png" | "gif",
    name: string,
) =>
    (await invoke<string | null>("export_save", bytes, {
        headers: { "x-kind": kind, "x-name": encodeURIComponent(name) },
    })) ?? undefined;
