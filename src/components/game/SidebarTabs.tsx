import {
    Switch,
    Match,
    createSignal,
    Show,
    useContext,
    createEffect,
} from "solid-js";
import Moves from "./Moves";
import Review from "./Review";
import Explorer from "./Explorer";
import { GameContext } from "./GameContext";
import Button from "../common/Button";
import { IconDeviceAnalytics } from "@tabler/icons-solidjs";

const SidebarTabs = () => {
    const [tab, setTab] = createSignal(0);
    const {
        isReviewing,
        startReview,
        reviewProgress,
        isPlayingOnSignal: [isPlayingOn],
    } = useContext(GameContext)!;

    const updateTab = (index: number) => setTab(index);

    createEffect(() => {
        if (isReviewing() && tab() === 0) {
            setTab(1);
        }
    });

    return (
        <div class="sidebar-tabs">
            <div class="tabs">
                <ul class="inline">
                    <li
                        classList={{ "is-active": tab() === 0 }}
                        onClick={() => updateTab(0)}
                    >
                        <a>Moves</a>
                    </li>
                    <Show when={!isPlayingOn()}>
                        <li
                            classList={{ "is-active": tab() === 1 }}
                            onClick={() => updateTab(1)}
                        >
                            <a>Evaluation</a>
                        </li>
                        <li
                            classList={{ "is-active": tab() === 2 }}
                            onClick={() => updateTab(2)}
                        >
                            <a>Explorer</a>
                        </li>
                    </Show>
                </ul>
            </div>
            <div class="tab" classList={{}}>
                <Switch>
                    <Match when={tab() === 0}>
                        <div class="pgnviewer-moves-wrapper">
                            <Moves />
                        </div>
                    </Match>
                    <Match when={tab() === 1}>
                        <Button
                            onClick={startReview}
                            title="Review the game with the selected engine"
                            disabled={isReviewing()}
                        >
                            <IconDeviceAnalytics />
                            Analyze Game
                        </Button>
                        <div class="pgnviewer-moves-wrapper">
                            <Show
                                when={!isReviewing()}
                                fallback={
                                    <div class="review-progress">
                                        <progress
                                            class="progress is-primary is-small"
                                            value={reviewProgress()?.current}
                                            max={reviewProgress()?.total}
                                        />
                                        <span>
                                            Analyzing position{" "}
                                            {reviewProgress()?.current ?? 0} of{" "}
                                            {reviewProgress()?.total ?? 0}…
                                        </span>
                                    </div>
                                }
                            >
                                <Review />
                            </Show>
                        </div>
                    </Match>
                    <Match when={tab() === 2}>
                        <div class="pgnviewer-moves-wrapper">
                            <Explorer />
                        </div>
                    </Match>
                </Switch>
            </div>
        </div>
    );
};

export default SidebarTabs;
