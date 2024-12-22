import { Chess, Color, NormalMove, Position, Square, SquareSet, makeSquare } from "chessops";
import { GameModel, Initial, isPlyData, Path, PlyData } from "../models/pgn";
import { Accessor } from "solid-js";
import { Key } from "chessground/types";
import { Config } from "chessground/config";
import { INITIAL_FEN, parseFen } from "chessops/fen";


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
				lastMove: false,
				check: false
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

		let autoShapes = toShapes(squareHovered, data);

		const config: Config = {
			...baseConfig,
			fen: data.fen,
			lastMove: lastMoveKey,
			drawable: {
				enabled: baseConfig.drawable?.enabled,
				autoShapes
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

