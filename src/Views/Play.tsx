import { createEffect } from "solid-js";

// import { BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';
import GameManager from "../components/game/GameManager";
import { useSearchParams } from "@solidjs/router";

const PlayView = () => {
    const [searchParams, _setSearchParams] = useSearchParams();

    createEffect(async () => {
        // TODO: start from searchParams.fen when provided
    });

    const initialFen = () => {
        if (typeof searchParams.fen === "string") {
            return searchParams.fen;
        }
        return undefined;
    };

    return (
        <>
            <div class="playarea-header">
                TODO: | Time Control | Save Game | Load Game
            </div>
            <GameManager initialFen={initialFen()} playingEngine={true} />
        </>
    );
};

export default PlayView;
