import { Component } from "solid-js";
import "./ThumbUp.scss";
import { IconThumbUp } from "@tabler/icons-solidjs";

const ThumbUp: Component = () => {
    return (
        <div class="thumbup-container modal-icon">
            <IconThumbUp size={64} class="thumb" />
            <div class="circle-wrap">
                <div class="circle-lg"></div>
            </div>
        </div>
    );
};

export default ThumbUp;
