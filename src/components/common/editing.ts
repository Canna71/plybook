// Editing in contenteditable elements: pasting plain text only, selecting everything.

function isSelectionIn(div: HTMLDivElement, selection: Selection) {
    if (!selection.rangeCount) return false;
    return div.contains(selection.getRangeAt(0).commonAncestorContainer);
}

/** Pastes the clipboard as plain text (no markup) at the selection in `editableDiv` */
export async function safePaste(
    editableDiv: HTMLDivElement,
    e: ClipboardEvent,
) {
    e.preventDefault();
    const selection = window.getSelection();
    if (!selection) return;
    if (!isSelectionIn(editableDiv, selection)) return;
    const text = (await navigator.clipboard.readText()).trim();

    const range = selection.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);

    // the caret goes after the pasted text
    selection.removeAllRanges();
    const newRange = document.createRange();
    newRange.setStartAfter(textNode);
    newRange.setEndAfter(textNode);
    selection.addRange(newRange);

    editableDiv.normalize();
}

export function selectAll(el: HTMLElement) {
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(el);
    sel?.removeAllRanges();
    sel?.addRange(range);
}
