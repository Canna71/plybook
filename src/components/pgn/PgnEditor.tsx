import { Chessboard } from "../common/chessboard";
import { Accessor, Component, createEffect, createSignal } from "solid-js";
import { makeGame, Path } from "../../models/pgn";
import { GameModel } from "../../models/GameModel";
import Moves from "./Moves";
import ButtonBar from "./Buttonbar";
import { getPosition, makeConfig } from "../common/utils";
import { Key, Piece } from "chessground/types";
import { parseSquare } from "chessops";
import { chessgroundDests } from "chessops/compat";


export type PgnEditorOptions = {
	pgn: Accessor<string | undefined>;
	setPgn: (pgn: string) => void;
}



const PgnEditor: Component<PgnEditorOptions> = ({ pgn, setPgn }) => {
	const [currentPath, setCurrentPath] = createSignal<Path | undefined>(undefined);
	const [game, setGame] = createSignal<GameModel | undefined>(undefined);
	const [squareHovered, setSquareHovered] = createSignal<string | undefined>(undefined);
	// const currentData = useCurrentData(game, currentPath)


	// After loading the pgn string, create the game model
	createEffect(() => {
		// const cg = api();
		let pgnString = pgn();
		if (!pgnString) {
			pgnString = "[]";
		}
		const gameModel = makeGame(pgnString);
		setGame(gameModel);
		setCurrentPath(gameModel.pathAtMainlinePly(0));

	});

    const onMove = (orig: Key, dest: Key, capturedPiece?: Piece)  => {
		const g = game();
		if (!g) {
			return;
		};
		const path = currentPath() || Path.root;


        // const pos = getPosition(game, currentPath);
        const sq1 = parseSquare(orig);
        const sq2 = parseSquare(dest);
		const move = {
            from: sq1!,
            to: sq2!,
            promotion: undefined
        };
        
		const [newGameModel, newPath] = g.applyMove(path, move);

		setGame(newGameModel);

		setCurrentPath(newPath);
		
    }

    const onSelect = (_key: Key) => {
    }

	const onDrawChange = (shapes: any) => {
		const ng = game()?.updateShapes(currentPath()!, shapes);
		setGame(ng);
	}

	const config = () => {
        
		const baseConfig = makeConfig(game, currentPath, squareHovered)();


		const pos = getPosition(game, currentPath);
		const allDests = chessgroundDests(pos);
        return {
            ...baseConfig,
			draggable: {
				enabled: true,
			},
            viewOnly: false,
			turnColor: pos.turn,
            movable: {
                free: false,
                color: pos.turn,
				dests: allDests
            },
            events: {
                move: onMove,
                
                select: onSelect
            },
			drawable: {
				...baseConfig.drawable,
				onChange: onDrawChange
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
							setGame={setGame}
							game={game}
							currentPath={currentPath}
							setCurrentPath={setCurrentPath}
							squareHovered={setSquareHovered}
							editable={()=>true}
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






