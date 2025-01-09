import { batch, createSignal, Setter, Show, useContext } from "solid-js";
import { GameContext } from "./GameContext";

import "./EngineControl.scss";
import { IconCpu } from "@tabler/icons-solidjs";
import ToggleSwitch from "../common/ToggleSwitch";
import { ViewMode } from "./PgnEditBar";
import Select from "../common/Select";
import { Color } from "chessops";
import Button from "../common/Button";
import { getDefaultStudyContent } from "../../storage/fs";

const EngineControl = () => {
    const {
        playingEngine,
        engineAnalysisOnSignal,
        engineColorSignal: [engineColor, setEngineColor],
        viewModeSignal: [viewMode],
        isEditingDescriptionSignal: [isEditingDescription],
        fullPgnSignal: [fullPgn, setFullPgn],
    } = useContext(GameContext)!;

    const [internalColor, setInternalColor] = createSignal<Color | "random">(
        engineColor() || "random",
    );
    const handleEngineChange = () => {};

    const canEnableEngine = () => {
        return (
            viewMode() === ViewMode.MOVES &&
            !isEditingDescription() &&
            !playingEngine()
        );
    };

    const engineColors = () => {
        return [
            {
                key: "random",
                value: "random",
            },
            {
                key: "white",
                value: "White",
            },
            {
                key: "black",
                value: "Black",
            },
        ];
    };

    const toggleGame = () => {
        if (engineColor()) {
            setEngineColor(undefined);
        } else {
            let c = internalColor();
            if (c === "random") {
                // choose a random color
                c = Math.random() > 0.5 ? "white" : "black";
            }
            batch(() => {
                setEngineColor(c);
                setInternalColor(c);
                setFullPgn(getDefaultStudyContent());
            });
        }
    };

    // const onSelectEngineColor : Setter<string> = (color) => {
    //     const v = typeof color === "function" ? color(engineColor()||"random") : color;

    //         setInternalColor(v);

    // }

    // const selectedEngineColor = () => {

    //     return engineColor() || "disabled";
    // }

    return (
        <div>
            <Show when={canEnableEngine()}>
                <div
                    title="Enable Engine Analysis"
                    class="is-flex is-flex-direction-row"
                >
                    <IconCpu />
                    <ToggleSwitch toggleSignal={engineAnalysisOnSignal} />
                </div>
            </Show>
            <Show when={playingEngine()}>
                <div>
                    <Select
                        selectedValue={internalColor}
                        setSelectedValue={setInternalColor as Setter<string>}
                        options={engineColors}
                    />
                </div>
            </Show>
            <Show when={playingEngine()}>
                <Show when={!!engineColor()}>
                    <Button onClick={toggleGame}>Stop Game</Button>
                </Show>
                <Show when={!engineColor()}>
                    <Button onClick={toggleGame}>New Game</Button>
                </Show>
            </Show>
        </div>
    );
};

export default EngineControl;
