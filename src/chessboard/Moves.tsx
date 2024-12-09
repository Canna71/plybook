import { For, Component, Setter, Show, createEffect } from "solid-js";
import { GameModel, Path, PlyData } from "../models/pgn";
import { createSignal } from 'solid-js';
import { Accessor } from "solid-js";
import { Color } from "chessops/types";
import { ReferenceElement } from "@floating-ui/dom";
import { Tooltip } from "./Tooltip";
import { HierarchicalMoveData, makeTree } from "../models/tree";

export type MovesProps = {
	game: Accessor<GameModel | undefined>;
	currentPath: Accessor<Path | undefined>;
	setCurrentPath: Setter<Path | undefined>;
};

type PlyProps = {
	line: HierarchicalMoveData;
	color: Color;
	currentPath: Accessor<Path | undefined>;
	// setCurrentPath: Setter<Path | undefined>;
	showTooltip: (anchor: Element | undefined, plyData: PlyData | undefined) => void;
}

const Ply: Component<PlyProps> = ({ line, color, currentPath, showTooltip }) => {

	const turn = color;
	const plyData = line[color];
	let ref: HTMLDivElement | undefined;

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

	createEffect(() => {
		if (isCurrent() && ref) {
			ref.scrollIntoView({block: "nearest"});
		}
	});

	return <div
		ref={ref}
		onMouseEnter={(e) => isValid() && showTooltip(e.currentTarget, plyData)}
		onMouseLeave={() => showTooltip(undefined, undefined)}
		classList={moveClass()}
		data-color={color}
		data-path={line[color]?.path.path}  >{line[color]?.fan || "..."}</div>;
}

const MoveLine: Component<MoveProps> = ({ move, currentPath, setCurrentPath, showTooltip }) => {
	return <>
		<tr>
			<td>
				<div class="pgnviewer-movenumber">{move.number}.</div>
			</td>
			<td>
				<Ply line={move} color="white" currentPath={currentPath} showTooltip={showTooltip} />
			</td>
			<td>
				<Ply line={move} color="black" currentPath={currentPath} showTooltip={showTooltip} />
			</td>


		</tr>
		{move.variations && <For each={move.variations}>
			{(variation) => <tr><td class="pgnviewer-variation-cell" colSpan={3}>
				<MovesTree movesTree={() => variation} 
					currentPath={currentPath} 	
					setCurrentPath={setCurrentPath} 
					showTooltip={showTooltip}
				/>

			</td></tr>}
		</For>}
	</>;
}



type MoveProps = {
	move: HierarchicalMoveData;
	currentPath: Accessor<Path | undefined>;
	setCurrentPath: Setter<Path | undefined>;
	showTooltip: (anchor: Element | undefined, plyData: PlyData | undefined) => void;
};

type MovesTreeProps =  {
	showTooltip: (anchor: Element | undefined, plyData: PlyData | undefined) => void;
	movesTree: () => HierarchicalMoveData[];
	currentPath: Accessor<Path | undefined>;
	setCurrentPath: Setter<Path | undefined>;
}

const MovesTree: Component<MovesTreeProps> = ({ movesTree, currentPath, setCurrentPath, showTooltip }) => {
	return (
		<table class="pgnviewer-moves">
			<For each={movesTree()}>
				{(line) =>
					<>
						<MoveLine move={line} currentPath={currentPath} setCurrentPath={setCurrentPath} showTooltip={showTooltip} />
					</>}
			</For>
		</table>);
}

const Moves: Component<MovesProps> = (props) => {
	const [reference, setReference] = createSignal<ReferenceElement | null | undefined>(undefined);
	
	const [ply, setPly] = createSignal<PlyData>();

	const onClick = (e: Event) => {
		const target = e.target as HTMLElement;
		const path: string | undefined = target.dataset.path;

		if (!path) {
			return;
		}
		props.setCurrentPath(new Path(path));
	}

	const showTooltip = (anchor: Element | undefined, plyData: PlyData | undefined) => {
		setPly(plyData);
		setReference(anchor);
	}

	const movesTree = (): HierarchicalMoveData[] => {

		const moves = props.game()?.moves;
		const tree = moves && makeTree(moves);
		return tree || [];
	}
	

	return (
		<>
			<div class="pgnviewer-moves-panel"
				onClick={onClick}
			>
				<MovesTree 
					movesTree={movesTree} 
					currentPath={props.currentPath}  
					setCurrentPath={props.setCurrentPath}
					showTooltip={showTooltip} />
			</div>
			<Show when={reference()}>
				<Tooltip plyData={ply} reference={reference} />
			</Show>
		</>);


};

export default Moves;
