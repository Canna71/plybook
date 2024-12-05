import { For, Component, Setter } from "solid-js";
import { MoveData, Path, PlyData } from "../models/pgn";

import { Accessor } from "solid-js";
import { Color } from "chessops/types";
import { HierarchicalMoveData } from "./PgnViewer";

export type MovesProps = {
	mainline: Accessor<HierarchicalMoveData[]>;
	currentPath: Accessor<Path | undefined>;
	setCurrentPath: Setter<Path | undefined>;
	onPlyClick?: (plyData: PlyData) => void;
};

const Ply: Component<{ line: HierarchicalMoveData, color: Color, currentPath: Accessor<Path | undefined> }> = ({ line, color, currentPath }) => {
	
	const turn = color;
	const plyData = line[color];
	const  moveClass = () => {
		return { "pgnviewer-move": true, 
			[turn + `-move`]: true, 
			"current-move": currentPath() && plyData?.path.equals(currentPath()!) };
	}

	return <div classList={moveClass()} data-color={color} data-path={line[color]?.path.path}  >{line[color]?.fan || "..."}</div>;
}

const Move: Component<{
	move: HierarchicalMoveData,
	currentPath: Accessor<Path | undefined>
}> = ({ move, currentPath }) => {
	return <div class="pgnviewer-moveline">
		<div class="pgnviewer-movenumber">{move.number}.</div>
		<Ply line={move} color="white" currentPath={currentPath} />
		<Ply line={move} color="black" currentPath={currentPath} />

		{move.variations && <For each={move.variations}>
			{(variation) => <Variation variation={variation} currentPath={currentPath} />}
		</For>}
	</div>;
}

const Variation: Component<{
	variation: HierarchicalMoveData[],
	currentPath: Accessor<Path | undefined>
}> = ({ variation, currentPath }) => {
	return <div class="pgnviewer-variation" data-level={variation[0].level}>
		<For each={variation}>
			{(line) =>
				<>
					<div class="pgnviewer-movenumber">{line.number}.</div>
					<Ply line={line} color="white" currentPath={currentPath} />
					<Ply line={line} color="black" currentPath={currentPath} />

				</>
			}
		</For>
	</div>;
}

const Moves: Component<MovesProps> = (props) => {

	const onClick = (e: Event) => {
		// TODO: handle click on variation
		const target = e.target as HTMLElement;
		const path: string | undefined = target.dataset.path;
		
		if (!path) {
			return;
		}
		// console.log("clicked", color, number);
		props.setCurrentPath(new Path(path));
	}



	return <div class="pgnviewer-mainline"
		onClick={onClick}
	>
		<For each={props.mainline()}>
			{(line) =>
				<>
					<Move move={line} currentPath={props.currentPath} />
					
				</>}
		</For>
	</div>;


};

export default Moves;
