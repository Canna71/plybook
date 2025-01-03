import { batch, createEffect, createSignal } from "solid-js";
import { save } from "@tauri-apps/plugin-dialog";
// import { BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';
import GameManager from "../components/game/GameManager";
import {
    baseName,
    getDefaultStudyContent,
    NameWithoutExtension,
    readDataFile,
    renameOrCreateDataFile,
    writeDataFile,
} from "../storage/fs";
import { useLocation, useSearchParams } from "@solidjs/router";
import { IconDeviceFloppy } from "@tabler/icons-solidjs";
import "./GameView.scss";
import Editable from "../components/common/Editable";

const GameView = () => {
    const [originalPgn, setOriginalPgn] = createSignal<string | undefined>(
        undefined,
    );
    const [newPgn, setNewPgn] = createSignal<string | undefined>(undefined);
    const [modified, setModified] = createSignal(false);
    const [searchParams, _setSearchParams] = useSearchParams();
    const location = useLocation();

    const displayedName = () => {
        const path = searchParams.path;
        if (path && typeof path === "string") {
            return NameWithoutExtension(baseName(path));
        }
        return "Untitled";
    };

    const filePath = () => {
        if (typeof searchParams.path === "string") {
            return searchParams.path;
        }
        return undefined;
    };

    createEffect(async () => {
        let pgnText = getDefaultStudyContent();
        if (typeof searchParams.path === "string") {
            pgnText = await readDataFile(searchParams.path);
        } else {
        }
        batch(() => {
            setOriginalPgn(pgnText);
            setModified(false);
        });
    });

    createEffect(() => {
        setModified(!!newPgn());
    });

    const isEngineOn = () => {
        return location.pathname === "/analysis";
    };

    const isEditable = () => {
        return !isEngineOn();
    };

    const canSave = () => modified();

    const onSave = async () => {
        const pgnText = newPgn();
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

    const onTitleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        const text = target.innerText;
        if (e.key === "Enter") {
            e.preventDefault(); // This stops the default <br> insertion
            // Optionally blur the element or trigger save

            target.blur();
        }
    };

    const onRename = (text: string) => {
        renameOrCreateDataFile(
            filePath(),
            text,
            newPgn() || getDefaultStudyContent(),
        );
    };

    return (
        <>
            <nav class="game-header buttons are-small" role="navigation">
                <div class="game-name">
                    <Editable
                        editable={isEditable}
                        initialValue={displayedName() || ""}
                        onSave={onRename}
                    ></Editable>
                </div>

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
                editable={isEditable}
                defaultEngineOn={isEngineOn()}
            />
        </>
    );
};

export default GameView;
