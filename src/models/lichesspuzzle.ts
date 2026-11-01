// A Lichess puzzle as a PGN the puzzle screen can play: it starts before the opponent's
// set-up move (played automatically), and the board faces the side that solves it.

import { Chess, opposite, parseUci } from "chessops";
import { parseFen } from "chessops/fen";
import { makeSanAndPlay } from "chessops/san";

// Mirrors LichessPuzzle in src-tauri/src/lichess_puzzles.rs
export type LichessPuzzle = {
    id: string;
    fen: string;
    /** UCI: the opponent's set-up move, then the solution */
    moves: string[];
    rating: number;
    themes: string[];
    gameUrl: string;
};

const header = (name: string, value: string) =>
    `[${name} "${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;

export function lichessPuzzlePgn(puzzle: LichessPuzzle): string | undefined {
    const setup = parseFen(puzzle.fen);
    const start = setup.isOk ? Chess.fromSetup(setup.value) : undefined;
    if (!start?.isOk) return undefined;
    const pos = start.value;
    const solver = opposite(pos.turn);
    let fullmove = pos.fullmoves;
    const tokens: string[] = [];
    for (const [i, uci] of puzzle.moves.entries()) {
        const move = parseUci(uci);
        if (!move || !pos.isLegal(move)) return undefined;
        const white = pos.turn === "white";
        if (white) tokens.push(`${fullmove}.`);
        else if (i === 0) tokens.push(`${fullmove}...`);
        tokens.push(makeSanAndPlay(pos, move));
        if (!white) fullmove++;
    }
    return [
        header("Event", `Lichess puzzle ${puzzle.id}`),
        header("Site", puzzle.gameUrl),
        header("Result", "*"),
        header("SetUp", "1"),
        header("FEN", puzzle.fen),
        header("Orientation", solver),
        header("PuzzleRating", String(puzzle.rating)),
        header("PuzzleThemes", puzzle.themes.join(" ")),
        "",
        `${tokens.join(" ")} *`,
        "",
    ].join("\n");
}

/** "hangingPiece" -> "Hanging piece", "mateIn2" -> "Mate in 2" */
export const themeLabel = (theme: string) => {
    const words = theme.replace(/([a-z])([A-Z0-9])/g, "$1 $2").toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
};
