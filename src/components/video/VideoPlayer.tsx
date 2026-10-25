// The YouTube player (I.1): one floating panel for the whole app, opened from a video link in
// a comment. Embedded from youtube-nocookie.com (the only frame source the CSP allows); "Open
// in browser" is the fallback when YouTube refuses to play embedded.

import { createSignal, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { formatTime, Video } from "../../models/youtube";
import { makeErrorToast } from "../common/Toast";
import "./VideoPlayer.scss";

const [video, setVideo] = createSignal<Video>();

/** Plays a video in the floating player (replacing the one playing). */
export const playVideo = (v: Video) => setVideo({ ...v });

const openInBrowser = (v: Video) =>
    invoke("open_youtube", { id: v.id, start: v.start }).catch((err) =>
        makeErrorToast(String(err)),
    );

export const VideoPlayer = () => (
    <Show when={video()} keyed>
        {(v) => (
            <div class="video-player">
                <div class="video-player-bar">
                    <span>Video from {formatTime(v.start)}</span>
                    <button
                        class="button is-small is-text"
                        title="If the video does not play here"
                        onClick={() => openInBrowser(v)}
                    >
                        Open in browser
                    </button>
                    <button
                        class="delete"
                        title="Close the video"
                        onClick={() => setVideo(undefined)}
                    />
                </div>
                <iframe
                    src={`https://www.youtube-nocookie.com/embed/${v.id}?start=${v.start}&autoplay=1&rel=0`}
                    title="YouTube video"
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    referrerpolicy="strict-origin-when-cross-origin"
                    allowfullscreen
                />
            </div>
        )}
    </Show>
);
