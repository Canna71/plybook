// Opening names (P1.7): the ECO code and name of a game's opening, from lichess-org/chess-openings
// (CC0, src/assets/openings). Each named line is played out to the position it reaches; a game
// is named after the last position on its way that has a name, so a transposition is named
// by where it arrived, not by its move order. Pure: the data is passed in (openingdata.ts).

import { Chess } from "chessops";
import { makeFen } from "chessops/fen";
import { parseSan } from "chessops/san";

export type Opening = {
    /** "C78" */
    eco: string;
    /** "Ruy Lopez: Morphy Defense" */
    name: string;
    /** Moves of its named line */
    plies: number;
};

/**
 * A position as names know it: the pieces, the side to move and the castling rights. The en
 * passant square is left out: a move order may allow an en passant capture another does not.
 */
export const openingKey = (fen: string) => fen.split(" ").slice(0, 3).join(" ");

/**
 * The named positions in the TSV files (columns eco, name, pgn, with a header line). When two
 * names reach the same position, the first in the files keeps it.
 */
export function parseOpenings(tsvs: string[]): Map<string, Opening> {
    const openings = new Map<string, Opening>();
    for (const tsv of tsvs) {
        for (const line of tsv.split("\n").slice(1)) {
            const [eco, name, pgn] = line.trim().split("\t");
            if (!eco || !name || !pgn) continue;
            const pos = Chess.default();
            let plies = 0;
            let legal = true;
            for (const token of pgn.split(/\s+/)) {
                if (/^\d+\./.test(token)) continue;
                const move = parseSan(pos, token);
                if (!move) {
                    legal = false;
                    break;
                }
                pos.play(move);
                plies++;
            }
            const key = openingKey(makeFen(pos.toSetup()));
            if (legal && !openings.has(key))
                openings.set(key, { eco, name, plies });
        }
    }
    return openings;
}

/** The most specific named opening of a line given as its positions, oldest first */
export function openingOf(
    fens: (string | undefined)[],
    openings: Map<string, Opening>,
): Opening | undefined {
    for (let i = fens.length - 1; i >= 0; i--) {
        const fen = fens[i];
        const named = fen && openings.get(openingKey(fen));
        if (named) return named;
    }
    return undefined;
}

/** "Ruy Lopez: Morphy Defense (C78)" */
export const describeOpening = (opening: Opening) =>
    `${opening.name} (${opening.eco})`;
