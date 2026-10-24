import { createSignal } from "solid-js";

/** An image pasted somewhere in the app, waiting for the scan page to read it. */
const [pendingScan, setPendingScan] = createSignal<Blob>();

export { pendingScan, setPendingScan };

/** The first image in a paste, unless it was meant for a text field. */
export function pastedImage(e: ClipboardEvent): Blob | undefined {
    const target = e.target as HTMLElement | null;
    if (
        target?.closest("input, textarea, [contenteditable=true]") ||
        !e.clipboardData
    ) {
        return undefined;
    }
    for (const item of e.clipboardData.items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
            return item.getAsFile() ?? undefined;
        }
    }
}
