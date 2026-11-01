// What a parent may do to the game in a game manager (GameManagerApi): add a comment, or
// moves found in a text (the PDF reader's notes).

import { Accessor, batch, createEffect, on, Setter } from "solid-js";
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
    /** Shows the main line's move `ply` (0: the start), once the game has loaded */
    showPly: (ply: number) => void;
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

    // a move to show asked for before the game loaded
    let wanted: number | undefined;
    createEffect(
        on(game, (g) => {
            if (!g || wanted === undefined) return;
            setPath(g.pathAtMainlinePly(wanted));
            wanted = undefined;
        }),
    );

    return {
        showPly: (ply) => {
            const g = game();
            if (g) setPath(g.pathAtMainlinePly(ply));
            else wanted = ply;
        },
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
