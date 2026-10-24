// Rules for games played against the engine.

import { Color, Position } from "chessops";
import { makeOutcome } from "chessops/pgn";

export type GameEnd = {
    /** PGN Result: "1-0", "0-1" or "1/2-1/2" */
    result: string;
    title: string;
    message: string;
    icon: "success" | "failure" | "thumbup";
};

/** How the game ended in `pos`, from the player's side, or undefined if it goes on. */
export function gameEnd(
    pos: Position,
    engineColor?: Color,
): GameEnd | undefined {
    const outcome = pos.outcome();
    if (!outcome) return undefined;
    const result = makeOutcome(outcome);
    if (!outcome.winner) {
        return {
            result,
            title: "Draw",
            message: pos.isStalemate()
                ? "Stalemate"
                : "Neither side can checkmate",
            icon: "thumbup",
        };
    }
    const playerWon = outcome.winner !== engineColor;
    return {
        result,
        title: "Checkmate",
        message: playerWon ? "You won the game" : "You lost the game",
        icon: playerWon ? "success" : "failure",
    };
}
