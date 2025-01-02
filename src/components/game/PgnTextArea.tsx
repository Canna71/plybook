// implement a solidjs component that renders a contenteditable div to hold the pgn text

import { Component, createSignal, onCleanup, useContext } from "solid-js";
import { GameModel } from "../../models/GameModel";
import { Path } from "../../models/pgn";
import { GameContext } from "./GameContext";

type PgnTextAreaProps = {
    initialPgn: string;
    setPgn: (pgn: string) => void;
};

const PgnTextArea: Component<PgnTextAreaProps> = (props) => {
    const [pgn, setPgn] = createSignal(props.initialPgn);
    // const [game, setGame] = createSignal<GameModel | undefined>(undefined);
    // const [currentPath, setCurrentPath] = createSignal<Path | undefined>(undefined);

    const onInput = (e: Event) => {
        const target = e.target as HTMLDivElement;
        setPgn(target.innerText);
    };

    return (
        <div>
            <div contentEditable={true} onInput={onInput}>
                {pgn()}
            </div>
            <button onClick={() => props.setPgn(pgn())}>Set PGN</button>
        </div>
    );
};

export default PgnTextArea;
