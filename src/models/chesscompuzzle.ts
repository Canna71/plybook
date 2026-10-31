// chess.com's daily puzzle (F.30), as src-tauri/src/net.rs fetches it from the public API: a
// PGN with the position (FEN tag) and the solution, the solver's move first. The API gives
// today's puzzle only.

import { parsePgn, makePgn } from "chessops/pgn";
import { parseFen } from "chessops/fen";

/** Mirrors `ChesscomPuzzle` in net.rs */
export type ChesscomPuzzle = {
    title: string;
    /** https://www.chess.com/daily/YYYY-MM-DD */
    url: string;
    fen: string;
    pgn: string;
};

/**
 * The puzzle as a game for the puzzle mode, whose solver is the side at the bottom: the side
 * to move (chess.com puzzles start with the solver's move); named by its title.
 */
export function chesscomPuzzlePgn(puzzle: ChesscomPuzzle): string | undefined {
    const game = parsePgn(puzzle.pgn)[0];
    const setup = parseFen(game?.headers.get("FEN") ?? puzzle.fen);
    if (!game || !setup.isOk || !game.moves.children.length) return undefined;
    game.headers.set("Event", `chess.com daily puzzle: ${puzzle.title}`);
    game.headers.set("Site", puzzle.url);
    game.headers.set("SetUp", "1");
    game.headers.set("FEN", game.headers.get("FEN") ?? puzzle.fen);
    game.headers.set("Orientation", setup.value.turn);
    return makePgn(game);
}

/** Whether the puzzle is the one a link names (the API has only today's) */
export const isPuzzleOf = (puzzle: ChesscomPuzzle, url: string) =>
    puzzle.url
        .replace(/^http:/, "https:")
        .replace("//chess.com", "//www.chess.com") === url;
