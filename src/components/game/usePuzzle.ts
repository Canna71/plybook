// Puzzle mode of the game manager (a puzzle is a game whose main line is the solution): checks
// the moves played against it, plays the opponent's replies, counts hints and retries, and
// tells the training frame how it goes.

import { Accessor, createEffect, createSignal, on, Setter } from "solid-js";
import { Color } from "chessground/types";
import { NormalMove, Position } from "chessops";
import anylogger from "anylogger";
import { GameModel } from "../../models/GameModel";
import { Path } from "../../models/pgn";
import { moveEquals } from "../common/utils";
import { HintType } from "./GameContext";
import { TrainerStatus } from "./TrainerPanel";
const log = anylogger("puzzle");

export type PuzzleOptions = {
    isPuzzleMode: Accessor<boolean>;
    game: Accessor<GameModel | undefined>;
    /** The path shown, memoized so an equal path does not count as a change */
    path: Accessor<Path | undefined>;
    setPath: Setter<Path | undefined>;
    position: Accessor<Position>;
    turn: Accessor<Color>;
    /** The solver's side */
    orientation: Accessor<Color>;
    applyMove: (move: NormalMove) => void;
    hintType: Accessor<HintType>;
    setHintType: Setter<HintType>;
    setHintMove: (uci: string | undefined) => void;
    /** Changes with every new puzzle, which starts the frame afresh */
    puzzle: Accessor<unknown>;
    onFinished?: (solved: boolean, hintUsed: number, retries: number) => void;
};

export function usePuzzle(o: PuzzleOptions) {
    const [hintUsed, setHintUsed] = createSignal(0);
    const [retries, setRetries] = createSignal(0);
    // the training frame: right moves so far, and whether it's solved
    const [goodMoves, setGoodMoves] = createSignal(0);
    const [solved, setSolved] = createSignal(false);
    const [wrongMove, setWrongMove] = createSignal<NormalMove | undefined>(
        undefined,
    );

    const status = (): TrainerStatus =>
        solved()
            ? "solved"
            : wrongMove()
              ? "wrong"
              : goodMoves() > 0
                ? "good"
                : "solving";

    /** Whether `move` is in the solution; a wrong move ends the attempt. Always true outside
     * puzzles. */
    const checkMove = (move: NormalMove) => {
        if (!o.isPuzzleMode()) return true;
        const pos = o.position();
        const node = o.game()!.nodeAt(o.path()!)!;
        const right = node.children.some((n) =>
            moveEquals(pos, n.data.move as NormalMove, move),
        );
        if (!right) {
            o.onFinished?.(false, hintUsed(), retries());
            setWrongMove(move);
            o.setHintMove(undefined);
            return false;
        }
        setGoodMoves((n) => n + 1);
        return true;
    };

    /** Back to the start after a wrong move */
    const reset = () => {
        log.debug("Resetting puzzle");
        if (!o.game()) return;
        o.setPath(Path.root);
        setWrongMove(undefined);
        o.setHintType(HintType.None);
        setRetries((r) => r + 1);
    };

    const finish = () => {
        // solved: the training frame says so (and tracks the performance)
        o.onFinished?.(true, hintUsed(), retries());
        setSolved(true);
    };

    // at every move: the opponent's reply is played, the solver's next move is the hint
    createEffect(() => {
        const path = o.path();
        if (!o.isPuzzleMode()) return;
        const node = o.game()?.nodeAt(path!);
        if (!node) return;
        const next = node.children[0];
        if (o.turn() !== o.orientation()) {
            if (next) o.applyMove(next.data.move as NormalMove);
            else finish();
        } else {
            o.setHintMove(next?.data.uci);
            if (!next) finish();
        }
    });

    // the next puzzle starts the frame afresh
    createEffect(
        on(o.puzzle, () => {
            setGoodMoves(0);
            setSolved(false);
            setRetries(0);
            setHintUsed(0);
        }),
    );

    createEffect(() => {
        const hint = o.hintType();
        if (hint === HintType.Piece) setHintUsed((h) => h + 0.5);
        else if (hint === HintType.Move) setHintUsed((h) => h + 1);
    });

    return { wrongMove, solved, status, checkMove, reset };
}
