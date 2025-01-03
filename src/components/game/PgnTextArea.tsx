// implement a solidjs component that renders a contenteditable div to hold the pgn text

import { Component, createSignal, onCleanup, Signal, useContext } from "solid-js";
import { GameModel } from "../../models/GameModel";
import { Path } from "../../models/pgn";
import { GameContext } from "./GameContext";
import { ViewMode } from "./PgnEditBar";

type PgnTextAreaProps = {
    pgnSignal: Signal<string | undefined>;
};

const PgnTextArea: Component<PgnTextAreaProps> = (props) => {
    // const [pgn, setPgn] = createSignal(props.initialPgn);
    const [pgn, setPgn] = props.pgnSignal;
    // const { viewModeSignal: [viewMode, setViewMode] } = useContext(GameContext)!;
    let div: HTMLTextAreaElement | null = null;

    const onInput = (e: Event) => {
        let value = div!.value;
        value = value.replace(/[“”]/g, "\"");
        setPgn(value);
    };

    // const onSetPgn = () => {
    //     // props.setPgn(div!.innerText.replace(/\n/g, "\r\n"));
    //     let value = div!.value;
    //     value = value.replace(/[“”]/g, "\"");
    //     props.setPgn(value);
    // }

    return (
        <div class="pgn-text-area">
            <textarea ref={div!} onInput={onInput} class="pgn-text">
                {pgn()}
            </textarea>
            {/* <button class="button" onClick={onSetPgn}>Set PGN</button> */}
        </div>
    );
};

export default PgnTextArea;
