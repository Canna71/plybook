import toast from "solid-toast";

// TODO: take style from CSS...
export function makeToast(message: string) {
    toast(message, {
        duration: 2000,

        position: "top-right",
        style: {
            "background-color": "hsl(171, 100%, 41%)",
            color: "black",
        },
    });
}
