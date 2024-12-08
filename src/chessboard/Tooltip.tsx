import { ReferenceElement } from "@floating-ui/dom";
import { NormalMove } from "chessops";
import { useFloating } from "solid-floating-ui";
import { Accessor, Component, createSignal } from "solid-js";
import { PlyData, toMove } from "../models/pgn";

type TooltipProps = {
	plyData: Accessor<PlyData | undefined>;
	reference: Accessor<ReferenceElement | null | undefined>;
};

export const Tooltip: Component<TooltipProps> = ({ plyData, reference }) => {
	const [floating, setFloating] = createSignal<HTMLElement>();
	// See: https://github.com/lxsmnsyc/solid-floating-ui
	// And: https://floating-ui.com/docs/tutorial
	const position = useFloating(reference, floating);
	return <div
		class="pgnviewer-tooltip"
		ref={setFloating}
		style={{
			position: position.strategy,
			top: `${position.y ?? 0}px`,
			left: `${position.x ?? 0}px`,
		}}
	>
		Tooltip
		FEN: {plyData()?.fen}
		LastMove: {toMove(plyData()?.move as NormalMove)}
	</div>;
};
