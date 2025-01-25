import {
    Accessor,
    batch,
    createSignal,
    Setter,
    Show,
    Signal,
    useContext,
} from "solid-js";
import { GameContext, ReviewProgress } from "./GameContext";

import "./EngineControl.scss";
import {
    IconCpu,
    IconPlayerPlayFilled,
    IconPlayerStopFilled,
    IconSettingsFilled,
} from "@tabler/icons-solidjs";
import ToggleSwitch from "../common/ToggleSwitch";
import { ViewMode } from "./PgnEditBar";
import Select from "../common/Select";
import { Color } from "chessops";
import Button from "../common/Button";
import { makeGame } from "../../models/pgn";
import { getSettingValue, setSettingValue } from "../../models/settings";
import Modal from "../common/Modal";

const EngineControl = () => {
    const {
        playingEngine,
        gameSignal: [, setGame],
        engineAnalysisOnSignal,
        engineLevelSignal: [engineLevel, setEngineLevel],
        engineColorSignal: [engineColor, setEngineColor],
        viewModeSignal: [viewMode],
        isEditingDescriptionSignal: [isEditingDescription],
        fullPgnSignal: [],
        startingPositionSignal: [startingPosition],
        // isReviewModeSignal: [isReviewing, setIsReviewing],
        startReview,
        isReviewing,
        reviewProgress
    } = useContext(GameContext)!;

    const [internalColor, setInternalColor] = createSignal<Color | "random">(
        engineColor() || "random",
    );

    const modalSignal = createSignal(false),
        [settingsModalVisible, setSettingsModalVisible] = modalSignal;

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
                value: "random",
                label: "random",
            },
            {
                value: "white",
                label: "White",
            },
            {
                value: "black",
                label: "Black",
            },
        ];
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

                let newGame = makeGame("[]").updateHeaders(
                    new Map([
                        [engineColorTitleCase, "Engine"],
                        [playerColor, "Player"],
                    ]),
                );
                newGame = newGame.withStartingPosition(
                    startingPosition() || "",
                );
                setGame(newGame);
                setEngineColor(c);
                setInternalColor(c);
                // setFullPgn(getDefaultStudyContent());
            });
        }
    };

    const onShowSettingsModal = () => {
        setSettingsModalVisible(true);
    };

    const reviewGame = () => {
        startReview();
    };

    return (
        <>
            <div class="engine-control">
                <div class="engine-control-row">
                    <Show when={canEnableEngine() && !isReviewing()}>
                        <div
                            title="Enable Engine Analysis"
                            class="is-flex is-flex-direction-row"
                        >
                            <IconCpu />
                            <ToggleSwitch
                                toggleSignal={engineAnalysisOnSignal}
                            />
                            <Button
                                onClick={onShowSettingsModal}
                                title="Analysis Settings"
                            >
                                <IconSettingsFilled />
                            </Button>
                            <Button onClick={reviewGame} title="Review Game">
                                Review
                            </Button>
                        </div>
                    </Show>
                    <Show when={isReviewing()}>
                        <ReviewProgressIndicator
                            reviewProgress={reviewProgress}
                        />
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
                        ELO:{" "}
                        <EngineLevel
                            engineLevel={engineLevel}
                            setEngineLevel={setEngineLevel}
                        />
                    </div>
                    <div class="engine-control-row">
                        Depth: <DepthLevel />
                    </div>
                </Show>
            </div>
            <Modal
                isOpen={[settingsModalVisible, setSettingsModalVisible]}
                onClose={() => setSettingsModalVisible(false)}
                title={() => "Analysis Settings"}
            >
                <div>
                    <div>
                        <label>Depth</label>
                        <AnalysisDepthLevel />
                    </div>
                    <div>
                        <label>MultiPV</label>
                        <MultiPVLevel />
                    </div>
                    <div>
                        <label>Arrows</label>
                        <ShowErrorToggle />
                    </div>
                </div>
            </Modal>
        </>
    );
};

const EngineLevel = (props: {
    engineLevel: Accessor<number>;
    setEngineLevel: (level: number) => void;
}) => {
    const onEngineLevelChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const level = parseInt(target.value);
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

const DepthLevel = () => {
    const onDepthLevelChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const level = parseInt(target.value);
        setSettingValue("engine.playing.depth", level);
    };

    const depth = () => {
        return getSettingValue("engine.playing.depth", 20);
    };

    return (
        <div class="slide-container">
            <input
                type="range"
                min={1}
                max={50}
                step={1}
                onchange={onDepthLevelChange}
                value={depth()}
            />
            <span class="slide-value">{depth()}</span>
        </div>
    );
};

const AnalysisDepthLevel = () => {
    const onDepthLevelChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const level = parseInt(target.value);
        setSettingValue("engine.analysis.depth", level);
    };

    const depth = () => {
        return getSettingValue("engine.analysis.depth", 20);
    };

    return (
        <div class="slide-container">
            <input
                type="range"
                min={1}
                max={50}
                step={1}
                onchange={onDepthLevelChange}
                value={depth()}
            />
            <span class="slide-value">{depth()}</span>
        </div>
    );
};

const MultiPVLevel = () => {
    const onMultiPVLevelChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const level = parseInt(target.value);
        setSettingValue("engine.analysis.multipv", level);
    };

    const level = () => {
        return getSettingValue("engine.analysis.multipv", 1);
    };

    return (
        <div class="slide-container">
            <input
                type="range"
                min={1}
                max={10}
                step={1}
                onchange={onMultiPVLevelChange}
                value={level()}
            />
            <span class="slide-value">{level()}</span>
        </div>
    );
};

const ShowErrorToggle = () => {
    const showArrows = () =>
        getSettingValue("engine.analysis.showArrows", false);

    const setShowArrows = (value: boolean) => {
        setSettingValue("engine.analysis.showArrows", value);
    };

    return (
        <ToggleSwitch
            toggleSignal={[showArrows, setShowArrows] as Signal<boolean>}
            labels={["Don't Show Arrows", "Show Arrows"]}
        />
    );
};

const ReviewProgressIndicator = ({reviewProgress}:{reviewProgress: Accessor<ReviewProgress>}) => {
    return (
        <div class="review-progress">
            Reviewing...
            <progress id="file" max={reviewProgress()?.total} value={reviewProgress()?.current}></progress>

        </div>
    );
};

export default EngineControl;
