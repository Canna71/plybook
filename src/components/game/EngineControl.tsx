import { Show, useContext } from "solid-js";
import { GameContext } from "./GameContext";

import "./EngineControl.scss";
import { IconCpu } from "@tabler/icons-solidjs";
import ToggleSwitch from "../common/ToggleSwitch";
import { ViewMode } from "./PgnEditBar";

const EngineControl = () => {
    const { playingEngine, engineAnalysisOnSignal, viewModeSignal: [viewMode], isEditingDescriptionSignal: [isEditingDescription] } = useContext(GameContext)!;

    const handleEngineChange = () => {
        
    };

    const canEnableEngine = () => {
        return (
            viewMode() === ViewMode.MOVES &&
            !isEditingDescription() &&
            !playingEngine()
        );
    };

    return (
        <div>
            <Show when={canEnableEngine()}>
                <div title="Enable Engine Analysis" class="is-flex is-flex-direction-row">
                    <IconCpu />
                    <ToggleSwitch toggleSignal={engineAnalysisOnSignal} />
                </div>
            </Show>
        </div>
    );
};

export default EngineControl;