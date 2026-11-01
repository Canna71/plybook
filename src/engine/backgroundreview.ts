// Reviewing a game without the board (P1.4): every position of the main line searched in turn,
// the evaluations written into the game as a review on the board would, and the mistakes
// marked ?!, ? and ??. The search is a parameter: the explainer engine in the app, a script in
// tests.

import { Color } from "chessops";
import { PositionHistory, Score } from "./engineinterfaces";
import { gameHistory, historyFor } from "../models/gamehistory";
import { GameModel } from "../models/GameModel";
import { EvaluationExt, makeGame } from "../models/pgn";
import {
    annotateMistakes,
    lineMoves,
    mainline,
    reviewLine,
} from "../models/review";
import { BookMove, bookPlies } from "../models/books";

/**
 * One position's search: the score from White's point of view, and the best move. `history`:
 * the game up to the position, so the engine counts repetitions.
 */
export type PositionSearch = (
    fen: string,
    history?: PositionHistory,
) => Promise<{ score?: Score; best?: string; depth?: number } | undefined>;

export type ReviewedGame = {
    game: GameModel;
    /** Mistakes and blunders, by colour */
    mistakes: Record<Color, number>;
};

/**
 * Reviews the first game of `pgn`. Positions the search cannot judge are left out. `books`:
 * the user's opening books' moves in a position; the game's book moves are not graded (P1.5).
 */
export async function reviewGame(
    pgn: string,
    search: PositionSearch,
    books?: (fen: string) => Promise<BookMove[]>,
): Promise<ReviewedGame> {
    let game = makeGame(pgn);
    const book = books ? await bookPlies(lineMoves(mainline(game)), books) : 0;
    for (const node of mainline(game)) {
        const fen = node.fen ?? game.initial.fen;
        if (!fen) continue;
        let evaluation: EvaluationExt | undefined;
        if (node.pos.isCheckmate()) {
            evaluation = { depth: 0, mate: 0 };
        } else if (node.pos.isEnd()) {
            evaluation = { depth: 0, pawns: 0 };
        } else {
            const found = await search(
                fen,
                historyFor(gameHistory(game, node.path), fen),
            );
            const score = found?.score;
            if (score) {
                evaluation =
                    score.type === "cp"
                        ? {
                              depth: found.depth,
                              pawns: score.value / 100,
                              ext: found.best,
                          }
                        : {
                              depth: found.depth,
                              mate: score.value,
                              ext: found.best,
                          };
            }
        }
        if (evaluation) game = game.updateEvaluation(node.path, evaluation);
    }
    game = annotateMistakes(game, book);
    const mistakes: Record<Color, number> = { white: 0, black: 0 };
    for (const move of reviewLine(mainline(game), book)) {
        if (move.class === "mistake" || move.class === "blunder")
            mistakes[move.color]++;
    }
    return { game, mistakes };
}
