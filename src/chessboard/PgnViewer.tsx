import { Chessboard } from "./chessboard";
import { Config } from "chessground/config";
import { Accessor, Component, createEffect, createSignal, Show } from "solid-js";
import { GameModel, makeGame, PlyData, Path, MoveData, isPlyData } from "../models/pgn";
import Moves from "./Moves";

import { makeSquare, NormalMove } from "chessops";
import { IconPlayerSkipBackFilled, IconPlayerSkipForwardFilled, IconPlayerTrackNextFilled, IconPlayerTrackPrevFilled } from '@tabler/icons-solidjs';
import { Node, ChildNode } from "chessops/pgn";
// see: https://github.com/lichess-org/pgn-viewer


// PgnViwer options

export type PgnViewerOptions = {
	pgn: Accessor<string | undefined>;

}

export interface HierarchicalMoveData extends MoveData {
	variations?: HierarchicalMoveData[][];
	level?: number;
}

// Makes a "tree" of moves grouping them by ply
// if at some ply there is some variations (for example for white) leave the black move empty
// variations will be added as variations of the PlyData and the UI will indent it
function makeTree(root: Node<PlyData>, level: number = 0): HierarchicalMoveData[] {
	const list: MoveData[] = [];
	let currentMove: HierarchicalMoveData = undefined as any;

	let node = root;
	while (node.children.length) {

		const mainLine = node.children[0] as ChildNode<PlyData>;
		const num = Math.ceil(mainLine.data.ply / 2);
		if (num == currentMove?.number) {

		} else {
			currentMove = { number: num, level };
			list.push(currentMove);
		}
		const turn = mainLine.data.turn;
		currentMove[turn === 'white' ? 'black' : 'white'] = mainLine.data;

		const variations = node.children.slice(1);
		if (variations.length) {
			currentMove.variations = variations.map(v => {
				const tmp = new Node<PlyData>();
				tmp.children = [v];
				// extend<PlyData>(tmp, [v.data]);
				return makeTree(tmp, level + 1)
			});
			if (turn === 'black') {
				currentMove = { number: num, level };
				list.push(currentMove);
			}
		}


		node = mainLine; // temporary
	}


	return list;
}


const PgnViewer: Component<PgnViewerOptions> = ({ pgn }) => {
	const [currentPath, setCurrentPath] = createSignal<Path | undefined>(undefined);
	const [game, setGame] = createSignal<GameModel | undefined>(undefined);
	// const [api, setApi] = createSignal<Api | undefined>(undefined);
	const [config, setConfig] = createSignal<Config>({});



	const movesTree = (): HierarchicalMoveData[] => {

		const moves = game()?.moves;
		const tree = moves && makeTree(moves);
		console.log("moves", moves);
		console.log("tree", tree);
		return tree || [];
	}

	const currentNode = () => {
		const g = game();
		if (!g) {
			return;
		}
		const path = currentPath();
		if (!path) {
			return;
		}
		return g.nodeAt(path);
	}

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

	const onNext = () => {
		
		const nextNode = currentNode()?.children[0];
		setCurrentPath(nextNode?.data.path);
	}

	const onPrev = () => {


		const path = currentPath();
		if (!path) {
			return;
		}

		setCurrentPath(path.previous());
	}

	const onRewind = () => {
		setCurrentPath(game()!.pathAtMainlinePly(0));
	}

	const onFastForward = () => {
		const g = game();
		if (!g) {
			return;
		}
		const path = g.pathAtMainlinePly(g.mainline.length - 1);
		setCurrentPath(path);
	}

	createEffect(() => {
		// const cg = api()!;
		const data = currentData();
		if (!data) {
			return;
		}
		const lm = lastMove() as NormalMove | undefined;


		const lastMoveKey = lm && [makeSquare(lm.from), makeSquare(lm.to)];
		// var key = cg.
		const config: Config = {
			fen: data.fen,
			lastMove: lastMoveKey,
			// TODO: look at https://github.com/lichess-org/pgn-viewer/blob/master/src/pgnViewer.ts
		}
		setConfig(config);
	});
	// TODO: add a button to show/hide variations
	// TODO: add an icon to indicate comments (also for starting comments of variations)
	// TODO: parse square names in comments and highlight squares
	return (
		<>
			<div class="pgnviewer-container">
				<div class="pgnviewer-content">
					<div class="pgnviewer-chessboard">
						<Chessboard config={config}  />

					</div>
					<div class="pgnviewer-comments">
						{comments()}
					</div>
				</div>
				<div class="pgnviewer-sidebar">
					<div class="pgnviewer-moves-wrapper">

						<Moves
							movesTree={movesTree}
							currentPath={currentPath}
							setCurrentPath={setCurrentPath}
						/>

					</div>
					<ButtonBar
						game={game}
						currentPath={currentPath}
						onRewind={onRewind}
						onPrev={onPrev}
						onNext={onNext}
						onFastForward={onFastForward}
					/>
				</div>

			</div>
			<div class="pfn-viewer-bottom">

			</div>
		</>
	);
}

export default PgnViewer;


type ButtonBarProps = {
	game: Accessor<GameModel | undefined>;
	currentPath: Accessor<Path | undefined>;
	onRewind: () => void;
	onPrev: () => void;
	onNext: () => void;
	onFastForward: () => void;
}

const ButtonBar:Component<ButtonBarProps> = ({game, currentPath, onRewind, onPrev, onNext, onFastForward}) => {
	return <div class="pgn-viewer-buttonbar">
		<Show when={game() && currentPath()}>
			<button onClick={onRewind}>
				<IconPlayerTrackPrevFilled size="14" />
			</button>
			<button onClick={onPrev}>
				<IconPlayerSkipBackFilled size="14" />
			</button>
			<button onClick={onNext}>
				<IconPlayerSkipForwardFilled size="14" />
			</button>
			<button onClick={onFastForward}>
				<IconPlayerTrackNextFilled size="14" />
			</button>
		</Show>
	</div>;
}

