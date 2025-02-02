import { Accessor, JSX, ParentComponent, Show, Signal } from "solid-js";
import { Portal } from "solid-js/web";
import SuccessIcon from "./SuccessIcon";
import ThumbUp from "./ThumbUp";
import FailureIcon from "./FailureIcon";

type ModalProps = {
    isOpen: Signal<boolean>;
    onClose?: () => void;
    title?: Accessor<string>;
    icon?: JSX.Element;
};

const Modal: ParentComponent<ModalProps> = (props) => {
    const onClose = () => {
        props.onClose?.();
        // props.isOpen[1](false);
    };

    const classList = () => {
        return {
            modal: true,
            "is-active": props.isOpen[0](),
            "is-clipped": true,
           
        };
    };

   

    return (
        <Portal>
            <div classList={classList()}>
                <div class="modal-background"></div>

                <div class="modal-card animate__animated animate__zoomIn animate__faster">
                    <Show when={props.title || props.icon}>
                        <header class="modal-card-head">
                            {props.icon}
                            {props.title?.()}
                        </header>
                    </Show>
                    <div class="modal-card-body">{props.children}</div>
                    <footer class="modal-card-foot">
                        <div class="buttons is-centered is-fullwidth">
                            <button
                                onClick={onClose}
                                class="button is-primary"
                                aria-label="close"
                            >
                                Close
                            </button>
                        </div>
                    </footer>
                </div>
            </div>
        </Portal>
    );
};

export default Modal;
