// solidjs component to display the breadcrumbs of the current path, with each segment being a clickable link

import { sep } from "@tauri-apps/api/path";
import { Accessor, createEffect, createSignal, For } from "solid-js";

type BreadCrumbProps = {
    path: Accessor<string | undefined>;
};

const BreadCrumb = (props: BreadCrumbProps) => {
    // const [segments, setSegments] = createSignal<string[]>([]);


    const segments = () => {
        // returns segments, each with its local name and partial path
        const path = props.path() || '';
        const folders = path.split(sep());
        return folders.map((folder, index) => {
            return (
                {   
                    path: folders.slice(0, index + 1).join(sep()),
                    name: folder
                }
            )
        });
    };

    return (
        <nav class="breadcrumb" aria-label="breadcrumbs">
            <ul>
                <For each={segments()}>
                    {(segment) => (
                        <li>
                            <a href={`/library?path=${segment.path}`}>{segment.name}</a>
                        </li>
                    )}
                </For>
            </ul>
        </nav>
    );
};

export default BreadCrumb;