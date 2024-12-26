import { Chess, Color, NormalMove, Position, Setup, Square, SquareSet, makeSquare, squareFile, squareRank } from "chessops";
import { Initial, isPlyData, Path, PlyData } from "../../models/pgn";
import { GameModel } from "../../models/GameModel";
import { Accessor } from "solid-js";
import { Key } from "chessground/types";
import { Config } from "chessground/config";
import { INITIAL_FEN, parseFen } from "chessops/fen";
import { squareFromCoords } from "chessops/util";
import Split from "split-grid";



export function lastMove(data: import("/Users/gcannata/Projects/rechess/src/models/pgn").Initial | import("/Users/gcannata/Projects/rechess/src/models/pgn").PlyData) {
	const lm = isPlyData(data) ? data.move as NormalMove : undefined;
	const lastMoveKey = lm && [makeSquare(lm.from), makeSquare(lm.to)];
	return lastMoveKey;
}

export function useCurrentData(game: Accessor<GameModel | undefined>, currentPath: Accessor<Path | undefined>) {
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
export function toShapes(squareHovered: Accessor<string | undefined>, data: Initial | PlyData) {
	let autoShapes = squareHovered() ? [{ orig: squareHovered() as Key, brush: "green" }] : [];
	if (data?.shapes) {
		autoShapes = autoShapes.concat(data.shapes.map(s => {
			const orig = makeSquare(s.from);
			const dest = s.to && makeSquare(s.to);
			return { orig, dest, brush: s.color };
		}));
	}
	return autoShapes;
}
export function makeConfig(game: Accessor<GameModel | undefined>, currentPath: Accessor<Path | undefined>, squareHovered: Accessor<string | undefined>): () => Config {
	return () => {

		const baseConfig: Config = {
			fen: "",
			lastMove: undefined,
			// viewOnly: true,
			highlight: {
				lastMove: true,
				check: true
			},
			drawable: {
				enabled: true,
				autoShapes: []
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
				shapes
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

export function getPosition(game: Accessor<GameModel | undefined>, currentPath: Accessor<Path | undefined>) {
	const data = useCurrentData(game, currentPath)();
	const fen = data?.fen || INITIAL_FEN;
	const setup = parseFen(fen).unwrap();
	const pos = Chess.fromSetup(setup).unwrap();
	return pos;
}
export function getEnPassantSquares(setup: Setup, whitesTurn: boolean) {
    const pawns = setup.board.pawn;
    // returns squares where a pawn can eat en passant
    const squares = Array.from(pawns).map((pawn: Square) => {
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
    }).filter(square => square !== undefined) as string[];
    return squares;
}
export function useSplitter(saveLayout?: (layout: string) => void) {
	let divider: HTMLDivElement | null = null;

	return (divider: HTMLDivElement) => {
		divider = divider;
		Split({
			columnGutters: [{
				track: 1,
				element: divider!
			}],
			writeStyle: (grid, prop, value) => {
				(grid.style as any)[prop] = value;
				saveLayout?.(value);
			}
		});
	};
}

