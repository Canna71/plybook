import { For, Component, Setter } from "solid-js";
import { MoveData, Path, PlyData } from "../models/pgn";

import { Accessor } from "solid-js";
import { Color } from "chessops/types";
import { HierarchicalMoveData } from "./PgnViewer";

export type MovesProps = {
	movesTree: Accessor<HierarchicalMoveData[]>;
	currentPath: Accessor<Path | undefined>;
	setCurrentPath: Setter<Path | undefined>;
};

const Ply: Component<{ line: HierarchicalMoveData, color: Color, currentPath: Accessor<Path | undefined> }> = ({ line, color, currentPath }) => {

	const turn = color;
	const plyData = line[color];
	const isCurrent = () => {
		return currentPath() && plyData?.path.equals(currentPath()!);
	}	
	const isValid = () => {
		return plyData !== undefined;
	};

	const moveClass = () => {
		return {
			"pgnviewer-move": isValid(),
			[turn + `-move`]: true,
			"current-move": isCurrent()
		};
	}

	return <div classList={moveClass()} data-color={color} data-path={line[color]?.path.path}  >{line[color]?.fan || "..."}</div>;
}

const Move: Component<{
	move: HierarchicalMoveData,
	currentPath: Accessor<Path | undefined>,
	setCurrentPath: Setter<Path | undefined>
}> = ({ move, currentPath, setCurrentPath }) => {
	return <>
		<tr>
			<td>
				<div class="pgnviewer-movenumber">{move.number}.</div>
			</td>
			<td>
				<Ply line={move} color="white" currentPath={currentPath} />
			</td>
			<td>
				<Ply line={move} color="black" currentPath={currentPath} />
			</td>


		</tr>
		{move.variations && <For each={move.variations}>
			{(variation) => <tr><td class="pgnviewer-variation-cell" colSpan={3}>
				<Moves movesTree={()=>variation} currentPath={currentPath} setCurrentPath={setCurrentPath} />
			
			</td></tr>}
		</For>}
	</>;
}


const Moves: Component<MovesProps> = (props) => {

	const onClick = (e: Event) => {
		const target = e.target as HTMLElement;
		const path: string | undefined = target.dataset.path;

		if (!path) {
			return;
		}
		// console.log("clicked", color, number);
		props.setCurrentPath(new Path(path));
	}



	return <table class="pgnviewer-moves"
		onClick={onClick}
	>
		<For each={props.movesTree()}>
			{(line) =>
				<>
					<Move move={line} currentPath={props.currentPath} setCurrentPath={props.setCurrentPath} />

				</>}
		</For>
	</table>;


};

export default Moves;
