import { Color } from "chessops";
import { Component, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { isPiece } from "../../models/pgn";

import { getFigurine } from "./figurines";

export const PlyFan: Component<{ san: string; color: Color }> = ({
    san,
    color,
}) => {
    const piece = isPiece(san[0])
        ? color === "white"
            ? san[0].toUpperCase()
            : san[0].toLowerCase()
        : undefined;
    let content = piece ? san.slice(1) : san;
    let promotion: string | undefined;
    // handle promotion
    if (content[2] === "=") {
        promotion = content[3];
        content = content.slice(0, 2);
    }

    return (
        <>
            <Show when={piece}>
                <span class="move-fan-figurine">
                    <Dynamic component={getFigurine(piece!)!} />
                </span>
            </Show>
            <span class="move-fan-content">{content}</span>
            <Show when={promotion}>
                <span class="move-fan-figurine">
                    →
                    <Dynamic component={getFigurine(promotion!)} />
                </span>
            </Show>
        </>
    );
};
