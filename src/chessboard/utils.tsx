import { NormalMove, makeSquare } from "chessops";
import { GameModel, Initial, isPlyData, Path, PlyData } from "../models/pgn";
import { Accessor } from "solid-js";
import { Key } from "chessground/types";


export function lastMove(data: import("/Users/gcannata/Projects/rechess/src/models/pgn").Initial | import("/Users/gcannata/Projects/rechess/src/models/pgn").PlyData) {
	const lm = isPlyData(data) ? data.move as NormalMove : undefined;
	const lastMoveKey = lm && [makeSquare(lm.from), makeSquare(lm.to)];
	return lastMoveKey;
}export function useCurrentData(game: Accessor<GameModel | undefined>, currentPath: Accessor<Path | undefined>) {
	return () => {
		const g = game();
		if (!g) {
			return;
		}
		const path = currentPath();
		if (!path) {
			return g.initial;
		}

		return g.dataAt(path);
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

