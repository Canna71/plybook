// The game behind a position, for the engine (P2.4e): a FEN carries castling, en passant and the
// fifty-move counter, but not which positions came before, so an engine given only the FEN
// cannot see a draw by repetition. Searching `position fen <start> moves …` lets it.

import { Chess, parseUci } from "chessops";
import { makeFen, parseFen } from "chessops/fen";
import { PositionHistory } from "../engine/engineinterfaces";
import { GameModel } from "./GameModel";
import { Path } from "./pgn";

/** Without the move counters: the same position for repetitions */
const placeKey = (fen: string) => fen.split(" ").slice(0, 4).join(" ");

/** The game's start and its moves to `path`; undefined where a move is missing. */
export function gameHistory(
    game: GameModel,
    path: Path,
): PositionHistory | undefined {
    const moves: string[] = [];
    let p = path;
    while (!p.empty()) {
        const data = game.dataAt(p);
        if (!data || !("uci" in data)) return undefined;
        moves.unshift(data.uci);
        p = p.previous();
    }
    return { start: game.initial.fen, moves };
}

/** The history one move further on */
export const withMove = (
    history: PositionHistory | undefined,
    uci: string,
): PositionHistory | undefined =>
    history && { start: history.start, moves: [...history.moves, uci] };

/**
 * `history` when its moves are legal from its start and lead to `fen`; otherwise undefined, so
 * the engine gets the plain position rather than a game that is not this one's.
 */
export function historyFor(
    history: PositionHistory | undefined,
    fen: string,
): PositionHistory | undefined {
    if (!history?.moves.length) return undefined;
    const setup = parseFen(history.start);
    const pos = setup.isOk ? Chess.fromSetup(setup.value) : undefined;
    if (!pos?.isOk) return undefined;
    for (const uci of history.moves) {
        const move = parseUci(uci);
        if (!move || !pos.value.isLegal(move)) return undefined;
        pos.value.play(move);
    }
    return placeKey(makeFen(pos.value.toSetup())) === placeKey(fen)
        ? history
        : undefined;
}
