import { Accessor, Component, createEffect, createSignal } from "solid-js";
import "./Editable.scss";
import { selectAll } from "./utils";

export type EditableProps = {
    initialValue: string;
    editable: Accessor<boolean>;
    onSave?: (value: string) => void;
    focus?: boolean;
};

const Editable: Component<EditableProps> = (props) => {
    const [value, setValue] = createSignal(props.initialValue);
    let ref: HTMLSpanElement | null = null;

    const handleInput = (e: InputEvent) => {
        const target = e.target as HTMLElement;
        setValue(target.textContent || "");
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLElement).blur();
        }
    };

    createEffect(() => {
        if (props.editable() && props.focus) {
            ref!.focus();
            // select all content
            // const range = document.createRange();
            // const sel = window.getSelection();
            // range.selectNodeContents(ref!);
            // sel?.removeAllRanges();
            // sel?.addRange(range);
            selectAll(ref!);
        }
    });

    return (
        <span
            ref={ref!}
            class="editable-text"
            contentEditable={props.editable()}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onBlur={() => props.onSave?.(value())}
            style={{ "white-space": "nowrap", "overflow-x": "auto" }}
        >
            {props.initialValue}
        </span>
    );
};

export default Editable;