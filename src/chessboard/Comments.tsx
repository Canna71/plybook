import { Accessor, Component, For } from "solid-js";
import { GameModel, Initial, Path, PlyData, isPlyData } from "../models/pgn";
import { useCurrentData } from "./utils";

// regex for square names
export const squareRegex = /([a-h][1-8])/g;

type CommentsProps = {
	game: Accessor<GameModel | undefined>;
	currentPath: Accessor<Path | undefined>;
	squareHovered?: (square: string | undefined) => void;
	commentType?: "initial" | "starting" | "move";
};


export const Comments: Component<CommentsProps> = ({ game, currentPath, squareHovered, commentType }) => {

	const currentData = useCurrentData(game, currentPath);

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
		{comment => <CommentsView comments={() => comment} squareHovered={squareHovered} />}
	</For>;


	
};

export type CommentsViewProps = {
	comments: Accessor<string>;
	squareHovered?: (square: string | undefined) => void;
};

export const CommentsView:Component<CommentsViewProps> = ({comments, squareHovered}) => {
	const paragraph = () =>  {
		let line = comments() || "";
		const matches = line.match(squareRegex);

		if (matches) {
			matches.forEach((match) => {
				line = line.replace(match, `<span class="square" data-square="${match}">${match}</span>`);
			});
		}

		return <p innerHTML={line} />;
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

	return <div
		onMouseOver={onMouseOver}
		onMouseLeave={onMouseLeave}
		class="pgnviewer-comments">{paragraph()}</div>;
}
