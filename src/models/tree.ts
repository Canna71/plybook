// Makes a "tree" of moves grouping them by ply
// if at some ply there is some variations (for example for white) leave the black move empty

import { Node, ChildNode } from "chessops/pgn";
import { MoveData, PlyData } from "./pgn";

export interface HierarchicalMoveData extends MoveData {
	variations?: HierarchicalMoveData[][];
	level?: number;
}


// variations will be added as variations of the PlyData and the UI will indent it
export function makeTree(root: Node<PlyData>, level: number = 0, variations: boolean=true): HierarchicalMoveData[] {
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

		const moveVariations = node.children.slice(1);
		if (variations && moveVariations.length) {
			currentMove.variations = moveVariations.map(v => {
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

	// removes last node if empty
	if (currentMove && !currentMove.white && !currentMove.black) {
		list.pop();
	}

	return list;
}