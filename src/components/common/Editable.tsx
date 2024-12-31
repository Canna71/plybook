import { Accessor, Component, createSignal } from "solid-js";
import "./Editable.scss";

export type EditableProps = {
    initialValue: string;
    editable: Accessor<boolean>;
    onSave?: (value: string) => void;
};

const Editable: Component<EditableProps> = (props) => {
    const [value, setValue] = createSignal(props.initialValue);

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

    return (
        <span
            class="editable-text"
            contentEditable={props.editable()}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onBlur={() => props.onSave?.(value())}
            style={{ "white-space": "nowrap" }}
        >
            {props.initialValue}
        </span>
    );
};

export default Editable;