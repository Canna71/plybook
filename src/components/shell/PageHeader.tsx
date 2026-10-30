// A screen's header (UX overhaul, step 2): its title, what it is for, and its main actions on
// the right. Every screen starts the same way, with a "?" to its part of the user guide (U.5).

import { JSX, ParentComponent, Show } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import { IconHelp } from "@tabler/icons-solidjs";
import { helpRoute } from "../../models/navigation";
import "./PageHeader.scss";

const PageHeader: ParentComponent<{
    title: string;
    description?: JSX.Element;
}> = (props) => {
    const location = useLocation();
    const help = () => helpRoute(location.pathname);
    return (
        <header class="page-header">
            <div class="page-header-text">
                <h1>{props.title}</h1>
                <Show when={props.description}>
                    <p>{props.description}</p>
                </Show>
            </div>
            <div class="page-header-actions">
                {props.children}
                <Show when={help() !== "/help"}>
                    <A
                        class="button is-text page-header-help"
                        href={help()}
                        title="Help for this screen (F1)"
                    >
                        <IconHelp />
                    </A>
                </Show>
            </div>
        </header>
    );
};

export default PageHeader;
