// A section of the analysis panel (UX overhaul, step 4c): a header that folds it away, and
// remembers whether it was open (setting `layout.panel`, all sections in one object).

import { JSX, ParentComponent, Show } from "solid-js";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-solidjs";
import { getSettingValue, setSettingValue } from "../../models/settings";
import "./PanelSection.scss";

const PANEL_SETTING = "layout.panel";

const openStates = () =>
    getSettingValue<Record<string, boolean>>(PANEL_SETTING, {}) ?? {};

/** Whether a section is open (its own choice, else its default). */
export const isSectionOpen = (id: string, byDefault = true) =>
    openStates()[id] ?? byDefault;

export const setSectionOpen = (id: string, open: boolean) =>
    void setSettingValue(PANEL_SETTING, { ...openStates(), [id]: open });

const PanelSection: ParentComponent<{
    id: string;
    title: string;
    /** Open the first time (default true) */
    defaultOpen?: boolean;
    /** Takes the panel's spare height (the moves) and can't be folded */
    grow?: boolean;
    /** Shown on the right of the header (a count, a status) */
    aside?: JSX.Element;
}> = (props) => {
    const open = () =>
        props.grow || isSectionOpen(props.id, props.defaultOpen ?? true);

    return (
        <section
            class="panel-section"
            classList={{ grow: props.grow, open: open() }}
        >
            <header
                class="panel-section-header"
                classList={{ foldable: !props.grow }}
                onClick={() => !props.grow && setSectionOpen(props.id, !open())}
            >
                <Show when={!props.grow}>
                    {open() ? <IconChevronDown /> : <IconChevronRight />}
                </Show>
                <span class="panel-section-title">{props.title}</span>
                <span class="panel-section-aside">{props.aside}</span>
            </header>
            <Show when={open()}>
                <div class="panel-section-body">{props.children}</div>
            </Show>
        </section>
    );
};

export default PanelSection;
