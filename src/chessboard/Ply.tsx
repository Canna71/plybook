import { Color } from "chessops";
import { Component, useContext, createEffect } from "solid-js";
import { DOMElement } from "solid-js/types/jsx.js";
import { HierarchicalMoveData } from "../models/tree";
import { MovesContext } from "./Moves";

type PlyProps = {
	line: HierarchicalMoveData;
	color?: Color;
};

export const Ply: Component<PlyProps> = ({ line, color }) => {

	const turn = color;
	const plyData = color && line[color];
	let ref: HTMLDivElement | undefined;
	const { currentPath, showTooltip, editable } = useContext(MovesContext)!;


	const isCurrent = () => {
		return currentPath() && plyData?.path.equals(currentPath()!);
	};
	const isValid = () => {
		return plyData !== undefined;
	};

	const innerShowTooltip = (e: (MouseEvent & {
		currentTarget: HTMLDivElement;
		target: DOMElement;
	}) | undefined) => {
		if (e) {
			isValid() && !editable() && showTooltip(e.currentTarget, plyData);
		} else {
			showTooltip(undefined, undefined);
		}
	};

	const moveClass = () => {
		return {
			"pgnviewer-move": isValid(),
			[turn + `-move`]: true,
			"current-move": isCurrent()
		};
	};

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
			console.log("TODO: context menu");

		}}
	>{color && line[color]?.fan || "..."}

	</div>

	</>;
};
