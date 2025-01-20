import { Switch, Match, createSignal } from "solid-js";
import Moves from "./Moves";
import Reveiew from "./Review";
import Review from "./Review";

const SidebarTabs = () => {
    const [tab, setTab] = createSignal(0);

    const updateTab = (index: number) => setTab(index);

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
                        <div class="pgnviewer-moves-wrapper">
                            <Review />
                        </div>
                    </Match>
                </Switch>
            </div>
        </div>
    );
};

export default SidebarTabs;
