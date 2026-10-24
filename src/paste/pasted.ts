// What a pasted text holds: a position (FEN), games (PGN) or a link to a Lichess game.

import { Chess } from "chessops";
import { parseFen } from "chessops/fen";
import { parsePgn } from "chessops/pgn";

export type Pasted =
    | { kind: "fen"; fen: string }
    | { kind: "pgn"; pgn: string; games: number }
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
