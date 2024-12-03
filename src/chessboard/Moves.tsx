import { For, Component } from "solid-js";
import { MoveData, Path, PlyData } from "../models/pgn";

import { Accessor } from "solid-js";
import { Color } from "chessops/types";
import { HierarchicalMoveData } from "./PgnViewer";

export type MovesProps = {
	mainline: Accessor<HierarchicalMoveData[]>;
	currentPath: Accessor<Path | undefined>;
	onPlyClick?: (plyData: PlyData) => void;
};

const Moves: Component<MovesProps> = (props) => {

	const onClick = (e: Event) => {
		// TODO: handle click on variation
		const target = e.target as HTMLElement;
		const color: Color = target.dataset.color as Color;
		const number = target.dataset.number;
		if (!color || !number) {
			return;
		}
		// console.log("clicked", color, number);
		const plyData = props.mainline()[parseInt(number) - 1][color];
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
			{(line) =>
				<>
					<div class="pgnviewer-moveline">
						<div class="pgnviewer-movenumber">{line.number}.</div>
						<div classList={moveClass(line, "white")} data-color="white" data-number={line.number} >{line.white?.fan || "..."}</div>
						<div classList={moveClass(line, "black")} data-color="black" data-number={line.number} >{line.black?.fan || "..."}</div>
					</div>
					<For each={line.variations}>
						{(variation) => <>
							<For each={variation}>
								{(line) =>
									<div class="pgnviewer-variation" data-level={line.level}>
										<div class="pgnviewer-movenumber">{line.number}.</div>
										<div classList={moveClass(line, "white")} data-color="white" data-number={line.number} >{line.white?.fan || "..."}</div>
										<div classList={moveClass(line, "black")} data-color="black" data-number={line.number} >{line.black?.fan || "..."}</div>
									</div>
								}
							</For>
						</>}
					</For>
				</>}
		</For>
	</div>;

	function moveClass(line: MoveData, turn: Color): { [k: string]: boolean | undefined; } | undefined {
		return { ...classList, [turn+`-move`]: true, "current-move": line[turn]?.path === props.currentPath() };
	}
};

export default Moves;
