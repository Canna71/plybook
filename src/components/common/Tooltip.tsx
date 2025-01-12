import { ReferenceElement } from "@floating-ui/dom";
import { Color, NormalMove } from "chessops";
import { useFloating } from "solid-floating-ui";
import { Accessor, Component, createSignal } from "solid-js";
import { PlyData, toMove } from "../../models/pgn";
import { Config } from "chessground/config";
import { Chessboard } from "./chessboard";

type TooltipProps = {
	plyData: Accessor<PlyData | undefined>;
	reference: Accessor<ReferenceElement | null | undefined>;
	orientation?: Accessor<Color>;
};

export const Tooltip: Component<TooltipProps> = ({ plyData, reference, orientation }) => {
	const [floating, setFloating] = createSignal<HTMLElement>();
	// See: https://github.com/lxsmnsyc/solid-floating-ui
	// And: https://floating-ui.com/docs/tutorial
	const position = useFloating(reference, floating);

	const config = ():Config => {
		return {
			viewOnly: true,
			fen: plyData()?.fen,
			lastMove: toMove(plyData()?.move as NormalMove),
			orientation: orientation?.(),
		};
	}

	return <div
		class="pgnviewer-tooltip box"
		ref={setFloating}
		style={{
			position: position.strategy,
			top: `${position.y ?? 0}px`,
			left: `${position.x ?? 0}px`,
		}}
	>
		<Chessboard config={config} />
	</div>;
};
