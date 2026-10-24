// Polyglot opening book moves (read by src-tauri/src/books.rs).

// Mirrors BookMove in books.rs
export type BookMove = { uci: string; san: string; weight: number };

/**
 * A move to play from the book, chosen at random in proportion to the weights, so the engine
 * varies its openings. Moves weighted 0 are in the book only to be avoided.
 */
export function pickBookMove(
    moves: BookMove[],
    random: () => number = Math.random,
): string | undefined {
    const playable = moves.filter((m) => m.weight > 0);
    const total = playable.reduce((sum, m) => sum + m.weight, 0);
    if (total === 0) return undefined;
    let r = random() * total;
    for (const m of playable) {
        r -= m.weight;
        if (r < 0) return m.uci;
    }
    return playable[playable.length - 1].uci;
}

/** Each move's share of the book's weight, in percent. */
export function bookShares(moves: BookMove[]): number[] {
    const total = moves.reduce((sum, m) => sum + m.weight, 0);
    return moves.map((m) => (total ? Math.round((100 * m.weight) / total) : 0));
}
