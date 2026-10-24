// Turning a recognized board (fenshot) into a position the app can use.

import { Chess, Color } from "chessops";
import { parseFen } from "chessops/fen";
import { placementToFen, resolveOrientation } from "@scoriiu/fenshot";

export type ScanRead = {
    /** FEN board field, read white-at-bottom */
    placement: string;
    reliable: boolean;
    minConfidence: number;
};

export type ScannedPosition = {
    fen: string;
    /** The side at the bottom of the picture */
    orientation: Color;
    /** Can be analysed and played as is */
    legal: boolean;
    /** What to check before trusting the position */
    warnings: string[];
};

/**
 * The position in a scan, flipped if the picture was from Black's side. A screenshot does not
 * say whose move it is: by default the side at the bottom, as in diagrams and puzzles.
 */
export function scannedPosition(read: ScanRead, turn?: Color): ScannedPosition {
    const { placement, orientation } = resolveOrientation(read.placement);
    const side: Color = orientation === "black" ? "black" : "white";
    const fen = placementToFen(
        placement,
        (turn ?? side) === "white" ? "w" : "b",
    );
    const warnings: string[] = [];
    if (!read.reliable) {
        warnings.push(
            "Some squares were hard to read: check the position before using it.",
        );
    }
    const setup = parseFen(fen);
    const position = setup.isOk ? Chess.fromSetup(setup.value) : undefined;
    const legal = !!position?.isOk;
    if (!legal) {
        warnings.push(
            "This is not a legal position yet (a king missing, or the side not to move in check): fix it in the editor.",
        );
    }
    return { fen, orientation: side, legal, warnings };
}
