import { IconCpu, IconUser, IconUserFilled } from "@tabler/icons-solidjs";
import { Accessor, Component, createMemo, Show, useContext } from "solid-js";
import { GameContext } from "../game/GameContext";
import { Color } from "chessops";
import Editable from "../common/Editable";
import { getPosition } from "../common/utils";
import MaterialWon from "../game/Material";
import "./PlayerName.scss";
import { getTheme } from "../../theming/thememanager";

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

    const userIcon = (color: Color) => {
        const theme = getTheme();
        // return icon filled if color is white and theme black, or color is black and theme is white
        const filled = (color === "white" && theme === "dark") || (color === "black" && theme === "light");
        if(filled) return <IconUserFilled />
        else return <IconUser />
    }

    return (
        <div class="player-name">
            <Show when={engineColor() === color}>
                <IconCpu />
            </Show>
            <Show when={engineColor() !== color}>
                {userIcon(color)}
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
