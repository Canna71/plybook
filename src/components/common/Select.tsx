import { Accessor, JSX, Show, splitProps } from "solid-js";
import { For } from "solid-js/web";
// import styles from './Select.module.scss';

export type Option = {
    value: string;
    label: string;
};

type SelectProps = {
    options: Accessor<Option[]>;
    selectedValue: Accessor<string>;
    setSelectedValue: (value: string) => void;
    placeholder?: string;
    onChange?: (value: string) => void;
} & JSX.HTMLAttributes<HTMLDivElement>;

const Select = (props: SelectProps) => {
    const handleChange = (event: Event) => {
        const target = event.target as HTMLSelectElement;
        const value = target.value;
        props.setSelectedValue(value);
        if (props.onChange) {
            props.onChange(value);
        }
    };

    const [, divProps] = splitProps(props, [
        "options",
        "selectedValue",
        "setSelectedValue",
        "placeholder",
        "onChange",
    ]);

    return (
        <div {...divProps} class="select">
            <select
                // class={styles.selectElement}
                value={props.selectedValue()}
                onChange={handleChange}
            >
                <Show when={props.placeholder}>
                    <option
                        value="___"
                        disabled
                        selected={!props.selectedValue()}
                    >
                        {props.placeholder || "Select option..."}
                    </option>
                </Show>
                <For each={props.options()}>
                    {(option) => (
                        <option
                            value={option.value}
                            selected={option.value === props.selectedValue()}
                        >
                            {option.label}
                        </option>
                    )}
                </For>
            </select>
        </div>
    );
};

export default Select;
