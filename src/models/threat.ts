// "What does the opponent threaten?": the position with the move passed to the other side
// (a null move), searched by the engine like any other.

import { Chess, makeSquare, opposite, parseUci } from "chessops";
import { makeFen, parseFen } from "chessops/fen";
import { makeSan } from "chessops/san";
import { Score } from "../engine/engineinterfaces";

/** The same position with the other side to move, or undefined when that is impossible
 * (the side to move is in check, so passing would leave its king capturable). */
export function nullMoveFen(fen: string): string | undefined {
    const setup = parseFen(fen);
    if (setup.isErr) return undefined;
    const pos = Chess.fromSetup(setup.value);
    if (pos.isErr || pos.value.isCheck()) return undefined;
    const passed = pos.value.toSetup();
    passed.epSquare = undefined;
    if (passed.turn === "black") passed.fullmoves += 1;
    passed.turn = opposite(passed.turn);
    const result = Chess.fromSetup(passed);
    return result.isOk ? makeFen(result.value.toSetup()) : undefined;
}

export type Threat = {
    san: string;
    /** e.g. "Black threatens Nxf3+ (check, takes the knight on f3)" */
    text: string;
};

/**
 * Describes the engine's first move in the null-move position. `score` is from White's point
 * of view, as engine infos are stored.
 */
export function describeThreat(
    passedFen: string,
    pv: string[] | undefined,
    score?: Score,
): Threat | undefined {
    const setup = parseFen(passedFen);
    const pos = setup.isOk ? Chess.fromSetup(setup.value) : undefined;
    const move = pv?.[0] ? parseUci(pv[0]) : undefined;
    if (!pos || pos.isErr || !move || !pos.value.isLegal(move))
        return undefined;

    const position = pos.value;
    const side = position.turn;
    const san = makeSan(position, move);
    const parts: string[] = [];

    const forSide = score && (side === "white" ? score.value : -score.value);
    if (san.endsWith("#")) {
        parts.push("checkmate");
    } else if (score?.type === "mate" && forSide! > 0) {
        parts.push(`mate in ${forSide}`);
    } else if (san.includes("+")) {
        parts.push("check");
    }
    if ("from" in move) {
        const captured = position.board.get(move.to);
        if (captured && captured.color !== side) {
            parts.push(`takes the ${captured.role} on ${makeSquare(move.to)}`);
        }
    }
    const who = side === "white" ? "White" : "Black";
    return {
        san,
        text: `${who} threatens ${san}${parts.length ? ` (${parts.join(", ")})` : ""}`,
    };
}
