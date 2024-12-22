import { Chessboard } from "./chessboard";
import { Accessor, Component, createEffect, createSignal } from "solid-js";
import { GameModel, isPlyData, makeGame, Path } from "../models/pgn";
import Moves from "./Moves";
import { Chess } from 'chessops/chess';
import ButtonBar from "./Buttonbar";
import { makeConfig, toColor, toDests, useCurrentData } from "./utils";
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
		console.log("path", path);
        const data = useCurrentData(game, currentPath)();
		const node = game()?.dataAt(path);
        const fen = data?.fen || INITIAL_FEN;

		const setup = parseFen(fen).unwrap();
        const pos = Chess.fromSetup(setup).unwrap();
        const sq1 = parseSquare(orig);
        const sq2 = parseSquare(dest);
		const move = {
            from: sq1!,
            to: sq2!,
            promotion: undefined
        };
        const san = makeSan(pos,{
            from: sq1!,
            to: sq2!,
            promotion: undefined
        });
		const moveId = scalachessCharPair(move);


		// TODO: update game, and update PGN
		// const pgnNode = isPlyData(node) ? node.pgnNode : game()?.game.moves!;

		const pgnNode = game()?.findPgnNode(path);
		const newnode = extend(pgnNode!, [{san}]);
		const pgn = makePgn(game()?.game!);
		setPgn(pgn);
		const newPath = path.append(moveId);
		setCurrentPath(newPath);
		// const parent = game()?.dataAt(currentPath);
		// parent.
        

        // game()?.game 
    }

    const onSelect = (key: Key) => {
        // console.log("onSelect", key);
    }



	const config = () => {
        
		const path = currentPath() || Path.root;
		
		
		const baseConfig = makeConfig(game, currentPath, squareHovered)();

		console.log("baseConfig", baseConfig);


		const data = useCurrentData(game, currentPath)();
		const fen = data?.fen || INITIAL_FEN;
		const setup = parseFen(fen).unwrap();
        const pos = Chess.fromSetup(setup).unwrap();
		// const allDesrs = toDests(pos);
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





