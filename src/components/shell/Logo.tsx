// The Plybook mark inside the app (F.7): the app icon's tile (tools/logo/icon.svg) drawn in the
// app's own accent colour, so it follows the theme and the accent the user picks. The mark is
// the original two knights with a rook between them (tools/Logo.svg), in white.

import { Component } from "solid-js";
import mark from "../../assets/logo-mark.svg?raw";
import "./Logo.scss";

const Logo: Component<{ size?: number }> = (props) => (
    <span
        class="app-logo"
        style={{ "--app-logo-size": `${props.size ?? 28}px` }}
        aria-hidden="true"
        // our own asset, bundled: not user content
        innerHTML={mark}
    />
);

export default Logo;
