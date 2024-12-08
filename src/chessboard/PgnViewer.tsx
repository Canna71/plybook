import { Chessboard } from "./chessboard";
import { Config } from "chessground/config";
import { Accessor, Component, createEffect, createSignal, JSXElement, on, Show } from "solid-js";
import { GameModel, makeGame, Path, MoveData, isPlyData } from "../models/pgn";
import Moves from "./Moves";

import { makeSquare, NormalMove } from "chessops";
import { Key } from "chessground/types";
import ButtonBar from "./Buttonbar";
import { Comments } from "./Comments";

// see: https://github.com/lichess-org/pgn-viewer


// PgnViwer options

export type PgnViewerOptions = {
	pgn: Accessor<string | undefined>;

}

// regex for square names
export const squareRegex = /([a-h][1-8])/g;

const PgnViewer: Component<PgnViewerOptions> = ({ pgn }) => {
	const [currentPath, setCurrentPath] = createSignal<Path | undefined>(undefined);
	const [game, setGame] = createSignal<GameModel | undefined>(undefined);
	const [config, setConfig] = createSignal<Config>({});
	const [squareHovered, setSquareHovered] = createSignal<string | undefined>(undefined);




	// @ts-ignore
	const currentData = () => {
		const g = game();
		if (!g) {
			return;
		}
		const path = currentPath();
		if (!path) {
			return g.initial;
		}

		return g.dataAt(path);
	}


	const lastMove = () => {
		const data = currentData();
		if (!isPlyData(data)) {
			return;
		}
		return data.move;

	}

	// After loading the pgn string, create the game model
	createEffect(() => {
		// const cg = api();
		const pgnString = pgn();
		if (!pgnString) {
			return;
		}

		const gameModel = makeGame(pgnString);
		setGame(gameModel);
		setCurrentPath(gameModel.pathAtMainlinePly(0));
		
	});


	createEffect(() => {
		// const cg = api()!;
		const data = currentData();
		if (!data) {
			return;
		}
		const lm = lastMove() as NormalMove | undefined;
		let autoShapes = squareHovered() ? [{ orig: squareHovered() as Key, brush: "green" }] : [];
		if	(data?.shapes) {
			autoShapes = autoShapes.concat(data.shapes.map(s => {
				const orig = makeSquare(s.from);
				const dest = s.to && makeSquare(s.to);
				return { orig, dest, brush: s.color };
			}));
		}
		

		const lastMoveKey = lm && [makeSquare(lm.from), makeSquare(lm.to)];
		// var key = cg.
		const config: Config = {
			fen: data.fen,
			lastMove: lastMoveKey,
			highlight: {
				lastMove: true,
				check: true
			},
			drawable: {
				enabled: false,
				autoShapes
			}
			// look at https://github.com/lichess-org/pgn-viewer/blob/master/src/pgnViewer.ts
		}
		setConfig(config);
	});
	// TODO: add a button to show/hide variations
	// TODO: add an icon to indicate comments (also for starting comments of variations)
	// TODO: scroll to the current move
	// TODO: display starting comments in the top section
	// TODO: check regex for square names that are before hyphens
	// TODO: display initial comment
	return (
		<>
			<div class="pgnviewer-container">
				<div class="pgnviewer-content">
					<div class="pgnviewer-chessboard">
						<Chessboard config={config}  />

					</div>
					<div class="pgnviewer-comments">
						<Comments 
							currentData={currentData}
							squareHovered={setSquareHovered}
						/>
						
					</div>
				</div>
				<div class="pgnviewer-sidebar">
					<div class="pgnviewer-moves-wrapper">

						<Moves
							game={game}
							currentPath={currentPath}
							setCurrentPath={setCurrentPath}
						/>

					</div>
					<ButtonBar
						game={game}
						currentPath={currentPath}
						setCurrentPath={setCurrentPath}
					/>
				</div>

			</div>
			<div class="pfn-viewer-bottom">

			</div>
		</>
	);
}

export default PgnViewer;


