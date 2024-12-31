import { createSignal, onMount } from "solid-js";
import { BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';
import Analysis from "../../components/Analysis";
import GameManager from "../../components/game/GameManager";

/**  @deprecated: Use GameManager instead of Analysis */
const AnalysisView = () => {

    const [pgn, setPgn] = createSignal<string | undefined>(undefined);

    onMount(async () => {
        // Load PGN FROM application files using tauri fs plugin
        const pgn = await readTextFile('testdata/01.pgn', 
            {
            baseDir: BaseDirectory.Resource
        });
        setPgn(pgn);
    });

    return (
        // <div>
            <GameManager pgn={pgn} defaultEngineOn={true} />
        // </div>
    );
}

export default AnalysisView;