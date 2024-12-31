import { batch, createEffect, createSignal } from "solid-js";
import { save } from "@tauri-apps/plugin-dialog";
// import { BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';
import GameManager from "../components/game/GameManager";
import { readDataFile, writeDataFile } from "../storage/fs";
import { useLocation, useSearchParams } from "@solidjs/router";
import Button from "../components/common/Button";
import { IconDeviceFloppy } from "@tabler/icons-solidjs";

const GameView = () => {
    const [originalPgn, setOriginalPgn] = createSignal<string | undefined>(
        undefined,
    );
    const [newPgn, setNewPgn] = createSignal<string | undefined>(undefined);
    const [modified, setModified] = createSignal(false);
    const [searchParams, _setSearchParams] = useSearchParams();
    const location = useLocation();

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

    const isEngineOn = () => {
        return location.pathname === "/analysis";
    };

    const canSave = () => modified();

    const onSave = async () => {
        const pgnText = newPgn();
        console.log(pgnText);
        if (pgnText) {
            if (typeof searchParams.path === "string") {
                await writeDataFile(searchParams.path, pgnText);
                // await writeDataFile("test.pgn", pgnText);
                setModified(false);
            } else {
                const path = await save({
                    filters: [
                        {
                            name: "PGN File",
                            extensions: ["pgn"],
                        },
                    ],
                });
                path && (await writeDataFile(path, pgnText));
                path && setModified(false);
            }
        }
    };

    return (
        <>
            <nav class="game-header buttons are-small" role="navigation">
                
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
                pgn={originalPgn}
                setPgn={setNewPgn}
                defaultEngineOn={isEngineOn()}
            />
        </>
    );
};

export default GameView;
