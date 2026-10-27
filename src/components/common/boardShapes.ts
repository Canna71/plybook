// The board's base chessground config for a game: the position at a path, its last move,
// and the shapes (highlighted squares and moves, arrows and circles from the PGN).

import { Accessor } from "solid-js";
import { Color, makeSquare, NormalMove } from "chessops";
import { Config } from "chessground/config";
import { DrawBrushes, DrawShape } from "chessground/draw";
import { Key } from "chessground/types";
import { GameModel } from "../../models/GameModel";
import { Initial, isPlyData, Path, PlyData } from "../../models/pgn";
import { currentData } from "../game/gamePosition";

/** The from and to squares of the move that led to `data`, for chessground */
export function lastMove(data: Initial | PlyData | undefined) {
    const lm = isPlyData(data) ? (data.move as NormalMove) : undefined;
    return lm && [makeSquare(lm.from), makeSquare(lm.to)];
}

export function toShapes(
    highlightedSquares: Accessor<string[]>,
    highlightedMoves: Accessor<string[]>,
    data: Initial | PlyData,
) {
    let autoShapes: DrawShape[] = highlightedSquares().map((hs) => ({
        orig: hs as Key,
        brush: "green",
    }));
    // moves resolved in their position ("g5-f7", from explanations) are arrows; a bare SAN
    // from a PGN comment ("e4") cannot be placed without its position, so it is not drawn
    autoShapes = autoShapes.concat(
        highlightedMoves()
            .filter((hm) => /^[a-h][1-8]-[a-h][1-8]$/.test(hm))
            .map((hm) => {
                const [from, to] = hm.split("-");
                return { orig: from as Key, dest: to as Key, brush: "green" };
            }),
    );
    if (data?.shapes) {
        autoShapes = autoShapes.concat(
            data.shapes.map((s) => {
                const orig = makeSquare(s.from);
                // a1 is square 0: test for undefined, not truthiness
                const dest = s.to !== undefined ? makeSquare(s.to) : undefined;
                return { orig, dest, brush: s.color };
            }),
        );
    }
    return autoShapes;
}

export function makeArrowShape(orig: Key, dest: Key, brush: string): DrawShape {
    return { orig, dest, brush };
}

export const drawBrushes: DrawBrushes = {
    yellow: { key: "yellow", color: "yellow", opacity: 1, lineWidth: 10 },
    green: { key: "green", color: "green", opacity: 1, lineWidth: 10 },
    red: { key: "red", color: "red", opacity: 1, lineWidth: 10 },
    blue: { key: "blue", color: "blue", opacity: 1, lineWidth: 10 },
    purple: { key: "purple", color: "purple", opacity: 1, lineWidth: 10 },
    orange: { key: "orange", color: "orange", opacity: 1, lineWidth: 10 },
    pink: { key: "pink", color: "pink", opacity: 1, lineWidth: 10 },
    brown: { key: "brown", color: "brown", opacity: 1, lineWidth: 10 },
    black: { key: "black", color: "black", opacity: 1, lineWidth: 10 },
    gray: { key: "gray", color: "gray", opacity: 1, lineWidth: 10 },
};

export function makeConfig(
    game: Accessor<GameModel | undefined>,
    currentPath: Accessor<Path | undefined>,
    highlightedSquares: Accessor<string[]>,
    highlightedMoves: Accessor<string[]>,
    orientation: Accessor<Color>,
): () => Config {
    return () => {
        const baseConfig: Config = {
            fen: "",
            orientation: orientation(),
            lastMove: undefined,
            highlight: {
                lastMove: true,
                check: true,
            },
            drawable: {
                enabled: true,
                autoShapes: [],
                brushes: drawBrushes,
            },
            movable: {
                free: false,
            },
            draggable: {
                enabled: false,
            },
            selectable: {
                enabled: true,
            },
        };

        const data = currentData(game, currentPath);
        if (!data) return baseConfig;

        return {
            ...baseConfig,
            fen: data.fen,
            lastMove: lastMove(data),
            drawable: {
                ...baseConfig.drawable,
                shapes: toShapes(highlightedSquares, highlightedMoves, data),
            },
        };
    };
}
