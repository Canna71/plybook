import { Component, createMemo, For, Show, useContext } from "solid-js";
import { Path } from "../../models/pgn";
import { factsAfterMove, factsToShow } from "../../models/facts";
import { GameContext } from "./GameContext";
import "./PositionFacts.scss";

/** Plain facts about the position (no engine), with the ones the last move created first. */
const PositionFacts: Component = () => {
    const {
        gameSignal: [game],
        currentPathSignal: [currentPath],
    } = useContext(GameContext)!;

    const facts = createMemo(() => {
        const path = currentPath() ?? Path.root;
        const after = game()?.dataAt(path)?.fen;
        if (!after) return [];
        const before = path.empty()
            ? after
            : game()?.dataAt(path.previous())?.fen;
        return factsToShow(factsAfterMove(before ?? after, after));
    });

    return (
        <Show when={facts().length > 0}>
            <ul class="position-facts">
                <For each={facts()}>
                    {(fact) => (
                        <li classList={{ "is-new": fact.isNew }}>
                            {fact.text}
                            <Show when={fact.isNew && !currentPath()?.empty()}>
                                <span class="tag is-warning is-light">new</span>
                            </Show>
                        </li>
                    )}
                </For>
            </ul>
        </Show>
    );
};

export default PositionFacts;
