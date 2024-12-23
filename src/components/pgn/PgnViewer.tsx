import { Chessboard } from "../common/chessboard";
import { Accessor, Component, createEffect, createSignal } from "solid-js";
import { makeGame, Path } from "../../models/pgn";
import { GameModel } from "../../models/GameModel";
import Moves from "../pgn/Moves";


import { makeConfig } from "../common/utils";
import ButtonBar from "./Buttonbar";

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
							setGame={setGame}
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





