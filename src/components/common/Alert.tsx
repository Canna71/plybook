import { createSignal } from "solid-js";
import { Portal, render } from "solid-js/web";
import Modal from "./Modal";
import FailureIcon from "./FailureIcon";
import SuccessIcon from "./SuccessIcon";
import ThumbUp from "./ThumbUp";

export type AlertProps = {
    icon?: string;
    title?: string;
    message?: string;
};

export function showAlert(props: AlertProps) {
    const state = { dispose: () => {} };
    const renderRoot = document.createElement("div");

    const icon = (icon?: string) => {
        switch (icon) {
            case "success":
                return <SuccessIcon />;
            case "thumbup":
                return <ThumbUp />;
            case "failure":
                return <FailureIcon />;
                break;
        }
    };

    state.dispose = render(
        () => (
            <Modal
                icon={icon(props.icon)}
                isOpen={createSignal(true)}
                onClose={() => state.dispose()}
                title={props.title ? () => props.title! : undefined}
            >
                <div>{props.message}</div>
            </Modal>
        ),
        renderRoot,
    );
}
