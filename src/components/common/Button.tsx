import { Component, createSignal, JSX, onMount } from "solid-js";

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
    // variant?: 'primary' | 'secondary' | 'outline';
    // size?: 'small' | 'medium' | 'large';
    children: JSX.Element;
}

const Button: Component<ButtonProps> = (props) => {
    // const getVariantClasses = () => {
    //     switch (props.variant) {
    //         case 'primary':
    //             return 'bg-blue-600 text-white hover:bg-blue-700';
    //         case 'secondary':
    //             return 'bg-gray-600 text-white hover:bg-gray-700';
    //         case 'outline':
    //             return 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50';
    //         default:
    //             return 'bg-blue-600 text-white hover:bg-blue-700';
    //     }
    // };

    // const getSizeClasses = () => {
    //     switch (props.size) {
    //         case 'small':
    //             return 'px-3 py-1 text-sm';
    //         case 'large':
    //             return 'px-6 py-3 text-lg';
    //         default:
    //             return 'px-4 py-2 text-base';
    //     }
    // };

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
        >
            {props.children}
        </button>
    );
};

export default Button;
