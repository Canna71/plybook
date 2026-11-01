// "Link a YouTube video here" (I.1): a link and a start time become a comment on the move
// shown, which then plays from the comment.

import { Component, createSignal, Show, Signal } from "solid-js";
import Modal from "../common/Modal";
import Button from "../common/Button";
import { parseTime, parseYouTube, videoLink } from "../../models/youtube";

const AttachVideo: Component<{
    open: Signal<boolean>;
    /** Adds the comment to the move shown */
    onAttach: (link: string) => void;
}> = (props) => {
    const [url, setUrl] = createSignal("");
    const [time, setTime] = createSignal("");

    const video = () => {
        const v = parseYouTube(url().trim());
        if (!v) return undefined;
        const start = time().trim() ? parseTime(time()) : v.start;
        return start === undefined ? undefined : { ...v, start };
    };

    const attach = () => {
        const v = video();
        if (!v) return;
        props.onAttach(videoLink(v));
        setUrl("");
        setTime("");
        props.open[1](false);
    };

    return (
        <Modal
            isOpen={props.open}
            onClose={() => props.open[1](false)}
            title={() => "Link a YouTube video to this move"}
        >
            <div class="field">
                <label class="label is-small">Video link</label>
                <input
                    class="input"
                    placeholder="https://www.youtube.com/watch?v=… or https://youtu.be/…"
                    value={url()}
                    onInput={(e) => setUrl(e.currentTarget.value)}
                />
                <Show when={url().trim() && !parseYouTube(url().trim())}>
                    <p class="help is-danger">Not a YouTube video link.</p>
                </Show>
            </div>
            <div class="field">
                <label class="label is-small">
                    Start at (m:ss; empty: the link's own time)
                </label>
                <input
                    class="input"
                    placeholder="2:03"
                    value={time()}
                    onInput={(e) => setTime(e.currentTarget.value)}
                    onKeyDown={(e) => e.key === "Enter" && attach()}
                />
                <Show when={time().trim() && parseTime(time()) === undefined}>
                    <p class="help is-danger">Write the time as m:ss.</p>
                </Show>
            </div>
            <Button class="is-primary" disabled={!video()} onClick={attach}>
                Add to the move
            </Button>
        </Modal>
    );
};

export default AttachVideo;
