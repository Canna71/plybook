import { Chessboard } from "./chessboard";
import { Config } from "chessground/config";
import { Accessor, Component, createEffect, createSignal } from "solid-js";
import { Api } from "chessground/api";
import { GameModel, makeGame, PlyData, Path, MoveData } from "../models/pgn";
import  Moves  from "./Moves";


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

	const mainline = (): MoveData[] => {
		const mainline = game()?.mainline;
		if (!mainline) {
			return [];
		}
		// group the mainline moves by 2, and add the index starting from 1
		const groups = [];
		for (let i = 0; i < mainline.length; i += 2) {
			groups.push(mainline.slice(i, i + 2));
		}
		

		const ret: MoveData[] = groups.map((group, index) => 
			// [index + 1, group[0], group[1]]
		({
			number: index + 1,
			white: group[0],
			black: group[1]
		})
	);

		console.log("groups", ret);

		return ret;
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
		// const cg = api();
		// if (!cg) {
		// 	return;
		// }
		// const g = game();
		// if (!g) {
		// 	return;
		// }
		

		const nextNode = currentNode()?.children[0];
		setCurrentPath(nextNode?.data.path);
	}

	const onPrev = () => {
		// const cg = api();
		// if (!cg) {
		// 	return;
		// }
		// const g = game();
		// if (!g) {
		// 	return;
		// }

		const path = currentPath();
		if (!path) {
			return;
		}
		
		setCurrentPath(path.previous());
	}

	const onPlyClick = (plyData: PlyData) => {
		console.log("onPlyClick", plyData);
		setCurrentPath(plyData.path);
	}

	createEffect(() => {
		const cg = api()!;
		const node = currentNode();
		const data = currentData();
		if (!data) {
			return;
		}
		const config = {
			fen: data.fen
			// TODO: look at https://github.com/lichess-org/pgn-viewer/blob/master/src/pgnViewer.ts
		}
		cg.set(config);
	});

	return (
		<>
		<div class="pgnviewer-container">
			<div class="pgnviewer-content">
				<div class="pgnviewer-chessboard">
					<Chessboard config={config} setApi={setApi} />

				</div>
				<div>
					TODO: ???
				</div>
			</div>
			<div class="pgnviewer-sidebar">
				<div class="pgnviewer-mainline-wrapper">
					
						<Moves 
							mainline={mainline} 
							currentPath={currentPath}
							onPlyClick={onPlyClick}
						/>
					
				</div>


				<div class="pgn-viewer-buttonbar">
					<button onClick={onPrev} >|&lt;</button>
					<button onClick={onNext} >&gt;|</button>
				</div>

			</div>

		</div>
		<div class="pfn-viewer-bottom">
			
		</div>
		</>
	);
}

export default PgnViewer;


