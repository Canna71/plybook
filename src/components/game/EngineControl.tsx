import { Setter, Show, useContext } from "solid-js";
import { GameContext } from "./GameContext";

import "./EngineControl.scss";
import { IconCpu } from "@tabler/icons-solidjs";
import ToggleSwitch from "../common/ToggleSwitch";
import { ViewMode } from "./PgnEditBar";
import Select from "../common/Select";
import { Color } from "chessops";

const EngineControl = () => {
    const { playingEngine, engineAnalysisOnSignal, engineColorSignal: [engineColor, setEngineColor],
        viewModeSignal: [viewMode], isEditingDescriptionSignal: [isEditingDescription] } = useContext(GameContext)!;

    const handleEngineChange = () => {
        
    };

    const canEnableEngine = () => {
        return (
            viewMode() === ViewMode.MOVES &&
            !isEditingDescription() &&
            !playingEngine()
        );
    };

    const engineColors = () => {
        return [{
                key: "disabled",
                value: "disabled"
            },{
                key: "white",
                value: "White"
            },{
                key: "black",
                value: "Black"
            }];
    }

    const onSelectEngineColor : Setter<string> = (color) => {
        const v = typeof color === "function" ? color(engineColor()||"disabled") : color;

        if (v === "disabled") {
            setEngineColor(undefined);
        } else {
            setEngineColor(color as Color);
        }
    }

    const selectedEngineColor = () => {
        
        return engineColor() || "disabled";
    }

    return (
        <div>
            <Show when={canEnableEngine()}>
                <div title="Enable Engine Analysis" class="is-flex is-flex-direction-row">
                    <IconCpu />
                    <ToggleSwitch toggleSignal={engineAnalysisOnSignal} />
                </div>
            </Show>
            <Show when={playingEngine()}>
                <div>
                   <Select 
                        selectedValue={selectedEngineColor}
                        setSelectedValue={onSelectEngineColor}
                        options={engineColors}
                   />
                </div>
            </Show>
        </div>
    );
};

export default EngineControl;