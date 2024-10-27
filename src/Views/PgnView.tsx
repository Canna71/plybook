import { createSignal, onMount } from "solid-js";
import PgnViewer from "../chessboard/PgnViewer";
import { BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';
const PgnView = () => {

    const [pgn, setPgn] = createSignal<string | undefined>(undefined);

    onMount(async () => {
        // Load PGN FROM application files using tauri fs plugin
        const pgn = await readTextFile('testdata/01.pgn', 
            {
            baseDir: BaseDirectory.Resource
        });
        // console.log(pgn);
        setPgn(pgn);
    });

    return (
        <div style="max-width: 60%">
            <PgnViewer pgn={pgn} />
        </div>
    );
}

export default PgnView;