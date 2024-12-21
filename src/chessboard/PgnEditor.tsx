import { Chessboard } from "./chessboard";
import { Accessor, Component, createEffect, createSignal } from "solid-js";
import { GameModel, makeGame, Path } from "../models/pgn";
import Moves from "./Moves";

import ButtonBar from "./Buttonbar";
import { makeConfig } from "./utils";
import { Key, Piece } from "chessground/types";


export type PgnEditorOptions = {
	pgn: Accessor<string | undefined>;
}



const PgnEditor: Component<PgnEditorOptions> = ({ pgn }) => {
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

    const onMove = (orig: Key, dest: Key, capturedPiece?: Piece)  => {
        console.log("onMove", orig, dest, capturedPiece);
        // game()?.game 
    }

    const onSelect = (key: Key) => {
        console.log("onSelect", key);
    }

	const config = () => {
        const baseConfig = makeConfig(game, currentPath, squareHovered);
        return {
            ...baseConfig,
            // turnColor: "white",

            viewOnly: false,
            moveable: {
                free: false,
                color: "white"
            },
            events: {
                move: onMove,
                
                select: onSelect
            }
        }
    }

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
							showComments={()=>false}
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

export default PgnEditor;





