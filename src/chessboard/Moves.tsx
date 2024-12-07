import { For, Component, Setter, Show } from "solid-js";
import { MoveData, Path, PlyData, toMove } from "../models/pgn";
import { createSignal } from 'solid-js';
import { useFloating } from 'solid-floating-ui';
import { Accessor } from "solid-js";
import { Color, NormalMove } from "chessops/types";
import { HierarchicalMoveData } from "./PgnViewer";
import { ReferenceElement } from "@floating-ui/dom";

export type MovesProps = {
	movesTree: Accessor<HierarchicalMoveData[]>;
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

	return <div 
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
				<Moves movesTree={() => variation} currentPath={currentPath} setCurrentPath={setCurrentPath} />

			</td></tr>}
		</For>}
	</>;
}

type InternalMoveProps = MovesProps & {
	showTooltip: (anchor: Element | undefined, plyData: PlyData | undefined) => void;
}

type MoveProps = {
	move: HierarchicalMoveData;
	currentPath: Accessor<Path | undefined>;
	setCurrentPath: Setter<Path | undefined>;
	showTooltip: (anchor: Element | undefined, plyData: PlyData | undefined) => void;
};

const MovesTree: Component<InternalMoveProps> = ({ movesTree, currentPath, setCurrentPath, showTooltip }) => {
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
	const [floating, setFloating] = createSignal<HTMLElement>();
	const [ply, setPly] = createSignal<PlyData>();

	const onClick = (e: Event) => {
		const target = e.target as HTMLElement;
		const path: string | undefined = target.dataset.path;

		if (!path) {
			return;
		}
		// console.log("clicked", color, number);
		props.setCurrentPath(new Path(path));
	}

	const showTooltip = (anchor: Element | undefined, plyData: PlyData | undefined) => {
		console.log("showTooltip", anchor);
		setPly(plyData);
		setReference(anchor);
	}

	// See: https://github.com/lxsmnsyc/solid-floating-ui
	// And: https://floating-ui.com/docs/tutorial
	const position = useFloating(reference, floating);

	return (
		<>
			<div class="pgnviewer-moves-panel"
				onClick={onClick}
			>
				<MovesTree {...props} showTooltip={showTooltip} />
			</div>
			<Show when={position && reference()}>
				<div
					class="pgnviewer-tooltip"
					ref={setFloating}
					style={{
						position: position.strategy,
						top: `${position.y ?? 0}px`,
						left: `${position.x ?? 0}px`,
					}}
				>
					Tooltip
					FEN: {ply()?.fen}
					LastMove: {toMove(ply()?.move as NormalMove)}
				</div>
			</Show>
		</>);


};

export default Moves;
