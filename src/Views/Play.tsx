import { createEffect, createSignal } from "solid-js";

// import { BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';
import GameManager from "../components/game/GameManager";
import { useSearchParams } from "@solidjs/router";
import { IconDeviceFloppy } from "@tabler/icons-solidjs";
import anylogger from "anylogger";
import { saveGameToHistory } from "../storage/fs";
import { addToHistory } from "../storage/db";
const log = anylogger("play");

const PlayView = () => {
    const [searchParams, _setSearchParams] = useSearchParams();
    const [newPgn, setNewPgn] = createSignal<string | undefined>(undefined);

    createEffect(async () => {
        if (typeof searchParams.fen === "string") {
        } else {
        }
    });

  

    const save = async () => {
        log.debug("onSave", newPgn()); 
        const pgn = newPgn();
        if (typeof pgn !== "string") {
            return;
        }
        addToHistory(pgn);
    }

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
                onGameFinished={save}
            />
        </>
    );
};

export default PlayView;
