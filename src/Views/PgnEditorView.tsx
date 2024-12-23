import { createSignal, onMount } from "solid-js";

// import { BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';
import PgnEditor from "../components/PgnEditor";
import { BaseDirectory, readTextFile } from "@tauri-apps/plugin-fs";
const PgnEditView = () => {

    const [pgn, setPgn] = createSignal<string | undefined>(undefined);

    onMount(async () => {
        const pgnText = await readTextFile('testdata/02.pgn', 
            {
            baseDir: BaseDirectory.Resource
        });
        // console.log(pgn);
        setPgn(pgnText);
    });

    return (
        <PgnEditor pgn={pgn} setPgn={setPgn} />
    );
}

export default PgnEditView;
