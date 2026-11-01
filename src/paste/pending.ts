import { createSignal } from "solid-js";

/** An image pasted somewhere in the app, waiting for the scan page to read it. */
const [pendingScan, setPendingScan] = createSignal<Blob>();

/** Games pasted (or fetched from a pasted link), waiting for the analysis page to open them. */
const [pendingPgn, setPendingPgn] = createSignal<string>();

export { pendingScan, setPendingScan, pendingPgn, setPendingPgn };

/** A paste meant for the app rather than a text field. */
const forTheApp = (e: ClipboardEvent) => {
    const target = e.target as HTMLElement | null;
    return (
        !!e.clipboardData &&
        !target?.closest("input, textarea, [contenteditable=true]")
    );
};

/** The first image in a paste, unless it was meant for a text field. */
export function pastedImage(e: ClipboardEvent): Blob | undefined {
    if (!forTheApp(e)) return undefined;
    for (const item of e.clipboardData!.items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
            return item.getAsFile() ?? undefined;
        }
    }
}

/** The pasted text, unless it was meant for a text field. */
export function pastedText(e: ClipboardEvent): string | undefined {
    return forTheApp(e) ? e.clipboardData!.getData("text/plain") : undefined;
}
