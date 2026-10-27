// The position shown in a game: at a path, as a memo, and as a FEN.

import { Accessor, createMemo } from "solid-js";
import { Chess } from "chessops";
import { makeFen } from "chessops/fen";
import { GameModel } from "../../models/GameModel";
import { Path } from "../../models/pgn";

/** The data at the path (the initial position for none); undefined without a game */
export function currentData(
    game: Accessor<GameModel | undefined>,
    path: Accessor<Path | undefined>,
) {
    const g = game();
    if (!g) return undefined;
    const p = path();
    return p ? g.dataAt(p) : g.initial;
}

/** The position at the path, or the start position */
export function getPosition(
    game: Accessor<GameModel | undefined>,
    path: Accessor<Path | undefined>,
) {
    return currentData(game, path)?.pos || Chess.default();
}

export function usePosition(
    game: Accessor<GameModel | undefined>,
    path: Accessor<Path | undefined>,
) {
    return createMemo(() => getPosition(game, path));
}

/**
 * The positions on the way to `path`, oldest first, without the one at `path`: the game's
 * history, which a FEN alone does not carry (repetitions).
 */
export function positionsBefore(game: GameModel, path: Path): string[] {
    const fens: string[] = [];
    let p = path;
    while (!p.empty()) {
        p = p.previous();
        const fen = game.dataAt(p)?.fen;
        if (fen) fens.unshift(fen);
    }
    return fens;
}

export function useFen(
    game: Accessor<GameModel | undefined>,
    path: Accessor<Path | undefined>,
) {
    const position = usePosition(game, path);
    return createMemo(() => makeFen(position().toSetup(), { epd: false }));
}
