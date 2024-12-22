import { Chessboard } from "./chessboard";
import { Accessor, Component, createEffect, createSignal } from "solid-js";
import { GameModel, makeGame, Path } from "../models/pgn";
import Moves from "./Moves";

import ButtonBar from "./Buttonbar";
import { makeConfig } from "./utils";

// see: https://github.com/lichess-org/pgn-viewer


// PgnViewer options

export type PgnViewerOptions = {
	pgn: Accessor<string | undefined>;
}



const PgnViewer: Component<PgnViewerOptions> = ({ pgn }) => {
	const [currentPath, setCurrentPath] = createSignal<Path | undefined>(undefined);
	const [game, setGame] = createSignal<GameModel | undefined>(undefined);
	const [squareHovered, setSquareHovered] = createSignal<string | undefined>(undefined);
	// const currentData = useCurrentData(game, currentPath)


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


	const config = makeConfig(game, currentPath, squareHovered);

	// TODO add a button to show/hide variations
	// TODO style buttons
	return (
		<>
			<div class="pgnviewer-container">
				
				<div class="pgnviewer-content">

					<div class="pgnviewer-chessboard">
						<Chessboard config={config} />

					</div>

				</div>
				
				<div class="pgnviewer-sidebar">
					<div class="pgnviewer-moves-wrapper">

						<Moves
							game={game}
							currentPath={currentPath}
							setCurrentPath={setCurrentPath}
							squareHovered={setSquareHovered}
							editable={()=>false}
							
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





