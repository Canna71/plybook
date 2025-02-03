import { createEffect, createSignal } from "solid-js";

// import { BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';
import GameManager from "../components/game/GameManager";
import { useSearchParams } from "@solidjs/router";
import { IconDeviceFloppy } from "@tabler/icons-solidjs";
import anylogger from "anylogger";
import { saveGameToHistory } from "../storage/fs";
const log = anylogger("play");

const PlayView = () => {
    const [searchParams, _setSearchParams] = useSearchParams();
    const [newPgn, setNewPgn] = createSignal<string | undefined>(undefined);

    createEffect(async () => {
        if (typeof searchParams.fen === "string") {
        } else {
        }
    });

    const canSave = () => {
        return typeof newPgn() === "string";
    }

    const onSave = async () => {
        log.debug("onSave", newPgn()); 
        const pgn = newPgn();
        if (typeof pgn !== "string") {
            return;
        }  
        saveGameToHistory(pgn);
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
                <div class="navbar-item">
                    <button
                        disabled={!canSave()}
                        class="button is-primary"
                        onClick={onSave}
                    >
                        <IconDeviceFloppy />
                        Save
                    </button>
                </div>
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
