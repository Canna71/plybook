import { createSignal, onMount } from "solid-js";

// import { BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';
import PgnEditor from "../components/PgnEditor";
const PgnEditView = () => {

    const [pgn, setPgn] = createSignal<string | undefined>(undefined);

    onMount(async () => {
        setPgn('');
    });

    return (
        <PgnEditor pgn={pgn} setPgn={setPgn} />
    );
}

export default PgnEditView;
