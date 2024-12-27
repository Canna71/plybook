import { createEffect, createSignal, onMount } from "solid-js";

// import { BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';
import PgnEditor from "../components/pgn/PgnEditor";
import { readDataFile, writeDataFile } from "../storage/fs";
import { useSearchParams } from "@solidjs/router";
import Button from "../components/common/Button";

const PgnEditView = () => {

    const [pgn, setPgn] = createSignal<string | undefined>(undefined);
    const [searchParams, _setSearchParams] = useSearchParams();
    
    createEffect(async () => {
        if(typeof(searchParams.path) === "string") {
            console.log('Reading PGN file', searchParams.path);
            const pgnText = await readDataFile(searchParams.path);
            console.log("pgnText",pgnText);
            setPgn(pgnText || "[]");
        } else {
            setPgn("[]");
        }

    
    });

    const  onSave = async () => {
        console.log(pgn());
        const pgnText = pgn();
        if(typeof(searchParams.path) === "string" && pgnText) {
            await writeDataFile(searchParams.path, pgnText);
            // await writeDataFile("test.pgn", pgnText);
        }
    }

    return (
        <>
            <PgnEditor pgn={pgn} setPgn={setPgn} />
            <Button onClick={onSave}>Save PGN</Button>
        </>
    );
}

export default PgnEditView;
