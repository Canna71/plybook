// A screen's header (UX overhaul, step 2): its title, what it is for, and its main actions on
// the right. Every screen starts the same way.

import { JSX, ParentComponent, Show } from "solid-js";
import "./PageHeader.scss";

const PageHeader: ParentComponent<{
    title: string;
    description?: JSX.Element;
}> = (props) => (
    <header class="page-header">
        <div class="page-header-text">
            <h1>{props.title}</h1>
            <Show when={props.description}>
                <p>{props.description}</p>
            </Show>
        </div>
        <Show when={props.children}>
            <div class="page-header-actions">{props.children}</div>
        </Show>
    </header>
);

export default PageHeader;
