import { Accessor, createContext, Setter } from "solid-js";
import { GameModel } from "../../models/GameModel";
import { Path, PlyData } from "../../models/pgn";



export interface GameContextType {
	// game?: () => { initial: { comments: string[] } };
	game: Accessor<GameModel | undefined>;
	setGame: Setter<GameModel | undefined>;
	currentPath: Accessor<Path | undefined>;
	setCurrentPath: Setter<Path | undefined>;
	squareHovered?: (square: string | undefined) => void;
	editable: Accessor<boolean>;
}

export const GameContext = createContext<GameContextType>();

export interface TooltipContextType {
	showTooltip: (anchor: Element | undefined, plyData: PlyData | undefined) => void;
}

export const TooltipContext = createContext<TooltipContextType>();