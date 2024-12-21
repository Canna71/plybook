import { For, Component, Setter, Show, createEffect } from "solid-js";
import { GameModel, Path, PlyData } from "../models/pgn";
import { createSignal } from 'solid-js';
import { Accessor } from "solid-js";
import { Color } from "chessops/types";
import { ReferenceElement } from "@floating-ui/dom";
import { Tooltip } from "./Tooltip";
import { HierarchicalMoveData, makeTree } from "../models/tree";
// import { IconInfoSquareRoundedFilled } from "@tabler/icons-solidjs";
import { CommentsView } from "./Comments";

export type MovesProps = {
	game: Accessor<GameModel | undefined>;
	currentPath: Accessor<Path | undefined>;
	setCurrentPath: Setter<Path | undefined>;
	showComments: Accessor<boolean>;
	squareHovered?: (square: string | undefined) => void;
};

type PlyProps = {
	line: HierarchicalMoveData;
	color?: Color;
	currentPath: Accessor<Path | undefined>;
	// setCurrentPath: Setter<Path | undefined>;
	showTooltip: (anchor: Element | undefined, plyData: PlyData | undefined) => void;
}

const Ply: Component<PlyProps> = ({ line, color, currentPath, showTooltip }) => {

	const turn = color;
	const plyData = color && line[color];
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
			ref.scrollIntoView({ block: "nearest" });
		}
	});

	return <div
		ref={ref}
		onMouseEnter={(e) => isValid() && showTooltip(e.currentTarget, plyData)}
		onMouseLeave={() => showTooltip(undefined, undefined)}
		classList={moveClass()}
		data-color={color}
		data-path={color && line[color]?.path.path}  >{color && line[color]?.fan || "..."}
	</div>;
}

const CommentsRows: Component<{ comments: Accessor<string[]>, squareHovered?: 
	(square: string | undefined) => void
 }> = ({ comments, squareHovered }) => {
	return <For each={comments()}>{comment =>
		<tr><td colSpan={3}>
			<CommentsView comments={() => comment} squareHovered={squareHovered} />
		</td></tr>}
	</For>;
}

const MoveLine: Component<MoveProps> = ({ move, currentPath, setCurrentPath, showTooltip, squareHovered }) => {

	const startingComments = move.white?.startingComments || [];
	const afterWhite = move.white?.comments || [];
	const afterBlack = move.black?.comments || [];


	return <>
		<CommentsRows comments={()=>startingComments} squareHovered={squareHovered} />

		<tr>
			<td>
				<div class="pgnviewer-movenumber">{move.number}.

				</div>

			</td>
			<td>
				<Ply line={move} color="white" currentPath={currentPath} showTooltip={showTooltip} />
			</td>
			<td>
				<Show when={!afterWhite.length} fallback={
					<Ply line={move} currentPath={currentPath} showTooltip={showTooltip} />

				}>
					<Ply line={move} color="black" currentPath={currentPath} showTooltip={showTooltip} />
				</Show>
			</td>
		</tr>
		
		<CommentsRows comments={()=>afterWhite}  squareHovered={squareHovered} />

		<Show when={afterWhite.length && move.black}>
			<tr>
				<td>
					<div class="pgnviewer-movenumber">{move.number}.

					</div>

				</td>
				<td>
					<Ply line={move} currentPath={currentPath} showTooltip={showTooltip} />
				</td>
				<td>
					<Ply line={move} color="black" currentPath={currentPath} showTooltip={showTooltip} />
				</td>
			</tr>
		</Show>
		

		<CommentsRows comments={()=>afterBlack}  squareHovered={squareHovered} />

		{move.variations && <For each={move.variations}>
			{(variation) => <tr><td class="pgnviewer-variation-cell" colSpan={3}>
				<MovesTree movesTree={() => variation}
					currentPath={currentPath}
					setCurrentPath={setCurrentPath}
					showTooltip={showTooltip}
					squareHovered={squareHovered}
					initialComments={() => []}
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
	squareHovered?: (square: string | undefined) => void;
};

type MovesTreeProps = {
	showTooltip: (anchor: Element | undefined, plyData: PlyData | undefined) => void;
	movesTree: () => HierarchicalMoveData[];
	currentPath: Accessor<Path | undefined>;
	setCurrentPath: Setter<Path | undefined>;
	squareHovered?: (square: string | undefined) => void;
	initialComments: Accessor<string[]>;
}

const MovesTree: Component<MovesTreeProps> = ({ movesTree, currentPath, setCurrentPath, showTooltip, squareHovered, initialComments }) => {
	return (
		<table class="pgnviewer-moves">
			<CommentsRows comments={initialComments} squareHovered={squareHovered} />
			<For each={movesTree()}>
				{(line) =>
					<>
						<MoveLine move={line} currentPath={currentPath} setCurrentPath={setCurrentPath} showTooltip={showTooltip} squareHovered={squareHovered}  />
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
		console.log(tree);
		return tree || [];
	}

	const initialComments = () => {
		console.log("game()",props.game());
		return props.game()?.initial.comments || [];
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
					squareHovered={props.squareHovered}
					showTooltip={showTooltip} 
					initialComments={initialComments}
					/>
			</div>
			<Show when={reference()}>
				<Tooltip plyData={ply} reference={reference} />
			</Show>
		</>);


};

export default Moves;
