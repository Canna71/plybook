import { invoke } from "@tauri-apps/api/core";

/**
 * Lets the user drag a rectangle anywhere on screen (Plybook hides meanwhile) and resolves to
 * that region as a PNG, or undefined if the selection was cancelled.
 */
export async function captureScreenRegion(): Promise<Blob | undefined> {
    const bytes = await invoke<ArrayBuffer>("scan_capture_screen");
    return bytes.byteLength
        ? new Blob([bytes], { type: "image/png" })
        : undefined;
}
