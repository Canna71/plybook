import { For, Component, Setter, Show, createEffect, createContext, useContext } from "solid-js";
import { GameModel, Path, PlyData } from "../models/pgn";
import { createSignal } from 'solid-js';
import { Accessor } from "solid-js";
import { Color } from "chessops/types";
import { ReferenceElement } from "@floating-ui/dom";
import { Tooltip } from "./Tooltip";
import { HierarchicalMoveData, makeTree } from "../models/tree";
// import { IconInfoSquareRoundedFilled } from "@tabler/icons-solidjs";
import { CommentsView } from "./Comments";
import { useContextMenu, Menu, Item, Separator, Submenu } from "solid-contextmenu";
import { DOMElement } from "solid-js/jsx-runtime";

export type MovesProps = {
	game: Accessor<GameModel | undefined>;
	currentPath: Accessor<Path | undefined>;
	setCurrentPath: Setter<Path | undefined>;
	squareHovered?: (square: string | undefined) => void;
	editable: Accessor<boolean>;
};


type PlyProps = {
	line: HierarchicalMoveData;
	color?: Color;
}

const Ply: Component<PlyProps> = ({ line, color }) => {

	const turn = color;
	const plyData = color && line[color];
	let ref: HTMLDivElement | undefined;
	const { currentPath, showTooltip, editable } = useContext(MovesContext)!;
	const { show } = useContextMenu({ id: MENU_ID, props: "lala" });

	const isCurrent = () => {
		return currentPath() && plyData?.path.equals(currentPath()!);
	}
	const isValid = () => {
		return plyData !== undefined;
	};

	const innerShowTooltip = (e: MouseEvent & {
		currentTarget: HTMLDivElement;
		target: DOMElement;
	} | undefined) => {
		if (e) {
			isValid() && editable() && showTooltip(e.currentTarget, plyData);
		} else {
			showTooltip(undefined, undefined);
		}
	}

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

	return <><div
		ref={ref}
		onMouseEnter={innerShowTooltip}
		onMouseLeave={() => innerShowTooltip(undefined)}
		classList={moveClass()}
		data-color={color}
		data-path={color && line[color]?.path.path}
		onContextMenu={(e) => {
			console.log("context menu");
			show(e, { props: 1 });
		}}
	>{color && line[color]?.fan || "..."}

	</div>

	</>;
}

const CommentsRows: Component<{
	comments: Accessor<string[]>
}> = ({ comments }) => {
	const { squareHovered } = useContext(MovesContext)!;

	return <For each={comments()}>{comment =>
		<tr><td colSpan={3}>
			<CommentsView comments={() => comment} squareHovered={squareHovered} />
		</td></tr>}
	</For>;
}

const MoveLine: Component<MoveProps> = ({ move }) => {

	const startingComments = move.white?.startingComments || [];
	const afterWhite = move.white?.comments || [];
	const afterBlack = move.black?.comments || [];


	return <>
		<CommentsRows comments={() => startingComments} />

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

		<CommentsRows comments={() => afterWhite} />

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


		<CommentsRows comments={() => afterBlack} />

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
			<CommentsRows comments={initialComments} />
			<For each={movesTree()}>
				{(line) =>
					<>
						<MoveLine move={line} />
					</>}
			</For>
		</table>);
}

const MENU_ID = "pgnviewer-menu";
interface MovesContextType {
	// game?: () => { initial: { comments: string[] } };
	currentPath: Accessor<Path | undefined>;
	setCurrentPath: (path: string[]) => void;
	showTooltip: (anchor: Element | undefined, plyData: PlyData | undefined) => void;
	squareHovered?: (square: string | undefined) => void;
	editable: Accessor<boolean>;
}
const MovesContext = createContext<MovesContextType>();

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
			<Menu id={MENU_ID} >
				<Item>⚡ Beautiful</Item>
				<Item>😊 Easy use</Item>
				<Separator />
				<Item>💕 Built with heart</Item>
				<Submenu label="▶️ submenu">
					<Item>👋 Hello</Item>
					<Item>😀 Hello</Item>
					<Item>🤝 你好</Item>
				</Submenu>
				<Item disabled>❌ Disabled</Item>
			</Menu>
		</>);


};

export default Moves;
