import { Chessboard } from "./Chessboard";
import { Config } from "chessground/config";
import { Accessor, Component, createEffect, createSignal } from "solid-js";
import { Api } from "chessground/api";
import { GameModel, makeGame, Path } from "../models/pgn";


// see: https://github.com/lichess-org/pgn-viewer


// PgnViwer options

export type PgnViewerOptions = {
	pgn: Accessor<string | undefined>;

}


const PgnViewer: Component<PgnViewerOptions> = ({ pgn }) => {
	const [currentPath, setCurrentPath] = createSignal<Path | undefined>(undefined);
	const [game, setGame] = createSignal<GameModel | undefined>(undefined);

	const [api, setApi] = createSignal<Api | undefined>(undefined);

	const config: Config = {

	}

	const currentNode = () => {
		const g = game();
		if (!g) {
			return;
		}
		const path = currentPath();
		if (!path) {
			return;
		}
		return g.nodeAt(path);
	}

	// @ts-ignore
	const currentData = () => {
		const g = game();
		if (!g) {
			return;
		}
		const path = currentPath();
		if (!path) {
			return;
		}
		return g.dataAt(path);
	}

	createEffect(() => {
		const cg = api();
		const pgnString = pgn();
		if (!cg || !pgnString) {
			return;
		}

		const gameModel = makeGame(pgnString);
		setGame(gameModel);
		setCurrentPath(gameModel.pathAtMainlinePly(0));
		// setCurrentPath(gameModel
		cg.set({
			fen: gameModel.initial.fen
		});
	});

	const onNext = () => {
		const cg = api();
		if (!cg) {
			return;
		}
		const g = game();
		if (!g) {
			return;
		}
		
		const nextNode = currentNode()?.children[0];
		// TODO: use reactivity
		setCurrentPath(nextNode?.data.path);
		
		const config = {
			fen: nextNode?.data.fen
			// TODO: look at https://github.com/lichess-org/pgn-viewer/blob/master/src/pgnViewer.ts
		}
		cg.set(config);
	}

	return (
		<div>
			<Chessboard config={config} setApi={setApi} />
			<div>
				<button onClick={onNext} >&gt;|</button>
			</div>
		</div>
	);
}

export default PgnViewer;