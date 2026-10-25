// A button that opens a short list of actions (UX overhaul, step 4b), so toolbars keep a few
// buttons in sight and the rest one click away. Closes on choice, Esc, or a click outside.

import {
    createSignal,
    For,
    JSX,
    onCleanup,
    onMount,
    ParentComponent,
    Show,
} from "solid-js";
import "./Menu.scss";

export type MenuItem =
    | {
          label: string;
          icon?: JSX.Element;
          onClick: () => void;
          disabled?: boolean;
          /** A shortcut or a note, shown on the right */
          hint?: string;
      }
    | "separator";

/** The button shows the children (an icon, a label, or both). */
const Menu: ParentComponent<{
    items: MenuItem[];
    title?: string;
    disabled?: boolean;
    /** Open towards the left (for menus at the right edge) */
    alignRight?: boolean;
    /** The trigger holds only an icon: square, like icon buttons */
    iconOnly?: boolean;
}> = (props) => {
    const [open, setOpen] = createSignal(false);
    let root: HTMLDivElement | undefined;

    const onDocument = (e: Event) => {
        if (root && !root.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
        if (open() && e.key === "Escape") setOpen(false);
    };
    onMount(() => {
        document.addEventListener("pointerdown", onDocument);
        document.addEventListener("keydown", onKey);
        onCleanup(() => {
            document.removeEventListener("pointerdown", onDocument);
            document.removeEventListener("keydown", onKey);
        });
    });

    return (
        <div class="rc-menu" ref={root}>
            <button
                class="button rc-menu-trigger"
                classList={{ "is-active": open(), "is-icon": props.iconOnly }}
                title={props.title}
                disabled={props.disabled}
                aria-haspopup="menu"
                aria-expanded={open()}
                onClick={() => setOpen((o) => !o)}
            >
                {props.children}
            </button>
            <Show when={open()}>
                <ul
                    class="rc-menu-list"
                    classList={{ "align-right": props.alignRight }}
                    role="menu"
                >
                    <For each={props.items}>
                        {(item) =>
                            item === "separator" ? (
                                <li
                                    class="rc-menu-separator"
                                    role="separator"
                                />
                            ) : (
                                <li role="none">
                                    <button
                                        role="menuitem"
                                        disabled={item.disabled}
                                        onClick={() => {
                                            setOpen(false);
                                            item.onClick();
                                        }}
                                    >
                                        <span class="rc-menu-icon">
                                            {item.icon}
                                        </span>
                                        <span class="rc-menu-label">
                                            {item.label}
                                        </span>
                                        <Show when={item.hint}>
                                            <span class="rc-menu-hint">
                                                {item.hint}
                                            </span>
                                        </Show>
                                    </button>
                                </li>
                            )
                        }
                    </For>
                </ul>
            </Show>
        </div>
    );
};

export default Menu;
