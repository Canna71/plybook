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
import { Accessor, batch, createMemo, JSXElement, useContext } from "solid-js";
import { Key } from "chessground/types";
import { Config } from "chessground/config";
import { parseSquare, squareFromCoords } from "chessops/util";
import Split from "split-grid";
import { DOMElement } from "solid-js/jsx-runtime";
import { GameContextType, TooltipContext } from "../game/GameContext";
import { makeFen, parseFen } from "chessops/fen";
import { ViewMode } from "../game/PgnEditBar";
import {
    IconChessKingFilled,
    IconChessQueenFilled,
    IconChessRookFilled,
    IconChessBishopFilled,
    IconChessKnightFilled,
    IconChessKing,
    IconChessQueen,
    IconChessRook,
    IconChessBishop,
    IconChessKnight,
    IconChessFilled,
    IconChess,
} from "@tabler/icons-solidjs";
import { debounce } from "es-toolkit";
import { DrawBrushes, DrawShape } from "chessground/draw";
import { makeSan } from "chessops/san";
import { getTheme } from "../../theming/thememanager";

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
    highlightedSquares: Accessor<string[]>,
    _highlightedMoves: Accessor<string[]>,
    data: Initial | PlyData,
) {
    let autoShapes =
        highlightedSquares().length > 0
            ? highlightedSquares().map((hs) => ({
                  orig: hs as Key,
                  brush: "green",
              }))
            : [];
    // TODO: how can we display moves regardless of the position?
    // autoShapes = autoShapes.concat(
    //     highlightedMoves().map((hm) => {
    //         const move =
    //         const [from, to] = hm.split("-");
    //         return { orig: from as Key, dest: to as Key, brush: "green" };
    //     }),
    // );
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

export function makeArrowShape(orig: Key, dest: Key, brush: string): DrawShape {
    return { orig, dest, brush };
}

const drawBrushes: DrawBrushes = {
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
            // viewOnly: true,
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

        const data = useCurrentData(game, currentPath)();
        if (!data) {
            return baseConfig;
        }

        const lastMoveKey = lastMove(data);
        let shapes = toShapes(highlightedSquares, highlightedMoves, data);

        const config: Config = {
            ...baseConfig,
            fen: data.fen,
            lastMove: lastMoveKey,
            drawable: {
                ...baseConfig.drawable,
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

    const doSave = debounce((value: string) => {
        saveLayout?.(value);
    }, 300);

    return (divider: HTMLDivElement) => {
        // divider = divider;
        // if(gridTemplateColumns){
        //     divider.parentElement!.style.gridTemplateColumns = gridTemplateColumns ;
        // }
        Split({
            columnGutters: [
                {
                    track: 1,
                    element: divider!,
                },
            ],
            writeStyle: (grid, prop, value) => {
                (grid.style as any)[prop] = value;
                doSave(value);
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

export const updateGameFromPgnString = (
    pgnString: string,
    context: GameContextType,
) => {
    const gameModel = makeGame(pgnString);
    initFromGameModel(context, gameModel);
};

export function initFromGameModel(
    context: GameContextType,
    gameModel: GameModel,
) {
    const {
        gameSignal: [, setGame],
        viewModeSignal: [, setViewMode],
        descriptionSignal: [, setDescription],
        startingPositionSignal: [, setStartingPosition],
        hintMoveSignal: [, setHintMove],
    } = context;

    batch(() => {
        setGame(gameModel);
        setHintMove(undefined);
        if (gameModel.headers.get("FEN")) {
            const setup = parseFen(gameModel.headers.get("FEN") || "");
            if (setup.isOk) {
                setStartingPosition(makeFen(setup.value));
            }
        }
        // context.currentPathSignal[1](gameModel.pathAtMainlinePly(0));
        setViewMode(ViewMode.MOVES);
        setDescription(gameModel.headers.get("Description") || "");
    });
}

function sanitizeText(text: string) {
    // Add any text sanitization rules you need
    return text.trim();
}

// Helper function to check if selection is inside the editable div
function isSelectionInEditableDiv(div: HTMLDivElement, selection: Selection) {
    if (!selection.rangeCount) return false;
    const range = selection.getRangeAt(0);
    return div.contains(range.commonAncestorContainer);
}

export async function safePaste(
    editableDiv: HTMLDivElement,
    e: ClipboardEvent,
) {
    e.preventDefault();
    // Get plain text from clipboard
    const selection = window.getSelection();
    if (!selection) return;
    if (!isSelectionInEditableDiv(editableDiv, selection)) return;
    try {
        let text = await navigator.clipboard.readText();
        text = sanitizeText(text);

        const range = selection.getRangeAt(0);
        range.deleteContents();

        const textNode = document.createTextNode(text);
        range.insertNode(textNode);

        // Update selection
        selection.removeAllRanges();
        const newRange = document.createRange();
        newRange.setStartAfter(textNode);
        newRange.setEndAfter(textNode);
        selection.addRange(newRange);

        editableDiv.normalize();
    } catch (err) {
        throw err;
    }
}

const figurineMap: Record<string, () => JSXElement> = {
    K: () => <IconChessKingFilled />,
    Q: () => <IconChessQueenFilled />,
    R: () => <IconChessRookFilled />,
    B: () => <IconChessBishopFilled />,
    N: () => <IconChessKnightFilled />,
    P: () => <IconChessFilled />,
    k: () => <IconChessKing />,
    q: () => <IconChessQueen />,
    r: () => <IconChessRook />,
    b: () => <IconChessBishop />,
    n: () => <IconChessKnight />,
    p: () => <IconChess />,
};

export function getFigurine(piece: string) {
    if (getTheme() === "light") {
        // invert the casing of piece
        if (piece === piece.toUpperCase()) {
            piece = piece.toLowerCase();
        } else {
            piece = piece.toUpperCase();
        }
    }
    return figurineMap[piece];
}

export function selectAll(el: HTMLElement) {
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(el);
    sel?.removeAllRanges();
    sel?.addRange(range);
}

export function otherColor(color: Color | undefined) {
    return color === "white" ? "black" : "white";
}

export function usePosition(
    game: Accessor<GameModel | undefined>,
    currentPath: Accessor<Path | undefined>,
) {
    const position = createMemo(() => getPosition(game, currentPath));
    return position;
}

export function useFen(
    game: Accessor<GameModel | undefined>,
    currentPath: Accessor<Path | undefined>,
) {
    const position = usePosition(game, currentPath);
    const fen = createMemo(() =>
        makeFen(position().toSetup(), {
            epd: false,
        }),
    );
    return fen;
}

export function moveEquals(pos: Position, a: NormalMove, b: NormalMove) {
    // return a.from === b.from && a.to === b.to && a.promotion === b.promotion;
    const asan = makeSan(pos, a);
    const bsan = makeSan(pos, b);
    return asan === bsan;
}

export const formatDate = (date?: string) => {
    return (date && new Date(date).toLocaleDateString()) || "";
};

// round a number to a given number of decimal places
export function round(value: number | undefined, decimals: number) {
    if (typeof value !== "number") return value;
    return Number(Math.round(Number(value + "e" + decimals)) + "e-" + decimals);
}
