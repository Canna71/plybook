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
    /** Words come between this and the token before: prose, not a line of moves */
    afterWords: boolean;
};

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
        else out.push({ san: m[3], afterWords });
    }
    return out;
}

/**
 * The longest run of moves in `text` that can be played one after the other from `pos`,
 * as SAN. Move numbers must agree with whose move it is ("12..." before a White move ends a
 * run), words between two moves end it (prose: "the pawn on e5"), evaluation signs
 * between moves are skipped and bracketed side lines left out.
 */
export function movesFromText(
    text: string,
    pos: Position,
): { sans: string[]; moves: Move[] } {
    const list = tokens(text);
    let best: { sans: string[]; moves: Move[] } = { sans: [], moves: [] };
    for (let start = 0; start < list.length; start++) {
        if (!list[start].san) continue;
        const p = pos.clone();
        const run: { sans: string[]; moves: Move[] } = { sans: [], moves: [] };
        for (let i = start; i < list.length; i++) {
            const t = list[i];
            if (i > start && t.afterWords) break;
            if (t.number !== undefined) {
                if ((p.turn === "black") !== t.black && run.sans.length) break;
                continue;
            }
            const move = parseSan(p, t.san!);
            if (!move) break;
            run.moves.push(move);
            run.sans.push(makeSanAndPlay(p, move));
        }
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
): { caption: string; following: string } {
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
    return {
        caption: join(below.filter((t) => t.y0 < box.y1 + CAPTION_DEPTH)),
        following: join(below.filter((t) => t.y0 < box.y1 + FOLLOWING_DEPTH)),
    };
}
