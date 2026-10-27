// Moves played on the game manager's board: a legal move is checked (puzzles) and applied, a
// pawn reaching the last rank asks for its piece first, anything else snaps back.

import { Accessor, createSignal, Setter } from "solid-js";
import { Color, Key, Role } from "chessground/types";
import { NormalMove, Position } from "chessops";
import anylogger from "anylogger";
import { GameModel } from "../../models/GameModel";
import { isPromotion, makeMove } from "../common/utils";
const log = anylogger("moveinput");

type Promotion = {
    /** Where the promotion popup opens */
    cell: Key;
    move: NormalMove;
};

export type MoveInputOptions = {
    game: Accessor<GameModel | undefined>;
    setGame: Setter<GameModel | undefined>;
    position: Accessor<Position>;
    /** False to refuse the move (a wrong puzzle move) */
    checkMove: (move: NormalMove) => boolean;
    applyMove: (move: NormalMove) => void;
};

export function useMoveInput(o: MoveInputOptions) {
    const [promotion, setPromotion] = createSignal<Promotion>();

    const onMove = (orig: Key, dest: Key) => {
        const g = o.game();
        if (!g) return;
        const move = makeMove(orig, dest);
        const pos = o.position();
        if (pos.isLegal(move)) {
            if (o.checkMove(move)) o.applyMove(move);
            return;
        }
        if (isPromotion(move, pos)) setPromotion({ cell: dest, move });
        else log.debug("Illegal move");
        // the board shows the game again (the piece goes back until the promotion is chosen)
        o.setGame(g.clone());
    };

    const onPromotionSelected = (role: Role, _color: Color) => {
        const chosen = promotion();
        setPromotion(undefined);
        if (!chosen) return;
        const move = { ...chosen.move, promotion: role };
        if (o.checkMove(move)) o.applyMove(move);
    };

    return { onMove, promotion, onPromotionSelected };
}
