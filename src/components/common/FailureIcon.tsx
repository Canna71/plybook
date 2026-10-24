import { Component } from "solid-js";
import "./FailureIcon.scss";
import { IconMoodSadFilled } from "@tabler/icons-solidjs";

const FailureIcon: Component<{}> = () => {
    return (
        <div>
            <div class="failure-icon modal-icon">
                <IconMoodSadFilled class="sadface" size={64} />
            </div>
        </div>
    );
};

export default FailureIcon;
