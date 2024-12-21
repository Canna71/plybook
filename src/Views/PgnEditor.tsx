import { createSignal, onMount } from "solid-js";

// import { BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';
import PgnEditor from "../chessboard/PgnEditor";
const PgnEditView = () => {

    const [pgn, setPgn] = createSignal<string | undefined>(undefined);

    onMount(async () => {
        setPgn('');
    });

    return (
        <PgnEditor pgn={pgn} />
    );
}

export default PgnEditView;
