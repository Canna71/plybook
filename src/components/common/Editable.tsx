import { Accessor, Component, createEffect, createSignal } from "solid-js";
import "./Editable.scss";
import { selectAll } from "./editing";

export type EditableProps = {
    initialValue: string;
    editable: Accessor<boolean>;
    onSave?: (value: string) => void;
    focus?: boolean;
};

const Editable: Component<EditableProps> = (props) => {
    const [value, setValue] = createSignal(props.initialValue);
    // saved only when changed: a click in and out leaves the game unmodified
    let saved = props.initialValue;
    const save = () => {
        if (value() === saved) return;
        saved = value();
        props.onSave?.(saved);
    };
    // eslint-disable-next-line prefer-const -- assigned by Solid via ref={...}
    let ref: HTMLSpanElement | null = null;

    const handleInput = (e: InputEvent) => {
        const target = e.target as HTMLElement;
        setValue(target.textContent || "");
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLElement).blur();
        } else if (e.key === "Escape") {
            // keep the name it had
            e.preventDefault();
            setValue(saved);
            ref!.textContent = saved;
            ref!.blur();
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
            role={props.editable() ? "textbox" : undefined}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onBlur={save}
            style={{ "white-space": "nowrap", "overflow-x": "auto" }}
        >
            {props.initialValue}
        </span>
    );
};

export default Editable;
