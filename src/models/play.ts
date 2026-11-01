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

/**
 * `flagged` ran out of time in `pos`: the other side wins, unless it has too little material
 * ever to checkmate, which makes it a draw.
 */
export function timeoutEnd(
    pos: Position,
    flagged: Color,
    engineColor?: Color,
): GameEnd {
    const winner: Color = flagged === "white" ? "black" : "white";
    if (pos.hasInsufficientMaterial(winner)) {
        return {
            result: "1/2-1/2",
            title: "Draw",
            message: `${flagged === engineColor ? "The engine" : "You"} ran out of time, but the other side cannot checkmate`,
            icon: "thumbup",
        };
    }
    const playerWon = winner !== engineColor;
    return {
        result: winner === "white" ? "1-0" : "0-1",
        title: "Time",
        message: playerWon
            ? "The engine ran out of time: you won"
            : "You ran out of time",
        icon: playerWon ? "success" : "failure",
    };
}

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
