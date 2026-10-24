import "solid-js";

declare module "solid-js" {
    namespace JSX {
        interface IntrinsicElements {
            piece: JSX.HTMLAttributes<HTMLDivElement>;
        }
    }
}
declare module "*.scss" {
    const content: { [className: string]: string };

    export default content;
}
