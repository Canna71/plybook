import { For, Component, Setter, Show, createContext, useContext } from "solid-js";
import { Path, PlyData } from "../models/pgn";
import { GameModel } from "../models/GameModel";
import { createSignal } from 'solid-js';
import { Accessor } from "solid-js";
import { ReferenceElement } from "@floating-ui/dom";
import { Tooltip } from "./Tooltip";
import { HierarchicalMoveData, makeTree } from "../models/tree";
import { CommentsView } from "./Comments";

// import "solid-contextmenu/dist/index.css";
import { Ply } from "./Ply";

export type MovesProps = {
	game: Accessor<GameModel | undefined>;
	setGame: Setter<GameModel | undefined>;
	currentPath: Accessor<Path | undefined>;
	setCurrentPath: Setter<Path | undefined>;
	squareHovered?: (square: string | undefined) => void;
	editable: Accessor<boolean>;
};


const CommentsRows: Component<{
	path: Path;
	starting?: boolean;
	comments: Accessor<string[]>
}> = ({ comments, path, starting }) => {
	const { squareHovered } = useContext(MovesContext)!;

	return <For each={comments()}>{(comment,index) =>
		<tr><td colSpan={3}>
			<CommentsView comments={() => comment} squareHovered={squareHovered} 
				path={path}
				index={index()}
				starting={starting}
				/>
		</td></tr>}
	</For>;
}

const MoveLine: Component<MoveProps> = ({ move }) => {

	const startingComments = move.white?.startingComments || [];
	const afterWhite = move.white?.comments || [];
	const afterBlack = move.black?.comments || [];

	const ppath = move.white?.path.previous() || Path.root;
	const wpath = move.white?.path || ppath;
	const bpath = move.black?.path || wpath;

	return <>
		<CommentsRows comments={() => startingComments} path={wpath} starting={true} />

		<tr>
			<td>
				<div class="pgnviewer-movenumber">{move.number}.

				</div>

			</td>
			<td>
				<Ply line={move} color="white" />
			</td>
			<td>
				<Show when={!afterWhite.length} fallback={
					<Ply line={move} />

				}>
					<Ply line={move} color="black" />
				</Show>
			</td>
		</tr>

		<CommentsRows comments={() => afterWhite} path={wpath} />

		<Show when={afterWhite.length && move.black}>
			<tr>
				<td>
					<div class="pgnviewer-movenumber">{move.number}.

					</div>

				</td>
				<td>
					<Ply line={move} />
				</td>
				<td>
					<Ply line={move} color="black" />
				</td>
			</tr>
		</Show>


		<CommentsRows comments={() => afterBlack} path={bpath} />

		{move.variations && <For each={move.variations}>
			{(variation) => <tr><td class="pgnviewer-variation-cell" colSpan={3}>
				<MovesTree movesTree={() => variation}


					initialComments={() => []}
				/>

			</td></tr>}
		</For>}
	</>;
}



type MoveProps = {
	move: HierarchicalMoveData;
};

type MovesTreeProps = {
	// showTooltip: (anchor: Element | undefined, plyData: PlyData | undefined) => void;
	movesTree: () => HierarchicalMoveData[];
	// currentPath: Accessor<Path | undefined>;
	// setCurrentPath: Setter<Path | undefined>;
	// squareHovered?: (square: string | undefined) => void;
	initialComments: Accessor<string[]>;
}

const MovesTree: Component<MovesTreeProps> = ({ movesTree, initialComments }) => {
	return (
		<table class="pgnviewer-moves">
			<CommentsRows comments={initialComments} path={Path.root} />
			<For each={movesTree()}>
				{(line) =>
					<>
						<MoveLine move={line} />
					</>}
			</For>
		</table>);
}

interface MovesContextType {
	// game?: () => { initial: { comments: string[] } };
	game: Accessor<GameModel | undefined>;
	setGame: Setter<GameModel | undefined>;
	currentPath: Accessor<Path | undefined>;
	setCurrentPath: (path: string[]) => void;
	showTooltip: (anchor: Element | undefined, plyData: PlyData | undefined) => void;
	squareHovered?: (square: string | undefined) => void;
	editable: Accessor<boolean>;
}
export const MovesContext = createContext<MovesContextType>();

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

	const initialComments = () => {
		return props.game()?.initial.comments || [];
	}



	return (
		<>
			<div class="pgnviewer-moves-panel"
				onClick={onClick}
			>
				<MovesContext.Provider value={
					{
						game: props.game,
						setGame: props.setGame,
						currentPath: props.currentPath,
						setCurrentPath: props.setCurrentPath,
						squareHovered: props.squareHovered,
						editable: props.editable,
						showTooltip,
					}
				}>
					<MovesTree
						movesTree={movesTree}


						initialComments={initialComments}
					/>
				</MovesContext.Provider>
			</div>
			<Show when={reference()}>
				<Tooltip plyData={ply} reference={reference} />
			</Show>
			
		</>);


};

export default Moves;
