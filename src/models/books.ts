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

/**
 * How many of a game's first moves are book moves (P1.5): up to the first move no book has
 * (moves weighted 0 are there to be avoided, so they do not count). A game that returns to the
 * book later has left it all the same. `line`: each move in SAN with the position before it;
 * `lookup`: the books' moves in a position.
 */
export async function bookPlies(
    line: { fen?: string; san?: string }[],
    lookup: (fen: string) => Promise<BookMove[]>,
): Promise<number> {
    let plies = 0;
    for (const { fen, san } of line) {
        if (!fen || !san) break;
        const moves = await lookup(fen);
        if (!moves.some((m) => m.san === san && m.weight > 0)) break;
        plies++;
    }
    return plies;
}

/** Each move's share of the book's weight, in percent. */
export function bookShares(moves: BookMove[]): number[] {
    const total = moves.reduce((sum, m) => sum + m.weight, 0);
    return moves.map((m) => (total ? Math.round((100 * m.weight) / total) : 0));
}
