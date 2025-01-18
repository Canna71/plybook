import { IconCpu, IconUser, IconUserFilled } from "@tabler/icons-solidjs";
import { Accessor, Component, createMemo, Show, useContext } from "solid-js";
import { GameContext } from "../game/GameContext";
import { Color } from "chessops";
import Editable from "../common/Editable";
import { getPosition } from "../common/utils";
import MaterialWon from "../game/Material";
import "./PlayerName.scss";

const PlayerName: Component<{
    name: Accessor<string>;
    setName: (name: string) => void;
    color: Color;
}> = ({ name, setName, color }) => {
    const {
        editable,
        gameSignal: [game],
        currentPathSignal: [currentPath],
        engineColorSignal: [engineColor],
    } = useContext(GameContext)!;
    const position = createMemo(() => getPosition(game, currentPath));

    return (
        <div class="player-name">
            <Show when={engineColor() === color}>
                <IconCpu />
            </Show>
            <Show when={engineColor() !== color}>
                <Show when={color === "white"}>
                    <IconUserFilled />
                </Show>

                <Show when={color === "black"}>
                    <IconUser />
                </Show>
            </Show>

            <Editable
                initialValue={name()}
                editable={editable}
                onSave={setName}
                focus={false}
            />
            <MaterialWon position={position} color={color} />
        </div>
    );
};

export default PlayerName;
