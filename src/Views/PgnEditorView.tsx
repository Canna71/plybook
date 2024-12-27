import { createEffect, createSignal, onMount } from "solid-js";

// import { BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';
import PgnEditor from "../components/pgn/PgnEditor";
import { readDataFile } from "../storage/fs";
import { useSearchParams } from "@solidjs/router";
import Button from "../components/common/Button";

const PgnEditView = () => {

    const [pgn, setPgn] = createSignal<string | undefined>(undefined);
    const [searchParams, _setSearchParams] = useSearchParams();
    
    createEffect(async () => {
        console.log('PgnEditView Mounted', searchParams.path, searchParams.source);
        if(typeof(searchParams.path) === "string") {
            const pgnText = await readDataFile(searchParams.path);
            setPgn(pgnText || "[]");
        } else {
            setPgn("[]");
        }

    
    });

    return (
        <>
            <PgnEditor pgn={pgn} setPgn={setPgn} />
            <Button onClick={() => console.log(pgn())}>Show PGN</Button>
        </>
    );
}

export default PgnEditView;
