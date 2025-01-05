import {
    Chess,
    Color,
    NormalMove,
    Position,
    Setup,
    Square,
    SquareSet,
    makeSquare,
    squareFile,
    squareRank,
} from "chessops";
import { Initial, isPlyData, makeGame, Path, PlyData } from "../../models/pgn";
import { GameModel } from "../../models/GameModel";
import { Accessor, batch, useContext } from "solid-js";
import { Key } from "chessground/types";
import { Config } from "chessground/config";
import { parseSquare, squareFromCoords } from "chessops/util";
import Split from "split-grid";
import { DOMElement } from "solid-js/jsx-runtime";
import { GameContextType, TooltipContext } from "../game/GameContext";
import { makeFen, parseFen } from "chessops/fen";
import { ViewMode } from "../game/PgnEditBar";

export function lastMove(data: Initial | PlyData | undefined) {
    const lm = isPlyData(data) ? (data.move as NormalMove) : undefined;
    const lastMoveKey = lm && [makeSquare(lm.from), makeSquare(lm.to)];
    return lastMoveKey;
}

export function useCurrentData(
    game: Accessor<GameModel | undefined>,
    currentPath: Accessor<Path | undefined>,
) {
    return () => {
        const g = game();
        if (!g) {
            return;
        }
        const path = currentPath();
        if (!path) {
            return g.initial;
        }

        const data = g.dataAt(path);
        return data;
    };
}
export function toShapes(
    squareHovered: Accessor<string | undefined>,
    data: Initial | PlyData,
) {
    let autoShapes = squareHovered()
        ? [{ orig: squareHovered() as Key, brush: "green" }]
        : [];
    if (data?.shapes) {
        autoShapes = autoShapes.concat(
            data.shapes.map((s) => {
                const orig = makeSquare(s.from);
                const dest = s.to && makeSquare(s.to);
                return { orig, dest, brush: s.color };
            }),
        );
    }
    return autoShapes;
}
export function makeConfig(
    game: Accessor<GameModel | undefined>,
    currentPath: Accessor<Path | undefined>,
    squareHovered: Accessor<string | undefined>,
): () => Config {
    return () => {
        const baseConfig: Config = {
            fen: "",
            lastMove: undefined,
            // viewOnly: true,
            highlight: {
                lastMove: true,
                check: true,
            },
            drawable: {
                enabled: true,
                autoShapes: [],
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

        const data = useCurrentData(game, currentPath)();
        if (!data) {
            return baseConfig;
        }

        const lastMoveKey = lastMove(data);
        let shapes = toShapes(squareHovered, data);

        const config: Config = {
            ...baseConfig,
            fen: data.fen,
            lastMove: lastMoveKey,
            drawable: {
                enabled: baseConfig.drawable?.enabled,
                shapes,
            },
        };
        return config;
    };
}

function* toSquares(squares: SquareSet) {
    for (let square of squares) {
        yield makeSquare(square) as Key;
    }
}

export function toDests(pos: Position): Map<Key, Key[]> {
    const dests = new Map();
    const allDests = pos.allDests();

    for (const [from, tos] of allDests) {
        const key = makeSquare(from) as Key;
        const keys = toSquares(tos);
        dests.set(key, Array.from(keys));
    }
    return dests;
}

export function toColor(pos: Position): Color {
    return pos.turn === "black" ? "white" : "black";
}

export function toOrientation(pos: Position): Color {
    return pos.turn;
}

export function getPosition(
    game: Accessor<GameModel | undefined>,
    currentPath: Accessor<Path | undefined>,
) {
    const data = useCurrentData(game, currentPath)();
    const pos = getPositionFromData(data) || Chess.default();
    return pos;
}
export function getPositionFromData(data: Initial | PlyData | undefined) {
    const pos = data?.pos;
    return pos;
}

export function getEnPassantSquares(setup: Setup, whitesTurn: boolean) {
    const pawns = setup.board.pawn;
    // returns squares where a pawn can eat en passant
    const squares = Array.from(pawns)
        .map((pawn: Square) => {
            // const square = pawn.key;
            const [x, y] = [squareFile(pawn), squareRank(pawn)];
            if (whitesTurn) {
                if (y === 4) {
                    return makeSquare(squareFromCoords(x, y + 1)!);
                }
            } else {
                if (y === 3) {
                    return makeSquare(squareFromCoords(x, y - 1)!);
                }
            }
        })
        .filter((square) => square !== undefined) as string[];
    return squares;
}
export function useSplitter(saveLayout?: (layout: string) => void) {
    // let dividerEl: HTMLDivElement | null = null;

    return (divider: HTMLDivElement) => {
        divider = divider;
        Split({
            columnGutters: [
                {
                    track: 1,
                    element: divider!,
                },
            ],
            writeStyle: (grid, prop, value) => {
                (grid.style as any)[prop] = value;
                saveLayout?.(value);
            },
        });
    };
}
export function makeMove(orig: string, dest: string): NormalMove {
    const sq1 = parseSquare(orig);
    const sq2 = parseSquare(dest);
    const move = {
        from: sq1!,
        to: sq2!,
        promotion: undefined,
    };
    return move;
}

export function isPromotion(move: NormalMove, position: Chess) {
    const piece = position.board.get(move.from);
    if (!piece) return false;
    if (piece.role === "pawn") {
        if (position.turn === "white") {
            return squareRank(move.to) === 7;
        } else {
            return squareRank(move.to) === 0;
        }
    }
}

export function useFenTooltip(
    tooltipEnabled: boolean,
    plyData: PlyData | undefined,
) {
    const { showTooltip } = useContext(TooltipContext)!;
    const innerShowTooltip = (
        e:
            | (MouseEvent & {
                  currentTarget: HTMLElement;
                  target: DOMElement;
              })
            | undefined,
    ) => {
        if (!tooltipEnabled) return;
        if (e) {
            !!plyData && showTooltip(e.currentTarget, plyData);
        } else {
            showTooltip(undefined, undefined);
        }
    };
    return innerShowTooltip;
}

export const updateGameFromPgnString = (pgnString: string, context: GameContextType) => {
    console.log("Updating current game from pgn string", pgnString);
    const gameModel = makeGame(pgnString);
    initFromGameModel(context, gameModel);
};

export function initFromGameModel(context: GameContextType, gameModel: GameModel) {
    batch(() => {
        context.gameSignal[1](gameModel);
        if (gameModel.headers.get("FEN")) {
            const setup = parseFen(gameModel.headers.get("FEN") || "");
            if (setup.isOk) {
                context.startingPositionSignal[1](makeFen(setup.value));
            }
        }
        // context.currentPathSignal[1](gameModel.pathAtMainlinePly(0));
        context.viewModeSignal[1](ViewMode.MOVES);
        context.descriptionSignal[1](gameModel.headers.get("Description") || "");
    });
}

