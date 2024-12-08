import { Accessor, Component } from "solid-js";
import { Initial, PlyData, isPlyData } from "../models/pgn";
import { squareRegex } from "./PgnViewer";

type CommentsProps = {
	// comments: Accessor<string[] | undefined>;
	currentData: Accessor<Initial | PlyData | undefined>;
	squareHovered?: (square: string | undefined) => void;
};
export const Comments: Component<CommentsProps> = ({ currentData, squareHovered }) => {

	const comments = () => {
		const data = currentData();
		if (!isPlyData(data)) {
			return;
		}
		return data.comments;
	};

	const paragraphs = () => (comments() || []).map((line, index) => {
		const matches = line.match(squareRegex);

		if (matches) {
			matches.forEach((match) => {
				line = line.replace(match, `<span class="square" data-square="${match}">${match}</span>`);
			});
		}

		return <p innerHTML={line} />;
	});

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
		class="pgnviewer-comments">{paragraphs()}</div>;

};
