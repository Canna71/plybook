// Drawing on the board without the right button (U.2): the pen (a plain press draws, D), its
// four colours, undo the last shape and clear the position's shapes. Shift + press draws too.

import { Accessor, Component, For, Show, useContext } from "solid-js";
import { fromCommentShape } from "../common/boardShapes";
import { IconArrowBackUp, IconEraser, IconPencil } from "@tabler/icons-solidjs";
import { GameContext } from "./GameContext";
import { Path } from "../../models/pgn";
import { isPenColour, PEN_COLOURS, PenColour } from "../../models/drawing";
import { getSettingValue, setSettingValue } from "../../models/settings";
import "./DrawBar.scss";

/** The pen's colour, kept in the settings */
export const penColour = (): PenColour => {
    const c = getSettingValue("themes.pen");
    return isPenColour(c) ? c : "green";
};

const DrawBar: Component<{
    penOn: Accessor<boolean>;
    setPenOn: (on: boolean) => void;
}> = (props) => {
    const {
        gameSignal: [game, setGame],
        currentPathSignal: [currentPath],
    } = useContext(GameContext)!;

    /** The arrows and circles saved on the position shown, as chessground shapes */
    const saved = () => {
        const data = game()?.dataAt(currentPath() ?? Path.root);
        return (data?.shapes ?? []).map(fromCommentShape);
    };
    const save = (shapes: ReturnType<typeof saved>) => {
        const g = game();
        if (g) setGame(g.updateShapes(currentPath() ?? Path.root, shapes));
    };

    const pick = (colour: PenColour) => {
        void setSettingValue("themes.pen", colour);
        props.setPenOn(true);
    };

    return (
        <div class="draw-bar">
            <button
                class="draw-pen"
                classList={{ active: props.penOn() }}
                title="Draw arrows and circles with a plain click or drag (D). Shift + drag draws too: + Option blue, + Cmd red, + both yellow"
                aria-pressed={props.penOn()}
                onClick={() => props.setPenOn(!props.penOn())}
            >
                <IconPencil />
            </button>
            <Show when={props.penOn()}>
                <For each={PEN_COLOURS}>
                    {(colour) => (
                        <button
                            class={`draw-colour ${colour}`}
                            classList={{ active: penColour() === colour }}
                            title={`Draw in ${colour}`}
                            aria-label={`Draw in ${colour}`}
                            onClick={() => pick(colour)}
                        />
                    )}
                </For>
            </Show>
            <Show when={saved().length > 0}>
                <button
                    title="Remove the last arrow or circle"
                    onClick={() => save(saved().slice(0, -1))}
                >
                    <IconArrowBackUp />
                </button>
                <button
                    title="Remove all arrows and circles of this position"
                    onClick={() => save([])}
                >
                    <IconEraser />
                </button>
            </Show>
        </div>
    );
};

export default DrawBar;
