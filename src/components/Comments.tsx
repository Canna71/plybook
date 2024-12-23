import { Accessor, Component, createEffect, For, useContext } from "solid-js";
import { Path, isPlyData } from "../models/pgn";
import { GameModel } from "../models/GameModel";
import { useCurrentData } from "./common/utils";
import { MovesContext } from "./Moves";
import { set } from "es-toolkit/compat";

// regex for square names
export const squareRegex = /([a-h][1-8])/g;

type CommentsProps = {
	game: Accessor<GameModel | undefined>;
	currentPath: Accessor<Path | undefined>;
	squareHovered?: (square: string | undefined) => void;
	commentType?: "initial" | "starting" | "move";
};


export const Comments2: Component<CommentsProps> = ({ game, currentPath, squareHovered, commentType }) => {

	const currentData = useCurrentData(game, currentPath);

	const path = currentPath() || Path.root;
	

	const comments = () => {
		const data = currentData();
		if (commentType === "initial") {
			return game()?.initial.comments || [];
		} else if (commentType === "starting") {
			return isPlyData(data) && data.startingComments || [];
		}

		return isPlyData(data) && data?.comments || [];

	};

	return <For each={comments()}>
		{(comment, index) => <CommentsView comments={() => comment} squareHovered={squareHovered} path={path} index={index()} />}
	</For>;


	
};

export type CommentsViewProps = {
	comments: Accessor<string>;
	squareHovered?: (square: string | undefined) => void;
	path: Path;
	index: number;
};

export const CommentsView:Component<CommentsViewProps> = ({comments, squareHovered, path, index}) => {
	
	// take editable from context

	const { editable, game, setGame } = useContext(MovesContext)!;
	let ref: HTMLDivElement | undefined;
	
	const paragraph = () =>  {
		let line = comments() || "";
		const matches = line.match(squareRegex);

		if (matches) {
			matches.forEach((match) => {
				line = line.replace(match, `<span class="square" data-square="${match}">${match}</span>`);
			});
		}

		return line;
	};

	const onMouseOver = (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		if (target.dataset.square) {
			squareHovered?.(target.dataset.square);
		}
	};

	const onMouseLeave = () => {
		squareHovered?.(undefined);
	};

	const onBlur = (e: Event) => {
		const target = e.target as HTMLElement;
		const text = target.textContent || "";
		console.log("onChange", text);
		const ng = game()?.updateComment(path, index, text);
		setGame(ng);
	}

	// focuses the element if it's empty and editable
	createEffect(() => {
		if (editable() && !comments()) {
			ref?.focus();
		}
	});


	return <div
		ref={ref}
		data-placeholder="Add a comment"
		contentEditable={editable()}
		onMouseOver={onMouseOver}
		onMouseLeave={onMouseLeave}
		onBlur={onBlur}
		class="pgnviewer-comments"
		innerHTML={paragraph()}
		></div>;
}
