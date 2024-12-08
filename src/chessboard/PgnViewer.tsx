import { Chessboard } from "./chessboard";
import { Config } from "chessground/config";
import { Accessor, Component, createEffect, createSignal, JSXElement, on, Show } from "solid-js";
import { GameModel, makeGame, PlyData, Path, MoveData, isPlyData } from "../models/pgn";
import Moves from "./Moves";

import { makeSquare, NormalMove } from "chessops";
import { Key } from "chessground/types";
import ButtonBar from "./Buttonbar";

// see: https://github.com/lichess-org/pgn-viewer


// PgnViwer options

export type PgnViewerOptions = {
	pgn: Accessor<string | undefined>;

}

// regex for square names
const squareRegex = /([a-h][1-8])/g;

type CommentsProps = {
	comments: Accessor<string[] | undefined>;
	squareHovered?: (square: string | undefined) => void;
}

const  Comments : Component<CommentsProps> = ({comments, squareHovered}) => {
	
	const paragraphs = () => (comments() || []).map((line, index) => {
		const matches = line.match(squareRegex);
		
		if (matches) {
			matches.forEach((match) => {
				line = line.replace(match, `<span class="square" data-square="${match}">${match}</span>`);
			});
		}

		return <p innerHTML={line} />;
	});

	const onMouseOver = (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		if (target.dataset.square) {
			squareHovered?.(target.dataset.square);
		} 
	}

	const onMouseLeave = () => {
		squareHovered?.(undefined);
	}

	return <div 
		onMouseOver={onMouseOver}
		onMouseLeave={onMouseLeave}
		class="pgnviewer-comments">{paragraphs()}</div>

}





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

	const comments = () => {
		const g = game();
		if (!g) {
			return;
		}
		const path = currentPath();
		if (!path) {
			return g.initial.comments;
		}
		const data = currentData();
		if (!data) {
			return;
		}
		return data.comments;
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
	return (
		<>
			<div class="pgnviewer-container">
				<div class="pgnviewer-content">
					<div class="pgnviewer-chessboard">
						<Chessboard config={config}  />

					</div>
					<div class="pgnviewer-comments">
						<Comments comments={comments} 
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


