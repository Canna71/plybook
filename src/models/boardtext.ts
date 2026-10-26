// Text that points at the board (P2.8): explanations mention squares ("the queen on d8") and
// moves ("White answers Nxf7"). Splits such text into pieces that the UI can make hoverable:
// a square highlights it, a move draws its arrow. Moves are resolved against the positions the
// text talks about, following a line ("After Nxf7 Qe7 Nxh8"): each move found continues from
// the position it leads to. No DOM here, for tests.

import { Chess, makeSquare, NormalMove, Position } from "chessops";
import { parseFen } from "chessops/fen";
import { parseSan } from "chessops/san";

export type TextPiece =
    | { text: string }
    | { text: string; square: string }
    | { text: string; from: string; to: string };

// a SAN move (Nxf7, exd5, e8=Q+, O-O-O) or a bare square
const TOKEN =
    /\b(O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?)([+#]?)|\b([a-h][1-8])\b/g;

const positionOf = (fen: string): Position | undefined => {
    const setup = parseFen(fen);
    const pos = setup.isOk ? Chess.fromSetup(setup.value) : undefined;
    return pos?.isOk ? pos.value : undefined;
};

/**
 * Splits `text` into plain text, squares and moves. A token that is a legal move in one of
 * the positions in play becomes a move (from-to); a square name otherwise is a square.
 */
export function boardText(text: string, fens: string[]): TextPiece[] {
    const starts = fens.map(positionOf).filter((p): p is Position => !!p);
    // the positions a move may be played in: the given ones, and the one the last move led to
    let current: Position[] = starts;
    const pieces: TextPiece[] = [];
    let last = 0;
    for (const m of text.matchAll(TOKEN)) {
        const [whole, san, , square] = m;
        const at = m.index!;
        // "e4" inside a word or a number ("1e4") is not a square
        if (at > 0 && /[\w-]/.test(text[at - 1]) && !san?.startsWith("O-O"))
            continue;
        if (at > last) pieces.push({ text: text.slice(last, at) });
        let move: NormalMove | undefined;
        let next: Position | undefined;
        // "the queen on d8" names a square, even where a pawn could move to d8
        const named = /\bon $/.test(text.slice(Math.max(0, at - 3), at));
        if (san && !named) {
            for (const pos of current) {
                const parsed = parseSan(pos, san);
                if (parsed && "from" in parsed) {
                    move = parsed;
                    next = pos.clone();
                    next.play(parsed);
                    break;
                }
            }
        }
        if (move && next) {
            pieces.push({
                text: whole,
                from: makeSquare(move.from),
                to: makeSquare(move.to),
            });
            current = [next, ...starts];
        } else if (
            square ??
            (san && /^[a-h][1-8]$/.test(san) ? san : undefined)
        ) {
            pieces.push({ text: whole, square: square ?? san });
        } else {
            pieces.push({ text: whole });
        }
        last = at + whole.length;
    }
    if (last < text.length) pieces.push({ text: text.slice(last) });
    // neighbouring plain pieces read better joined
    return pieces.reduce<TextPiece[]>((all, p) => {
        const prev = all.at(-1);
        if (
            prev &&
            !("square" in prev) &&
            !("from" in prev) &&
            !("square" in p) &&
            !("from" in p)
        ) {
            all[all.length - 1] = { text: prev.text + p.text };
        } else {
            all.push(p);
        }
        return all;
    }, []);
}
