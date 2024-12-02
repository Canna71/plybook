import { Chessboard } from "./chessboard";
import { Config } from "chessground/config";
import { Accessor, Component, createEffect, createSignal, Show } from "solid-js";
import { Api } from "chessground/api";
import { GameModel, makeGame, PlyData, Path, MoveData, isPlyData } from "../models/pgn";
import Moves from "./Moves";

import { makeSquare, Move, NormalMove } from "chessops";
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
    let currentPly = 0;
    let currentMove: HierarchicalMoveData = undefined as any;
    let currentVariation: MoveData[] = [];
    // let node: Node<PlyData> = root;
    // if(!(node instanceof ChildNode)) {
    //     node = node.children[0];
    // }
    let node = root as ChildNode<PlyData>;
    while (node.children.length) {
        
        const mainLine = node.children[0];
        const num = Math.ceil(mainLine.data.ply / 2);
        if(num == currentMove?.number) {
            
        } else {
            currentMove = { number: num };
            list.push(currentMove);
        }
        const turn = mainLine.data.turn;
        currentMove[turn === 'white' ? 'white' : 'black'] = mainLine.data;

        const variations = node.children.slice(1);
		if(variations.length) {
			currentMove.variations = variations.map(v => makeTree(v, level + 1));
			currentMove.level = level + 1;
		}


        node = mainLine; // temporary
    }


    return list;
}


const PgnViewer: Component<PgnViewerOptions> = ({ pgn }) => {
	const [currentPath, setCurrentPath] = createSignal<Path | undefined>(undefined);
	const [game, setGame] = createSignal<GameModel | undefined>(undefined);

	const [api, setApi] = createSignal<Api | undefined>(undefined);

	const config: Config = {

	}

	const mainline = (): HierarchicalMoveData[] => {

		const moves = game()?.moves;
		const tree = moves && makeTree(moves);
		console.log("tree", tree);
		return tree || [];

		// const mainline = game()?.mainline;
		// if (!mainline) {
		// 	return [];
		// }
		// // group the mainline moves by 2, and add the index starting from 1
		// const groups = [];
		// for (let i = 0; i < mainline.length; i += 2) {
		// 	groups.push(mainline.slice(i, i + 2));
		// }


		// const ret: MoveData[] = groups.map((group, index) =>
		// // [index + 1, group[0], group[1]]
		// ({
		// 	number: index + 1,
		// 	white: group[0],
		// 	black: group[1]
		// })
		// );

		// console.log("groups", ret);

		// return ret;
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
		const cg = api();
		const pgnString = pgn();
		if (!cg || !pgnString) {
			return;
		}

		const gameModel = makeGame(pgnString);
		setGame(gameModel);
		setCurrentPath(gameModel.pathAtMainlinePly(0));
		// setCurrentPath(gameModel
		// cg.set({
		// 	fen: gameModel.initial.fen
		// });
	});

	const onNext = () => {
		// const cg = api();
		// if (!cg) {
		// 	return;
		// }
		// const g = game();
		// if (!g) {
		// 	return;
		// }


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

	const onPlyClick = (plyData: PlyData) => {
		console.log("onPlyClick", plyData);
		setCurrentPath(plyData.path);
	}

	createEffect(() => {
		const cg = api()!;
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
		cg.set(config);
	});

	return (
		<>
			<div class="pgnviewer-container">
				<div class="pgnviewer-content">
					<div class="pgnviewer-chessboard">
						<Chessboard config={config} setApi={setApi} />

					</div>
					<div class="pgnviewer-comments">
						{comments()}
					</div>
				</div>
				<div class="pgnviewer-sidebar">
					<div class="pgnviewer-mainline-wrapper">

						<Moves
							mainline={mainline}
							currentPath={currentPath}
							onPlyClick={onPlyClick}
						/>

					</div>


					<div class="pgn-viewer-buttonbar">
						<Show when={game() && currentPath()}>
							<button onClick={onRewind} >
								<IconPlayerTrackPrevFilled size="14" />
							</button>
							<button onClick={onPrev} >
								<IconPlayerSkipBackFilled size="14" />
							</button>
							<button onClick={onNext} >
								<IconPlayerSkipForwardFilled size="14" />
							</button>
							<button onClick={onFastForward}>
								<IconPlayerTrackNextFilled size="14" />
							</button>
						</Show>
					</div>

				</div>

			</div>
			<div class="pfn-viewer-bottom">

			</div>
		</>
	);
}

export default PgnViewer;




