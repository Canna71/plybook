// The opening of the line up to the current position (P1.7): "C78 Ruy Lopez: Morphy Defense".

import { Component, Show, useContext } from "solid-js";
import { GameContext } from "./GameContext";
import { openingOfLine } from "../../models/openingdata";

const OpeningName: Component = () => {
    const {
        gameSignal: [game],
        currentPathSignal: [currentPath],
    } = useContext(GameContext)!;

    const opening = () => {
        const g = game();
        let path = currentPath();
        if (!g || !path) return undefined;
        // the positions from the current one back to the first move
        const fens: (string | undefined)[] = [];
        while (!path.empty()) {
            const data = g.dataAt(path);
            fens.unshift(data && "fen" in data ? data.fen : undefined);
            path = path.previous();
        }
        return openingOfLine(fens);
    };

    return (
        <Show when={opening()}>
            {(o) => (
                <p class="opening-name">
                    <strong>{o().eco}</strong> {o().name}
                </p>
            )}
        </Show>
    );
};

export default OpeningName;
