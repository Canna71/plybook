import { onMount } from "solid-js";
import PgnViewer from "../chessboard/PgnViewer";
import { BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';
const PgnView = () => {


    onMount(async () => {
        // Load PGN FROM application files using tauri fs plugin
        const pgn = await readTextFile('testdata/01.pgn', 
            {
            baseDir: BaseDirectory.Resource
        });
        console.log(pgn);
    });

    return (
        <div style="max-width: 60%">
            <PgnViewer />
        </div>
    );
}

export default PgnView;