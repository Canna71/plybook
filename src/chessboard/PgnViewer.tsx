import { Chessboard } from "./chessboard";
import { Config } from "chessground/config";
import { Accessor, Component, createEffect, createSignal, JSXElement, on, Show } from "solid-js";
import { GameModel, makeGame, Path, MoveData } from "../models/pgn";
import Moves from "./Moves";

import ButtonBar from "./Buttonbar";
import { Comments } from "./Comments";
import { lastMove, toShapes, useCurrentData } from "./utils";

// see: https://github.com/lichess-org/pgn-viewer


// PgnViewer options

export type PgnViewerOptions = {
	pgn: Accessor<string | undefined>;
}

// regex for square names
export const squareRegex = /([a-h][1-8])/g;

const PgnViewer: Component<PgnViewerOptions> = ({ pgn }) => {
	const [currentPath, setCurrentPath] = createSignal<Path | undefined>(undefined);
	const [game, setGame] = createSignal<GameModel | undefined>(undefined);
	const [squareHovered, setSquareHovered] = createSignal<string | undefined>(undefined);	
	const currentData = useCurrentData(game, currentPath)


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


	const config = () => {
		const data = currentData();
		if (!data) {
			return {};
		}
		
		const lastMoveKey = lastMove(data);

		let autoShapes = toShapes(squareHovered, data);
		
		const config: Config = {
			fen: data.fen,
			lastMove: lastMoveKey,
			highlight: {
				lastMove: true,
				check: true
			},
			drawable: {
				enabled: true,
				autoShapes
			},
			movable: {
				free: false,
			},
			draggable: {
				enabled: false,
			},
			selectable: {
				enabled: false,
			},
			// look at https://github.com/lichess-org/pgn-viewer/blob/master/src/pgnViewer.ts
		}
		return config;
	};
	// TODO: add a button to show/hide variations
	// TODO: add an icon to indicate comments (also for starting comments of variations)
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





