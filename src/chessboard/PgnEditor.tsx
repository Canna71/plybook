import { Chessboard } from "./chessboard";
import { Accessor, Component, createEffect, createSignal } from "solid-js";
import { GameModel, isPlyData, makeGame, Path } from "../models/pgn";
import Moves from "./Moves";
import { Chess } from 'chessops/chess';
import ButtonBar from "./Buttonbar";
import { getPosition, makeConfig, toColor, toDests, useCurrentData } from "./utils";
import { Key, Piece } from "chessground/types";
import { INITIAL_FEN, parseFen } from "chessops/fen";
import { makeSquare, parseSquare } from "chessops";
import { makeSan } from "chessops/san";
import { chessgroundDests, scalachessCharPair } from "chessops/compat";
import { extend, isChildNode, makePgn } from "chessops/pgn";
import { create } from "@tauri-apps/plugin-fs";


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
		console.log("pgnString", pgnString);
		const gameModel = makeGame(pgnString);
		setGame(gameModel);
		setCurrentPath(gameModel.pathAtMainlinePly(0));

	});

    const onMove = (orig: Key, dest: Key, capturedPiece?: Piece)  => {
        console.log("onMove", orig, dest, capturedPiece);
		// const currentPath = game()?.currentPath || Path
		const path = currentPath() || Path.root;


        // const pos = getPosition(game, currentPath);
        const sq1 = parseSquare(orig);
        const sq2 = parseSquare(dest);
		const move = {
            from: sq1!,
            to: sq2!,
            promotion: undefined
        };
        
		const newPath = game()?.applyMove(path, move);

		setGame(game()?.clone());

		setCurrentPath(newPath);
		
    }

    const onSelect = (key: Key) => {
        // console.log("onSelect", key);
    }

	const currentData = useCurrentData(game, currentPath);

	const comments = () => {
		const data = currentData();
		return isPlyData(data) && data?.comments.join("\n") || "";
	}

	const changedComments = (e: Event) => {
		const target = e.target as HTMLTextAreaElement;
		const path = currentPath();
		if (path) {
			const comments = [target.value]; //.split("\n");
			game()?.changeComments(path, comments);
			setGame(game()?.clone());
		} else {
			console.error("No path");
		}
	}

	const config = () => {
        
		const baseConfig = makeConfig(game, currentPath, squareHovered)();

		// console.log("baseConfig", baseConfig);	

		const pos = getPosition(game, currentPath);
		const allDests = chessgroundDests(pos);
        return {
            ...baseConfig,

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
					<div class="pgnviewer-comments">
						<textarea value={comments()} onChange={changedComments} />
					</div>
				</div>
				
				<div class="pgnviewer-sidebar">
					<div class="pgnviewer-moves-wrapper">

						<Moves
							game={game}
							currentPath={currentPath}
							setCurrentPath={setCurrentPath}
							squareHovered={setSquareHovered}
							
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






