import { createSignal, onMount } from "solid-js";
import PgnViewer from "../chessboard/PgnViewer";
import { BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';
const PgnView = () => {

    const [pgn, setPgn] = createSignal<string | undefined>(undefined);

    onMount(async () => {
        // Load PGN FROM application files using tauri fs plugin
        const pgnText = await readTextFile('testdata/02.pgn', 
            {
            baseDir: BaseDirectory.Resource
        });
        // console.log(pgn);
        setPgn(pgnText);
    });

    return (
        // <div>
            <PgnViewer pgn={pgn} />
        // </div>
    );
}

export default PgnView;