// What a parent may do to the game in a game manager (GameManagerApi): add a comment, or
// moves found in a text (the PDF reader's notes).

import { Accessor, batch, Setter } from "solid-js";
import { makeSanVariation } from "chessops/san";
import { GameModel } from "../../models/GameModel";
import { movesFromText } from "../../models/booktext";
import { Path } from "../../models/pgn";

export type GameManagerApi = {
    /** Adds a comment after the move shown (or before the first move) */
    addComment: (text: string) => void;
    /**
     * Plays the moves found in `text` from the move shown, or else from the start, as a new
     * line where they differ from the game; how many moves were added.
     */
    addMovesFromText: (text: string) => number;
    /** The moves `addMovesFromText` would add, numbered ("4.c3 Nf6"); reactive */
    previewMovesFromText: (text: string) => string | undefined;
};

export function gameApi(
    game: Accessor<GameModel | undefined>,
    setGame: Setter<GameModel | undefined>,
    path: Accessor<Path | undefined>,
    setPath: Setter<Path | undefined>,
): GameManagerApi {
    /** Moves in `text` that fit the move shown, or else the start of the game. */
    const textMoves = (text: string) => {
        const g = game();
        if (!g) return undefined;
        for (const from of [path() ?? Path.root, Path.root]) {
            const position = g.getPosition(from);
            const { moves } = movesFromText(text, position);
            if (moves.length) return { from, position, moves };
        }
        return undefined;
    };

    return {
        addComment: (text) => {
            const p = path();
            const g = game();
            if (g && p) setGame(g.insertComment(p, text, false, true));
        },
        addMovesFromText: (text) => {
            const g = game();
            const found = textMoves(text);
            if (!g || !found) return 0;
            const [next, end] = g.applyMoves(found.from, found.moves);
            batch(() => {
                setPath(end);
                setGame(next);
            });
            return found.moves.length;
        },
        previewMovesFromText: (text) => {
            const found = textMoves(text);
            return found && makeSanVariation(found.position, found.moves);
        },
    };
}
