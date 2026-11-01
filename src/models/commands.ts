// Ranking for the command palette (⌘K): every word typed must be found, in order of its
// letters, in an entry's label or keywords. Matches at the start of a word, and in the label
// rather than the keywords, rank higher; then shorter labels. No DOM here, for tests.

export type Searchable = { label: string; keywords?: string };

/**
 * How well one word matches some text; undefined when it doesn't. Higher is better. With
 * `loose`, its letters may also be apart ("lbr" in "library"), but close together: in long
 * text (a folder path) almost any letters turn up in order somewhere.
 */
function wordScore(
    word: string,
    text: string,
    loose: boolean,
): number | undefined {
    const t = text.toLowerCase();
    const at = t.indexOf(word);
    if (at >= 0) {
        const wordStart = at === 0 || /[\s/\-_.]/.test(t[at - 1]);
        return (wordStart ? 100 : 60) - Math.min(at, 30);
    }
    if (!loose) return undefined;
    for (
        let start = t.indexOf(word[0]);
        start >= 0;
        start = t.indexOf(word[0], start + 1)
    ) {
        let i = 1;
        let end = start;
        for (let j = start + 1; j < t.length && i < word.length; j++) {
            if (t[j] === word[i]) {
                i++;
                end = j;
            }
        }
        if (i === word.length && end - start < word.length * 2) return 20;
    }
    return undefined;
}

/** The score of an entry for `query`; undefined when it doesn't match. */
export function commandScore(
    query: string,
    item: Searchable,
): number | undefined {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return 0;
    let total = 0;
    for (const w of words) {
        const inLabel = wordScore(w, item.label, true);
        const inKeywords = item.keywords
            ? wordScore(w, item.keywords, false)
            : undefined;
        if (inLabel === undefined && inKeywords === undefined) return undefined;
        total += Math.max(inLabel ?? -Infinity, (inKeywords ?? -Infinity) - 30);
    }
    return total - item.label.length / 10;
}

/** The entries matching `query`, best first (all of them, in order, for an empty query). */
export function rankCommands<T extends Searchable>(
    query: string,
    items: T[],
): T[] {
    if (!query.trim()) return items;
    return items
        .map((item) => ({ item, score: commandScore(query, item) }))
        .filter((r) => r.score !== undefined)
        .sort((a, b) => b.score! - a.score!)
        .map((r) => r.item);
}
