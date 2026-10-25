// What a board export draws (O.5): where each square goes on the image, and the positions an
// animated GIF shows. No DOM here, so it can be tested.

import { Color, Square } from "chessops";
import { GameModel } from "./GameModel";
import { isMoveNode, Path } from "./pgn";

/** A position to draw, with the move that led to it (highlighted). */
export type BoardFrame = {
    fen: string;
    lastMove?: { from: Square; to: Square };
};

/** The top-left corner of a square on a board `size` pixels wide, seen from `orientation`. */
export function squareOrigin(
    square: Square,
    orientation: Color,
    size: number,
): { x: number; y: number } {
    const file = square % 8;
    const rank = Math.floor(square / 8);
    const s = size / 8;
    return orientation === "white"
        ? { x: file * s, y: (7 - rank) * s }
        : { x: (7 - file) * s, y: rank * s };
}

/** The position at `path` (shown as a single image). */
export function frameAt(game: GameModel, path: Path): BoardFrame {
    const node = game.nodeAt(path);
    const fen = game.dataAt(path)?.fen ?? game.initial.fen;
    const move = node && isMoveNode(node) ? node.data.move : undefined;
    return {
        fen,
        lastMove:
            move && "from" in move
                ? { from: move.from, to: move.to }
                : undefined,
    };
}

/**
 * The positions of the line shown, for an animation: from the start of the game through the
 * move at `path` and on along its main continuation to the end.
 */
export function lineFrames(game: GameModel, path: Path): BoardFrame[] {
    const frames: BoardFrame[] = [frameAt(game, Path.root)];
    let current = Path.root;
    // the moves up to `path`
    for (let i = 2; i <= path.path.length; i += 2) {
        current = new Path(path.path.slice(0, i));
        frames.push(frameAt(game, current));
    }
    // then the first continuation, to the end
    let node = game.nodeAt(current);
    while (node?.children[0]) {
        node = node.children[0];
        if (isMoveNode(node)) frames.push(frameAt(game, node.data.path));
    }
    return frames;
}
