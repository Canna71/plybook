import { Accessor, Component, createEffect, For, useContext } from "solid-js";

import { GameModel } from "../../models/GameModel";
import { useCurrentData } from "../common/utils";
import { useContextMenu } from "../common/contextmenu";
import { isPlyData, Path } from "../../models/pgn";
import { GameContext } from "./GameContext";

// regex for square names
export const squareRegex = /([a-h][1-8])/g;

type CommentsProps = {
	game: Accessor<GameModel | undefined>;
	currentPath: Accessor<Path | undefined>;
	squareHovered?: (square: string | undefined) => void;
	commentType?: "initial" | "starting" | "move";
};


export const __Comments2: Component<CommentsProps> = ({ game, currentPath, commentType }) => {

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
		{(comment, index) => <CommentsView comments={() => comment}  path={path} index={index()} />}
	</For>;


	
};

export type CommentsViewProps = {
	comments: Accessor<string>;
	// squareHovered?: (square: string | undefined) => void;
	path: Path;
	index: number;
	starting?: boolean;
};

export const CommentsView:Component<CommentsViewProps> = ({comments, path, index, starting

}) => {
	
	// take editable from context

	const { editable, game, setGame, setSquareHovered } = useContext(GameContext)!;
	let ref: HTMLTextAreaElement | undefined;
	
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
			setSquareHovered?.(target.dataset.square);
		}
	};

	const onMouseLeave = () => {
		setSquareHovered?.(undefined);
	};

	const onBlur = (e: Event) => {
		const target = e.target as HTMLTextAreaElement;
		let text = target.value || "";
		console.log('onBlur', text);
		// target.childNodes.forEach((node) => {
		// 	if (node.nodeType === Node.TEXT_NODE) {
		// 		text += node.textContent;
		// 	} else if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === "BR") {
		// 		text += "\n";
		// 	}
		// });

		const ng = game()?.updateComment(path, index, text, starting);
		setGame(ng);
	};

	// focuses the element if it's empty and editable
	createEffect(() => {
		if (editable() && !comments()) {
			ref?.focus();
		}
	});

	const onDelete = () => {
		const ng = game()?.deleteComment(path, index, starting);
		setGame(ng);
	}
	
	const onContextMenuInternal = useContextMenu({
		items: [
			{ id: "moves_comment_delete", text: "Delete Comment", action: onDelete },
		],
	});

	const onContextMenu = (e: MouseEvent) => {
		if(editable()) {
			onContextMenuInternal(e);
		}
	}

	return <textarea
		ref={ref!}
		// data-placeholder="Add a comment"
		placeholder="Add a comment"
		contentEditable={editable()}
		onMouseOver={onMouseOver}
		onMouseLeave={onMouseLeave}
		onBlur={onBlur}
		class="textarea pgnviewer-comments"
		innerHTML={paragraph()}
		onContextMenu={onContextMenu}
		></textarea>;
}
