import { ParentComponent, Signal } from "solid-js";
import { Portal } from "solid-js/web";

type ModalProps = {
    isOpen: Signal<boolean>;
    onClose?: () => void;
};

const Modal: ParentComponent<ModalProps> = (props) => {

    const onClose = () => {
        props.onClose?.();
        props.isOpen[1](false);
    }

    const classList = () => {
        return {
            "modal": true,
            "is-active": props.isOpen[0](),
            "is-clipped": true,
        }
    }

    return (
        <Portal>
            <div classList={classList()}>
                <div class="modal-background"></div>

                <div class="modal-content">
                    <div class="box">
                        
                        {props.children}
                        <button 
                            onClick={onClose}
                            class="button" aria-label="close">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </Portal>
    );
};

export default Modal;
