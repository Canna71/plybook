import { batch, createSignal, Setter, Show, useContext } from "solid-js";
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

    const engineLevelSelected = (level: string) => {
        setEngineLevel(parseInt(level));
    };

    const engineLevelString = () => {
        const level = engineLevel();
        return "" + level;
    };

    return (
        <div class="engine-control">
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
                        setSelectedValue={setInternalColor as Setter<string>}
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
                <Select
                    selectedValue={engineLevelString}
                    setSelectedValue={engineLevelSelected as Setter<string>}
                    options={engineSkillLevels}
                />
            </Show>
        </div>
    );
};

export default EngineControl;
