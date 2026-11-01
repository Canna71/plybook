// Chess in a book's text: whose move a diagram is, and the moves the text gives from it.

import { Color, Move, Position } from "chessops";
import { makeSanAndPlay, parseSan } from "chessops/san";

/** A run of text on a page, its box in fractions of the page (0–1, from the top left). */
export type TextItem = {
    str: string;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
};

type Box = { x0: number; y0: number; x1: number; y1: number };

/** Below a diagram, its caption ("White to play") is within this share of the page. */
const CAPTION_DEPTH = 0.06;
/** The text that follows a diagram and may give its moves: at most this far below it. */
const FOLLOWING_DEPTH = 0.3;
/** A side-to-move letter left of a diagram is within this share of the page from it. */
const MARKER_DISTANCE = 0.1;

const FIGURINES: Record<string, string> = {
    "♔": "K",
    "♚": "K",
    "♕": "Q",
    "♛": "Q",
    "♖": "R",
    "♜": "R",
    "♗": "B",
    "♝": "B",
    "♘": "N",
    "♞": "N",
    "♙": "",
    "♟": "",
};

/** Figurines as letters, zeros in castling as O, ellipses as three dots, dashes as hyphens. */
export function normalizeChessText(text: string): string {
    return text
        .replace(/[♔♚♕♛♖♜♗♝♘♞♙♟]/g, (c) => FIGURINES[c])
        .replace(/…/g, "...")
        .replace(/[‐‑–—]/g, "-")
        .replace(/\b0-0-0\b/g, "O-O-O")
        .replace(/\b0-0\b/g, "O-O");
}

/**
 * Whose move it is, from a caption or the text after a diagram: "White to play", "Black
 * wins", or the first move number ("12...Nf6" is Black's move, "12.Nf3" White's).
 */
export function turnFromText(text: string): Color | undefined {
    const t = normalizeChessText(text);
    const said =
        /\b(white|black)\s+(to\s+(play|move)|plays|moves|wins|draws|is\s+to\s+move)\b/i.exec(
            t,
        );
    const numbered = /\b\d+\s*(\.\.\.|\.)\s*(?=[KQRBNO]|[a-h][1-8x])/.exec(t);
    if (said && (!numbered || said.index <= numbered.index)) {
        return said[1].toLowerCase() as Color;
    }
    if (numbered) return numbered[1] === "..." ? "black" : "white";
    return undefined;
}

const TOKEN =
    /(\d+)\s*(\.\.\.|\.)|(O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=?[QRBN])?)[+#]?/g;

type Token = {
    number?: number;
    black?: boolean;
    san?: string;
    /**
     * A symbol we can't read stands right before the move ("Ìf3"): a piece drawn with a chess
     * font, so not a pawn move whatever the letters say
     */
    unknownPiece?: boolean;
    /** That symbol: a book draws each piece with the same one throughout */
    glyph?: string;
    /** Words come between this and the token before: prose, not a line of moves */
    afterWords: boolean;
};

type Run = { sans: string[]; moves: Move[] };

const PIECES = ["N", "B", "R", "Q", "K"];

function tokens(text: string): Token[] {
    let t = normalizeChessText(text);
    // side lines in brackets are not the moves that follow the diagram
    for (let prev = ""; prev !== t; ) {
        prev = t;
        t = t.replace(/\([^()]*\)|\[[^[\]]*\]/g, " ");
    }
    const out: Token[] = [];
    let end = 0;
    for (const m of t.matchAll(TOKEN)) {
        const afterWords = /[A-Za-z]{2,}/.test(t.slice(end, m.index));
        end = m.index + m[0].length;
        if (m[1])
            out.push({ number: +m[1], black: m[2] === "...", afterWords });
        else {
            const before = t[m.index - 1];
            const unknownPiece =
                before !== undefined &&
                !/[\s\d.([\]{}"'“‘,;:!?+-]/.test(before) &&
                !/^[KQRBNO]/.test(m[3]);
            out.push({
                san: m[3],
                unknownPiece,
                glyph: unknownPiece ? before : undefined,
                afterWords,
            });
        }
    }
    return out;
}

/**
 * Of several readings, the one that plays the most moves; when readings that play as many
 * disagree, only the moves they share (no guessing between them).
 */
function agreed(runs: Run[]): Run {
    const longest = Math.max(0, ...runs.map((r) => r.sans.length));
    const top = runs.filter((r) => r.sans.length === longest);
    if (!top.length) return { sans: [], moves: [] };
    let n = 0;
    while (n < longest && top.every((r) => r.sans[n] === top[0].sans[n])) n++;
    return { sans: top[0].sans.slice(0, n), moves: top[0].moves.slice(0, n) };
}

/**
 * The moves from token `i` on, played from `pos`. An unknown piece symbol is tried as each
 * piece it could be (keeping each symbol to one piece, and each piece to one symbol), and
 * the readings are compared with `agreed`.
 */
function runFrom(
    list: Token[],
    i: number,
    pos: Position,
    glyphs: Map<string, string>,
    played: boolean,
): Run {
    const run: Run = { sans: [], moves: [] };
    const p = pos.clone();
    for (; i < list.length; i++) {
        const t = list[i];
        const anyPlayed = played || run.sans.length > 0;
        if (anyPlayed && t.afterWords) break;
        if (t.number !== undefined) {
            if ((p.turn === "black") !== t.black && anyPlayed) break;
            continue;
        }
        if (t.unknownPiece) {
            const known = glyphs.get(t.glyph!);
            const taken = new Set(glyphs.values());
            const pieces = known
                ? [known]
                : PIECES.filter((x) => !taken.has(x));
            const readings: Run[] = [];
            for (const piece of pieces) {
                const move = parseSan(p, piece + t.san);
                if (!move) continue;
                const q = p.clone();
                const san = makeSanAndPlay(q, move);
                const rest = runFrom(
                    list,
                    i + 1,
                    q,
                    new Map(glyphs).set(t.glyph!, piece),
                    true,
                );
                readings.push({
                    sans: [san, ...rest.sans],
                    moves: [move, ...rest.moves],
                });
            }
            const tail = agreed(readings);
            return {
                sans: [...run.sans, ...tail.sans],
                moves: [...run.moves, ...tail.moves],
            };
        }
        const move = parseSan(p, t.san!);
        if (!move) break;
        run.moves.push(move);
        run.sans.push(makeSanAndPlay(p, move));
    }
    return run;
}

/**
 * The longest run of moves in `text` that can be played one after the other from `pos`,
 * as SAN. Move numbers must agree with whose move it is ("12..." before a White move ends a
 * run), words between two moves end it (prose: "the pawn on e5"), evaluation signs
 * between moves are skipped and bracketed side lines left out. A move after a symbol we can't
 * read (a chess font's piece) is read as whichever piece makes the line play on longest, the
 * same symbol always being the same piece; a piece symbol the PDF drops entirely can't be told
 * from a pawn move.
 */
export function movesFromText(text: string, pos: Position): Run {
    const list = tokens(text);
    let best: Run = { sans: [], moves: [] };
    for (let start = 0; start < list.length; start++) {
        if (!list[start].san) continue;
        const run = runFrom(list, start, pos, new Map(), false);
        if (run.sans.length > best.sans.length) best = run;
    }
    return best;
}

/**
 * The text near a diagram: its caption just below it, and the text that follows (below it,
 * in its column), each in reading order.
 */
export function textNearDiagram(
    items: TextItem[],
    box: Box,
): { caption: string; following: string; marker?: Color } {
    const inColumn = (t: TextItem) => t.x1 > box.x0 && t.x0 < box.x1;
    const below = items
        .filter((t) => inColumn(t) && t.y0 >= box.y1 - 0.005)
        .sort((a, b) =>
            Math.abs(a.y0 - b.y0) < 0.004 ? a.x0 - b.x0 : a.y0 - b.y0,
        );
    const join = (list: TextItem[]) =>
        list
            .map((t) => t.str)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
    // a lone "W" or "B" beside the diagram, level with it (Gambit's books, e.g. Collins); OCR
    // reads the B as an 8 at times, and the diagram itself has no text to mistake for it
    const marker = items.find(
        (t) =>
            /^[WwBb8]$/.test(t.str.trim()) &&
            t.x1 <= box.x0 + 0.005 &&
            t.x0 >= box.x0 - MARKER_DISTANCE &&
            t.y1 > box.y0 &&
            t.y0 < box.y1,
    );
    return {
        caption: join(below.filter((t) => t.y0 < box.y1 + CAPTION_DEPTH)),
        following: join(below.filter((t) => t.y0 < box.y1 + FOLLOWING_DEPTH)),
        marker: marker && (/[Ww]/.test(marker.str) ? "white" : "black"),
    };
}
