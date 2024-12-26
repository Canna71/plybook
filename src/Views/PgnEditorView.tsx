import { createEffect, createSignal, onMount } from "solid-js";

// import { BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';
import PgnEditor from "../components/pgn/PgnEditor";
import { readDataFile } from "../storage/fs";
import { useSearchParams } from "@solidjs/router";

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
        // const pgnText = await readTextFile('testdata/02.pgn', 
        //     {
        //     baseDir: BaseDirectory.Resource
        // });
        // const pgnText = await readDataFile('testdata/02.pgn');
        // console.log(pgnText);
        // setPgn(pgnText || "[]");

        // get the AppData directory
    
    });

    return (
        <PgnEditor pgn={pgn} setPgn={setPgn} />
    );
}

export default PgnEditView;
