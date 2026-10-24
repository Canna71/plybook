import { Accessor, createContext, Signal } from "solid-js";
import { GameModel } from "../../models/GameModel";
import { Path, PlyData } from "../../models/pgn";
import { ViewMode } from "./PgnEditBar";
import { Color } from "chessops";
import { Evaluation } from "chessops/pgn";

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
    isPlayingOnSignal: Signal<boolean>;
    hintMoveSignal: Signal<string | undefined>;
    playingEngine: Accessor<boolean>;
    highlightedSquaresSignal: Signal<string[]>;
    highlightedMovesSignal: Signal<string[]>;
    editable: Accessor<boolean>;
    isPuzzleMode: Accessor<boolean>;
    hintTypeSignal: Signal<HintType>;
    isReviewing: Accessor<boolean>;
    startReview: () => void;
    reviewProgress: Accessor<ReviewProgress>;
    /** Threat mode: the engine searches the position with the other side to move */
    threatOnSignal: Signal<boolean>;
    /** The null-move position while threat mode is active */
    threatFen: Accessor<string | undefined>;
    /** The position the engine lines belong to */
    analyzedFen: Accessor<string>;
    /** The engine's evaluation (with its best move in `ext`) of a position analysed earlier */
    evaluationAt: (fen: string) => (Evaluation & { ext?: string }) | undefined;
    onGameFinished?: () => void;
}

export const GameContext = createContext<GameContextType>();

export interface TooltipContextType {
    showTooltip: (
        anchor: Element | undefined,
        plyData: PlyData | undefined,
    ) => void;
}

export const TooltipContext = createContext<TooltipContextType>();

export interface ReviewProgress {
    total: number;
    current: number;
}
