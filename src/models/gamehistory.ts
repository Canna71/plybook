// The game behind a position, for the engine (P2.4e): a FEN carries castling, en passant and the
// fifty-move counter, but not which positions came before, so an engine given only the FEN
// cannot see a draw by repetition. Searching `position fen <start> moves …` lets it.

import {
    Chess,
    makeUci,
    NormalMove,
    parseUci,
    squareFile,
    squareRank,
} from "chessops";
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
 * A move as a standard UCI engine reads it. chessops writes castling as the king taking its own
 * rook (`e1h1`), which an engine not in Chess960 mode takes for an illegal move: Stockfish then
 * drops the rest of the moves and searches an earlier position, for the other side (F.28, F.29).
 */
function engineUci(pos: Chess, move: NormalMove): string {
    if (
        pos.board.getRole(move.from) === "king" &&
        pos.board.rook.has(move.to) &&
        pos.board[pos.turn].has(move.to)
    ) {
        const file = squareFile(move.to) > squareFile(move.from) ? 6 : 2;
        return makeUci({
            from: move.from,
            to: squareRank(move.from) * 8 + file,
        });
    }
    return makeUci(move);
}

/**
 * `history` when its moves are legal from its start and lead to `fen`, with castling written as
 * engines expect; otherwise undefined, so the engine gets the plain position rather than a game
 * that is not this one's.
 */
export function historyFor(
    history: PositionHistory | undefined,
    fen: string,
): PositionHistory | undefined {
    if (!history?.moves.length) return undefined;
    const setup = parseFen(history.start);
    const pos = setup.isOk ? Chess.fromSetup(setup.value) : undefined;
    if (!pos?.isOk) return undefined;
    const moves: string[] = [];
    for (const uci of history.moves) {
        const move = parseUci(uci);
        if (!move || !("from" in move) || !pos.value.isLegal(move))
            return undefined;
        moves.push(engineUci(pos.value, move));
        pos.value.play(move);
    }
    return placeKey(makeFen(pos.value.toSetup())) === placeKey(fen)
        ? { start: history.start, moves }
        : undefined;
}
