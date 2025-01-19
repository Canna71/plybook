import { Accessor, createContext, Signal } from "solid-js";
import { GameModel } from "../../models/GameModel";
import { Path, PlyData } from "../../models/pgn";
import { ViewMode } from "./PgnEditBar";
import { Color } from "chessops";

export enum HintType {
	None,
	Piece,
	Move,
}

export interface GameContextType {
	// fi?: Accessor<string | undefined>;
	fullPgnSignal: Signal<string | undefined>;
	gameSignal: Signal<GameModel | undefined>;
	currentPathSignal: Signal<Path | undefined>;
	startingPositionSignal: Signal<string | undefined>;
	viewModeSignal: Signal<ViewMode>;
	editPgnSignal: Signal<string | undefined>;
	engineAnalysisOnSignal: Signal<boolean>;
	descriptionSignal: Signal<string | undefined>;
	isEditingDescriptionSignal: Signal<boolean>;
	gameIndexSignal: Signal<number>;
	orientation: Accessor<Color>;
	engineColorSignal: Signal<Color | undefined>;
	engineLevelSignal: Signal<number>;
	hintMoveSignal: Signal<string | undefined>;
	playingEngine: Accessor<boolean>;
	highlightedSquaresSignal: Signal<string[]>;
	highlightedMovesSignal: Signal<string[]>;
	editable: Accessor<boolean>;
	isPuzzleMode: Accessor<boolean>;
	hintTypeSignal: Signal<HintType>;
	isReviewModeSignal: Signal<boolean>;
}

export const GameContext = createContext<GameContextType>();

export interface TooltipContextType {
	showTooltip: (anchor: Element | undefined, plyData: PlyData | undefined) => void;
}

export const TooltipContext = createContext<TooltipContextType>();
