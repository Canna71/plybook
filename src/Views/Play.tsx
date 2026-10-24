import { createEffect, createSignal, on } from "solid-js";
import GameManager from "../components/game/GameManager";
import { useSearchParams } from "@solidjs/router";
import { saveHistoryGame } from "../storage/db";

const PlayView = () => {
    const [searchParams, _setSearchParams] = useSearchParams();
    const [newPgn, setNewPgn] = createSignal<string | undefined>(undefined);

    // Saved after every move, so History has the game even if it is left unfinished
    createEffect(
        on(newPgn, (pgn) => {
            if (pgn) saveHistoryGame(pgn);
        }),
    );

    const initialFen = () => {
        if (typeof searchParams.fen === "string") {
            return searchParams.fen;
        }
        return undefined;
    };

    return (
        <>
            <nav class="game-header buttons buttons-bar" role="navigation">
                TODO: | Time Control | Save Game | Draw
            </nav>
            <GameManager
                initialFen={initialFen()}
                playingEngine={true}
                setPgn={setNewPgn}
            />
        </>
    );
};

export default PlayView;
