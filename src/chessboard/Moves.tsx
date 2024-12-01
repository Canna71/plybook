import { For, Component } from "solid-js";
import { MoveData, Path, PlyData } from "../models/pgn";

import { Accessor } from "solid-js";

export type MovesProps = {
	mainline: Accessor<MoveData[]>;
	currentPath: Accessor<Path | undefined>;
	onPlyClick?: (plyData: PlyData) => void;
};

const Moves: Component<MovesProps> = (props) => {

	const onClick = (e: Event) => {
		const target = e.target as HTMLElement;
		const color = target.dataset.color;
		const number = target.dataset.number;
		if (!color || !number) {
			return;
		}
		// console.log("clicked", color, number);
		const plyData = props.mainline()[parseInt(number) - 1][color === "w" ? "white" : "black"];
		if (!plyData) {
			return;
		}
		// console.log("plyData", plyData);
		if (props.onPlyClick && typeof props.onPlyClick === "function") {
			props.onPlyClick(plyData);
		}
	}

	const classList = {
		"pgnviewer-move": true,
	}

	return <div class="pgnviewer-mainline"
		onClick={onClick}
		>
		<For each={props.mainline()}>
			{(line) => <div class="pgnviewer-moveline">
				<div class="pgnviewer-movenumber">{line.number}.</div>
				<div classList={{...classList, "white-move": true, "current-move": line.white?.path === props.currentPath()}} data-color="w" data-number={line.number} >{line.white?.fan}</div>
				<div classList={{...classList, "black-move": true, "current-move": line.black?.path === props.currentPath()}} data-color="b" data-number={line.number} >{line.black?.fan}</div>
			</div>}
		</For>
	</div>;
};

export default Moves;
