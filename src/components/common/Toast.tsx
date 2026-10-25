import toast from "solid-toast";

// styled by .rc-toast in styles/_base.scss, so toasts follow the theme; bottom centre, where
// no screen keeps a control (the game navigator sits bottom right, Save top right)
export function makeToast(message: string) {
    toast(message, {
        duration: 3000,
        position: "bottom-center",
        className: "rc-toast",
    });
}

export function makeErrorToast(message: string) {
    toast.error(message, {
        duration: 15000,
        position: "bottom-center",
        className: "rc-toast rc-toast-error",
    });
}
