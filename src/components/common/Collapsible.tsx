import { IconChevronRight } from "@tabler/icons-solidjs";
import { Collapse } from "solid-collapse";
import {
    Component,
    createSignal,
    JSX,
    ParentProps,
    splitProps,
} from "solid-js";
import "./Collapsible.scss";

export type CollapsibleProps = {
    title: string;
    collapsed?: boolean;
} & JSX.HTMLAttributes<HTMLElement> &
    ParentProps;

const Collapsible: Component<CollapsibleProps> = (props) => {
    const [isExpanded, setIsExpanded] = createSignal(props.collapsed ?? false);
    const [{ title }, others] = splitProps(props, ["title"]);
    return (
        <section class="CollapseContainer" {...others}>
            <button
                onClick={() => setIsExpanded(!isExpanded())}
                class={`button CollapseHeader ${!isExpanded() ? "CollapseHeaderActive" : ""}`}
            >
                <h4 class="title is-5">{title}</h4>
                <span
                    class={`ChevronButton ${isExpanded() ? "ActiveChevron" : ""}`}
                >
                    <IconChevronRight />
                </span>
            </button>
            <Collapse value={isExpanded()} class="CollapseTransition">
                <div class="CollapseContent">{props.children}</div>
            </Collapse>
        </section>
    );
};

export default Collapsible;
