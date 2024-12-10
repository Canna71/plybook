import { Chessboard } from "./chessboard";
import { Accessor, Component, createEffect, createSignal, JSXElement, on, Show } from "solid-js";
import { GameModel, makeGame, Path, MoveData } from "../models/pgn";
import Moves from "./Moves";

import ButtonBar from "./Buttonbar";
import { Comments } from "./Comments";
import { makeConfig, useCurrentData } from "./utils";

// see: https://github.com/lichess-org/pgn-viewer


// PgnViewer options

export type PgnViewerOptions = {
	pgn: Accessor<string | undefined>;
}



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


	const config = makeConfig(game, currentPath, squareHovered);

	// TODO: add a button to show/hide variations
	// TODO: display starting comments in the top section
	// TODO: display initial comment
	return (
		<>
			<div class="pgnviewer-container">
				<div class="pgnviewer-comments">
					<Comments
						currentData={currentData}
						squareHovered={setSquareHovered}
						commentType="starting"
					/>
				</div>
				<div class="pgnviewer-content">

					<div class="pgnviewer-chessboard">
						<Chessboard config={config} />

					</div>

				</div>
				<div class="pgnviewer-movecomments">
					<Comments
						currentData={currentData}
						squareHovered={setSquareHovered}
					/>

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





