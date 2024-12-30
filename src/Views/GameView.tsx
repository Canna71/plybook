import { batch, createEffect, createSignal } from "solid-js";

// import { BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';
import GameManager from "../components/game/GameManager";
import { readDataFile, writeDataFile } from "../storage/fs";
import { useSearchParams } from "@solidjs/router";
import Button from "../components/common/Button";
import { IconDeviceFloppy } from "@tabler/icons-solidjs";

const GameView = () => {
    const [originalPgn, setOriginalPgn] = createSignal<string | undefined>(
        undefined,
    );
    const [newPgn, setNewPgn] = createSignal<string | undefined>(undefined);
    const [modified, setModified] = createSignal(false);
    const [searchParams, _setSearchParams] = useSearchParams();

    createEffect(async () => {
        let pgnText = "[]";
        if (typeof searchParams.path === "string") {
            console.log("Reading PGN file", searchParams.path);
            pgnText = await readDataFile(searchParams.path);
            console.log("pgnText", pgnText);
        } else {
            // setOriginalPgn("[]");
        }
        batch(() => {
            setOriginalPgn(pgnText);
            setModified(false);
        });
    });

    createEffect(() => {
        setModified(!!newPgn());
        console.log("modified", newPgn());
    });

    const canSave = () => modified();

    const onSave = async () => {
        const pgnText = newPgn();
        console.log(pgnText);
        if (typeof searchParams.path === "string" && pgnText) {
            await writeDataFile(searchParams.path, pgnText);
            // await writeDataFile("test.pgn", pgnText);
        }
        setModified(false);
    };

    return (
        <>
            <div class="game-header buttons are-small">
                <button
                    disabled={!canSave()}
                    class="button is-primary"
                    onClick={onSave}
                >
                    <IconDeviceFloppy />
                    Save
                </button>
            </div>
            <GameManager pgn={originalPgn} setPgn={setNewPgn} />
        </>
    );
};

export default GameView;
