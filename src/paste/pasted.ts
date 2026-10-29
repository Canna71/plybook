// What a pasted text holds: a position (FEN), games (PGN) or a link to a Lichess game.

import { Chess } from "chessops";
import { parseFen } from "chessops/fen";
import { parsePgn } from "chessops/pgn";
import { chessableToPgn, isChessableLesson } from "./chessable";

export type Pasted =
    | { kind: "fen"; fen: string }
    /** `note`: what the conversion could not keep (a Chessable lesson cut short) */
    | { kind: "pgn"; pgn: string; games: number; note?: string }
    | { kind: "lichess"; gameId: string };

/** lichess.org/AbCdEfGh, optionally with the 4 player characters, /black, #ply… */
const LICHESS_GAME =
    /^https?:\/\/(?:www\.)?lichess\.org\/([a-zA-Z0-9]{8})(?:[a-zA-Z0-9]{4})?(?:\/(?:white|black))?(?:[?#].*)?$/;

/** A legal position as FEN; a bare placement ("rnbqkbnr/...") is completed with defaults. */
function asFen(text: string): string | undefined {
    if (text.includes("\n") || !/^[1-8pnbrqkPNBRQK/]+(\s|$)/.test(text)) {
        return undefined;
    }
    const parts = text.split(/\s+/);
    if (parts[0].split("/").length !== 8) return undefined;
    const fen = parts.length === 1 ? `${parts[0]} w - - 0 1` : parts.join(" ");
    const setup = parseFen(fen);
    return setup.isOk && Chess.fromSetup(setup.value).isOk ? fen : undefined;
}

export function parsePasted(raw: string): Pasted | undefined {
    const text = raw.trim();
    if (!text) return undefined;

    // a Chessable lesson's JSON, converted to one game (paste/chessable.ts)
    if (isChessableLesson(text)) {
        const converted = chessableToPgn(text);
        if (typeof converted === "string") return undefined;
        return {
            kind: "pgn",
            pgn: converted.pgn,
            games: 1,
            note: converted.stoppedAt
                ? `The lesson stops at ${converted.stoppedAt}: that move is not legal there`
                : undefined,
        };
    }

    const lichess = LICHESS_GAME.exec(text);
    if (lichess) return { kind: "lichess", gameId: lichess[1] };

    const fen = asFen(text);
    if (fen) return { kind: "fen", fen };

    // PGN: tags or numbered moves, and at least one game that has a move
    if (/^\s*\[\w+\s+"/m.test(text) || /^\s*1\.\s*\S/.test(text)) {
        const games = parsePgn(text).filter((g) => g.moves.children.length > 0);
        if (games.length)
            return { kind: "pgn", pgn: text, games: games.length };
    }
    return undefined;
}
