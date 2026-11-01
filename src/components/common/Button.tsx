import { Component, createSignal, JSX, onMount } from "solid-js";

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
    children: JSX.Element;
}

const Button: Component<ButtonProps> = (props) => {
    // icon-only buttons are styled square (_base.scss); CSS can't see text nodes, so check here
    let el: HTMLButtonElement | undefined;
    const [iconOnly, setIconOnly] = createSignal(false);
    onMount(() =>
        setIconOnly(!el?.textContent?.trim() && !!el?.querySelector("svg")),
    );

    return (
        <button
            ref={el}
            {...props}
            class={`button ${props.class || ""}`}
            classList={{ "is-icon": iconOnly() }}
            // an icon says nothing to a screen reader: its title names the button
            aria-label={
                props["aria-label"] ?? (iconOnly() ? props.title : undefined)
            }
        >
            {props.children}
        </button>
    );
};

export default Button;
