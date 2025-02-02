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
import { StartingPositionIcon } from "../common/Icons";

const EngineControl = () => {
    const {
        playingEngine,
        gameSignal: [, setGame],
        engineAnalysisOnSignal,
        engineColorSignal: [engineColor, setEngineColor],
        isPlayingOnSignal: [isPlayingOn, setIsPlayingOn],
        viewModeSignal: [viewMode, setViewMode],
        isEditingDescriptionSignal: [isEditingDescription],
        fullPgnSignal: [],
        startingPositionSignal: [startingPosition],
        // isReviewModeSignal: [isReviewing, setIsReviewing],
        // startReview,
        isReviewing,
        reviewProgress,
    } = useContext(GameContext)!;

    const [internalColor, setInternalColor] = createSignal<Color | "random">(
        engineColor() || "random",
    );

    const settingsModalSignal = createSignal(false),
        [_settingsModalVisible, setSettingsModalVisible] = settingsModalSignal;

    const playSettingsModal = createSignal(false),
        [_playSettingsVisible, setPlaySettingsVisible] = playSettingsModal;

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
        if (isPlayingOn()) {
            batch(() => {
                // setEngineColor(undefined);
                // setGame(makeGame("[]"));
                setIsPlayingOn(false);
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
                        ["Date", new Date().toISOString().split("T")[0]],
                    ]),
                );
                newGame = newGame.withStartingPosition(
                    startingPosition() || "",
                );
                setGame(newGame);
                setEngineColor(c);
                setInternalColor(c);
                setIsPlayingOn(true);
            });
        }
    };

    const onShowSettingsModal = () => {
        setSettingsModalVisible(true);
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
                        <Button
                            onClick={() => setPlaySettingsVisible(true)}
                            title="Playing Settings"
                        >
                            <IconSettingsFilled />
                        </Button>
                        <Show when={isPlayingOn()}>
                            <Button onClick={toggleGame} title="Stop Game">
                                <IconPlayerStopFilled />
                            </Button>
                        </Show>
                        <Show when={!isPlayingOn()}>
                            <Button onClick={toggleGame} title="New Game">
                                <IconPlayerPlayFilled />
                            </Button>
                        </Show>
                        <Show when={viewMode() === ViewMode.MOVES}>
                            <Button
                                onClick={()=>setViewMode(ViewMode.STARTING_POSITION)}
                                title="Change Starting Position"
                            >
                                <StartingPositionIcon />
                            </Button>
                        </Show>
                        {/* <Select
                    selectedValue={engineLevelString}
                    setSelectedValue={engineLevelSelected as Setter<string>}
                    options={engineSkillLevels}
                /> */}
                    </Show>
                </div>
            </div>
            <Modal
                isOpen={playSettingsModal}
                onClose={() => setPlaySettingsVisible(false)}
                title={() => "Playing Settings"}
            >
                <div>
                    <div class="engine-control-row">
                        ELO: <EngineLevel />
                    </div>
                    <div class="engine-control-row">
                        Depth: <DepthLevel />
                    </div>
                    <div class="engine-control-row">
                        Time: <MoveTime />
                    </div>
                    <div class="engine-control-row">
                        Threads: <Threads />
                    </div>
                </div>
            </Modal>
            <Modal
                isOpen={settingsModalSignal}
                onClose={() => setSettingsModalVisible(false)}
                title={() => "Analysis Settings"}
            >
                <div>
                    <div>
                        <label>Depth</label>
                        <AnalysisDepthLevel />
                    </div>
                    <div>
                        <label>Time</label>
                        <AnalysisMoveTime />
                    </div>
                    <div>
                        <label>MultiPV</label>
                        <MultiPVLevel />
                    </div>
                    <div>
                        <label>Arrows</label>
                        <ShowErrorToggle />
                    </div>
                    <div>
                        <label>Threads</label>
                        <Threads />
                    </div>
                </div>
            </Modal>
        </>
    );
};

const EngineLevel = () => {
    const onEngineLevelChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const level = parseInt(target.value);
        setSettingValue("engine.playing.level", level);
    };

    const engineLevel = () => {
        return getSettingValue("engine.playing.level", 1000);
    };

    return (
        <div class="slide-container">
            <input
                type="range"
                min={100}
                max={3200}
                step={100}
                onchange={onEngineLevelChange}
                value={engineLevel()}
            />
            <span class="slide-value">{engineLevel()}</span>
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

const MoveTime = () => {
    const onMoveTimeChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const time = parseInt(target.value);
        setSettingValue("engine.playing.movetime", time);
    };
    const time = () => {
        return getSettingValue("engine.playing.movetime", 1000);
    };
    return (
        <div class="slide-container">
            <input
                type="range"
                min={1000}
                max={120000}
                step={1000}
                onchange={onMoveTimeChange}
                value={time()}
            />
            <span class="slide-value">{time()}</span>
        </div>
    );
};

const Threads = () => {
    const onThreadsChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const threads = parseInt(target.value);
        setSettingValue("engine.threads", threads);
    };

    const threads = () => {
        return getSettingValue("engine.threads", 1);
    };

    return (
        <div class="slide-container">
            <input
                type="range"
                min={1}
                max={16}
                step={1}
                onchange={onThreadsChange}
                value={threads()}
            />
            <span class="slide-value">{threads()}</span>
        </div>
    );
};

const AnalysisMoveTime = () => {
    const onMoveTimeChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const time = parseInt(target.value);
        setSettingValue("engine.analysis.movetime", time);
    };
    const time = () => {
        return getSettingValue("engine.analysis.movetime", 1000);
    };
    return (
        <div class="slide-container">
            <input
                type="range"
                min={1000}
                max={120000}
                step={1000}
                onchange={onMoveTimeChange}
                value={time()}
            />
            <span class="slide-value">{time()}</span>
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

const ReviewProgressIndicator = ({
    reviewProgress,
}: {
    reviewProgress: Accessor<ReviewProgress>;
}) => {
    return (
        <div class="review-progress">
            Reviewing...
            <progress
                id="file"
                max={reviewProgress()?.total}
                value={reviewProgress()?.current}
            ></progress>
        </div>
    );
};

export default EngineControl;
