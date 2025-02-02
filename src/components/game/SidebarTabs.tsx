import { Switch, Match, createSignal, Show, useContext, createEffect } from "solid-js";
import Moves from "./Moves";
import Review from "./Review";
import { GameContext } from "./GameContext";
import Button from "../common/Button";

const SidebarTabs = () => {
    const [tab, setTab] = createSignal(0);
    const { isReviewing, startReview } = useContext(GameContext)!;

    const updateTab = (index: number) => setTab(index);


    createEffect(() => {
        if(isReviewing() && tab() === 0) {
            setTab(1);
        }
    });

    const reviewGame = () => {
        startReview();
    };


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
                    <li
                        classList={{ "is-active": tab() === 1 }}
                        onClick={() => updateTab(1)}
                    >
                        <a>Evaluation</a>
                    </li>
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
                            <Button onClick={reviewGame} title="Review Game">
                                Review
                            </Button>
                        <div class="pgnviewer-moves-wrapper">
                            <Show when={!isReviewing()} fallback={<div>Analizing...</div>}>
                                <Review />
                            </Show>
                        </div>
                    </Match>
                </Switch>
            </div>
        </div>
    );
};

export default SidebarTabs;
