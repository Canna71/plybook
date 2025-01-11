import {
    Accessor,
    batch,
    createSignal,
    Setter,
    Show,
    useContext,
} from "solid-js";
import { GameContext } from "./GameContext";

import "./EngineControl.scss";
import {
    IconCpu,
    IconPlayerPlayFilled,
    IconPlayerStopFilled,
} from "@tabler/icons-solidjs";
import ToggleSwitch from "../common/ToggleSwitch";
import { ViewMode } from "./PgnEditBar";
import Select from "../common/Select";
import { Color } from "chessops";
import Button from "../common/Button";
import { getDefaultStudyContent } from "../../storage/fs";
import { range } from "es-toolkit";
import { makeGame } from "../../models/pgn";
import { getSettingValue, setSettingValue } from "../../models/settings";

const EngineControl = () => {
    const {
        playingEngine,
        gameSignal: [game, setGame],
        engineAnalysisOnSignal,
        engineLevelSignal: [engineLevel, setEngineLevel],
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

    const engineSkillLevels = () => {
        // return all stockfish levels

        const elos = range(1000, 3000, 100).map((elo) => {
            return {
                key: elo.toString(),
                value: elo.toString(),
            };
        });

        return elos;
    };

    const toggleGame = () => {
        if (engineColor()) {
            batch(() => {
                setEngineColor(undefined);
                setGame(makeGame("[]"));
            });
        } else {
            let c = internalColor();
            if (c === "random") {
                // choose a random color
                c = Math.random() > 0.5 ? "white" : "black";
            }
            batch(() => {
                const engineColorTitleCase =
                    c.charAt(0).toUpperCase() + c.slice(1);

                const playerColor = c === "white" ? "Black" : "White";

                const newGame = makeGame("[]").updateHeaders(
                    new Map([
                        [engineColorTitleCase, "Engine"],
                        [playerColor, "Player"],
                    ]),
                );
                // console.log("New game", newGame);
                setGame(newGame);
                setEngineColor(c);
                setInternalColor(c);
                // setFullPgn(getDefaultStudyContent());
            });
        }
    };

    // const engineLevelSelected = (level: string) => {
    //     setEngineLevel(parseInt(level));
    // };

    // const engineLevelString = () => {
    //     const level = engineLevel();
    //     return "" + level;
    // };

    // const onEngineLevelChange = (e: Event) => {
    //     const target = e.target as HTMLInputElement;
    //     const level = parseInt(target.value);
    //     setEngineLevel(level);
    // }

    return (
        <div class="engine-control">
            <div class="engine-control-row">
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
                    <div title="Engine Color">
                        <IconCpu />
                        <Select
                            selectedValue={internalColor}
                            setSelectedValue={
                                setInternalColor as Setter<string>
                            }
                            options={engineColors}
                        />
                    </div>
                    <Show when={!!engineColor()}>
                        <Button onClick={toggleGame} title="Stop Game">
                            <IconPlayerStopFilled />
                        </Button>
                    </Show>
                    <Show when={!engineColor()}>
                        <Button onClick={toggleGame} title="New Game">
                            <IconPlayerPlayFilled />
                        </Button>
                    </Show>
                    {/* <Select
                    selectedValue={engineLevelString}
                    setSelectedValue={engineLevelSelected as Setter<string>}
                    options={engineSkillLevels}
                /> */}
                </Show>
            </div>

            <Show when={playingEngine()}>
                <div class="engine-control-row">
                    ELO: <EngineLevel
                        engineLevel={engineLevel}
                        setEngineLevel={setEngineLevel}
                    />
                </div>
                <div class="engine-control-row">
                    Depth: <DepthLevel
                        
                    />
                </div>
            </Show>
        </div>
    );
};

const EngineLevel = (props: {
    engineLevel: Accessor<number>;
    setEngineLevel: (level: number) => void;
}) => {
    const onEngineLevelChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const level = parseInt(target.value);
        console.log("Level", level);
        props.setEngineLevel(level);
    };

    return (
        <div class="slide-container">
            <input
                type="range"
                min={100}
                max={3200}
                step={100}
                onchange={onEngineLevelChange}
                value={props.engineLevel()}
            />
            <span class="slide-value">{props.engineLevel()}</span>
        </div>
    );
};

const DepthLevel = (props: {
   
}) => {
    const onDepthLevelChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const level = parseInt(target.value);
        console.log("Level", level);
        setSettingValue("engine.playing.depth", level);
    };

    const depth = () => {
        return getSettingValue("engine.playing.depth", 20);
    }

    return (
        <div class="slide-container">
            <input
                type="range"
                min={1}
                max={100}
                step={1}
                onchange={onDepthLevelChange}
                value={depth()}
            />
            <span class="slide-value">{depth()}</span>
        </div>
    );
};

export default EngineControl;
