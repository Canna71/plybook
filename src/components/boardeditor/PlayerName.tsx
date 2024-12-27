import { IconUser, IconUserFilled } from "@tabler/icons-solidjs";
import { Accessor, Component, Show, useContext } from "solid-js";
import { GameContext } from "../game/GameContext";
import { Color } from "chessops";

const PlayerName: Component<{ name: Accessor<string>, setName: (name: string) => void, color: Color }> = ({ name, setName, color }) => {
    
    const { editable } = useContext(GameContext)!;
    
    return (
        <div class="is-flex is-flex-direction-row is-align-items-center pgnviewer-player-name is-fullwidth m-2">
            <Show when={color === "white"}>
                <IconUserFilled />
            </Show>

            <Show when={color === "black"}>
                <IconUser />
            </Show>


            <div class="is-size-6 p-1 is-flex-grow-1"
                contentEditable={editable()}
                onChange={(e) => setName(e.currentTarget.textContent || "")}
            >{name()}</div>
        </div>

    );
}

export default PlayerName;