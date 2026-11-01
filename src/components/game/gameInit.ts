// Loading a game into a game manager's context: the game, its starting position and
// description, back to the moves view.

import { batch } from "solid-js";
import { makeFen, parseFen } from "chessops/fen";
import { GameModel } from "../../models/GameModel";
import { makeGame } from "../../models/pgn";
import { GameContextType } from "./GameContext";
import { ViewMode } from "./PgnEditBar";

export function initFromGameModel(
    context: GameContextType,
    gameModel: GameModel,
) {
    const {
        gameSignal: [, setGame],
        viewModeSignal: [, setViewMode],
        descriptionSignal: [, setDescription],
        startingPositionSignal: [, setStartingPosition],
        hintMoveSignal: [, setHintMove],
    } = context;

    batch(() => {
        setGame(gameModel);
        setHintMove(undefined);
        if (gameModel.headers.get("FEN")) {
            const setup = parseFen(gameModel.headers.get("FEN") || "");
            if (setup.isOk) {
                setStartingPosition(makeFen(setup.value));
            }
        }
        setViewMode(ViewMode.MOVES);
        setDescription(gameModel.headers.get("Description") || "");
    });
}

export const updateGameFromPgnString = (
    pgnString: string,
    context: GameContextType,
) => initFromGameModel(context, makeGame(pgnString));
