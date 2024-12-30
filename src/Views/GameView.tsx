import { createEffect, createSignal } from "solid-js";

// import { BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';
import GameEditor from "../components/game/GameEditor";
import { readDataFile, writeDataFile } from "../storage/fs";
import { useSearchParams } from "@solidjs/router";
import Button from "../components/common/Button";

const GameView = () => {

    const [originalPgn, setOriginalPgn] = createSignal<string | undefined>(undefined);
    const [newPgn, setNewPgn] = createSignal<string | undefined>(undefined);
    const [searchParams, _setSearchParams] = useSearchParams();
    
    createEffect(async () => {
        if(typeof(searchParams.path) === "string") {
            console.log('Reading PGN file', searchParams.path);
            const pgnText = await readDataFile(searchParams.path);
            console.log("pgnText",pgnText);
            setOriginalPgn(pgnText || "[]");
        } else {
            setOriginalPgn("[]");
        }
    });

    const  onSave = async () => {
        const pgnText = newPgn();
        console.log(pgnText);
        if(typeof(searchParams.path) === "string" && pgnText) {
            await writeDataFile(searchParams.path, pgnText);
            // await writeDataFile("test.pgn", pgnText);
        }
    }

    return (
        <>
            <GameEditor pgn={originalPgn} setPgn={setNewPgn} />
            <Button onClick={onSave}>Save PGN</Button>
        </>
    );
}

export default GameView;
