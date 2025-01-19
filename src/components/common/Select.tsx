import { Accessor, Setter, Show } from 'solid-js';
import { For } from 'solid-js/web';
// import styles from './Select.module.scss';

export type Option = {
    value: string;
    label: string;
};

type SelectProps = {
    options: Accessor<Option[]>;
    selectedValue: Accessor<string>;
    setSelectedValue: Setter<string>;
    placeholder?: string;
    onChange?: (value: string) => void;
};

const Select = (props: SelectProps) => {
    const handleChange = (event: Event) => {
        const target = event.target as HTMLSelectElement;
        const value = target.value;
        props.setSelectedValue(value);
        if (props.onChange) {
            props.onChange(value);
        }
    };

    return (
        <div class="select">
            <select
                // class={styles.selectElement}
                value={props.selectedValue()}
                onChange={handleChange}
            >
                <Show when={props.placeholder}>
                    <option value="___" disabled selected={!props.selectedValue()}>
                        {props.placeholder || 'Select option...'}
                    </option>
                </Show>
                <For each={props.options()}>
                    {(option) => (
                        <option value={option.value} selected={option.value === props.selectedValue()}>
                            {option.label}
                        </option>
                    )}
                </For>
            </select>
        </div>
    );
};

export default Select;