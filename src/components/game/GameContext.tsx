import { Accessor, createContext, Signal } from "solid-js";
import { GameModel } from "../../models/GameModel";
import { Path, PlyData } from "../../models/pgn";
import { ViewMode } from "./PgnEditBar";
import { Color } from "chessops";



export interface GameContextType {
	// fi?: Accessor<string | undefined>;
	fullPgnSignal: Signal<string | undefined>;
	gameSignal: Signal<GameModel | undefined>;
	currentPathSignal: Signal<Path | undefined>;
	startingPositionSignal: Signal<string | undefined>;
	viewModeSignal: Signal<ViewMode>;
	editPgnSignal: Signal<string | undefined>;
	engineOnSignal: Signal<boolean>;
	descriptionSignal: Signal<string | undefined>;
	isEditingDescriptionSignal: Signal<boolean>;
	gameIndexSignal: Signal<number>;
	orientation: Accessor<Color>;
	// orientationSignal: Signal<Color>;
	engineColor?: Accessor<Color | undefined>;
	platingEngine: Accessor<boolean>;
	setSquareHovered?: (square: string | undefined) => void;
	editable: Accessor<boolean>;
}

export const GameContext = createContext<GameContextType>();

export interface TooltipContextType {
	showTooltip: (anchor: Element | undefined, plyData: PlyData | undefined) => void;
}

export const TooltipContext = createContext<TooltipContextType>();