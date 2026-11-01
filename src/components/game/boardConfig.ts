// The chessground config of the game manager's board: the position shown (or the wrong move
// of a puzzle), who may move, hint squares, and the arrows: a hint, the opponent's threats,
// or the engine's lines.

import { Accessor } from "solid-js";
import { Config } from "chessground/config";
import { Color, Key, SquareClasses } from "chessground/types";
import { makeSquare, NormalMove, parseUci, Position } from "chessops";
import { chessgroundDests } from "chessops/compat";
import { makeFen } from "chessops/fen";
import { DrawShape } from "chessground/draw";
import { EngineInfo } from "../../engine/engineinterfaces";
import { getSettingValue } from "../../models/settings";
import { GameModel } from "../../models/GameModel";
import { Path } from "../../models/pgn";
import { makeArrowShape, makeConfig } from "../common/boardShapes";
import { HintType } from "./GameContext";

export type BoardConfigOptions = {
    game: Accessor<GameModel | undefined>;
    path: Accessor<Path | undefined>;
    position: Accessor<Position>;
    orientation: Accessor<Color>;
    highlightedSquares: Accessor<string[]>;
    highlightedMoves: Accessor<string[]>;
    playingEngine: boolean;
    engineColor: Accessor<Color | undefined>;
    isPuzzleMode: Accessor<boolean>;
    /** A wrong puzzle move, shown on the board until the retry */
    wrongPuzzleMove: Accessor<NormalMove | undefined>;
    hintMove: Accessor<string | undefined>;
    hintType: Accessor<HintType>;
    /** Set while the threat mode shows the opponent's threats */
    threatFen: Accessor<string | undefined>;
    engineInfo: EngineInfo[];
    onMove: (orig: Key, dest: Key) => void;
    onDrawChange: (shapes: DrawShape[]) => void;
};

export function boardConfig(o: BoardConfigOptions): () => Config {
    const base = makeConfig(
        o.game,
        o.path,
        o.highlightedSquares,
        o.highlightedMoves,
        o.orientation,
    );
    return () => {
        const baseConfig = base();
        let pos = o.position();

        const wrong = o.wrongPuzzleMove();
        if (wrong) {
            pos = pos.clone();
            pos.play(wrong);
            baseConfig.fen = makeFen(pos.toSetup(), { epd: false });
        }

        // the side to move moves; against the engine, only when it is not the engine's turn
        let movableColor: Color | undefined = undefined;
        if (o.playingEngine) {
            const engineColor = o.engineColor();
            if (engineColor && pos.turn !== engineColor)
                movableColor = pos.turn;
        } else {
            movableColor = pos.turn;
        }

        const showArrows =
            !o.playingEngine &&
            !o.isPuzzleMode() &&
            getSettingValue("engine.analysis.showArrows", false);
        const shapes = baseConfig.drawable?.shapes || [];

        const hints: SquareClasses = new Map();
        const moveHint = o.hintMove();
        const move = moveHint && (parseUci(moveHint) as NormalMove);
        if (move) {
            const from = makeSquare(move.from);
            const to = makeSquare(move.to);
            if (o.hintType() === HintType.Piece) {
                hints.set(from, "selected");
            } else if (o.hintType() === HintType.Move) {
                hints.set(from, "selected");
                hints.set(to, "selected");
            }
            if (showArrows || (o.isPuzzleMode() && !!wrong)) {
                shapes.push(makeArrowShape(from, to, "black"));
            }
        } else if (o.threatFen()) {
            // the opponent's threats, always shown: they are the point of the mode
            for (const info of o.engineInfo) {
                const move = info.pv && parseUci(info.pv[0]);
                if (move && "from" in move) {
                    shapes.push(
                        makeArrowShape(
                            makeSquare(move.from),
                            makeSquare(move.to),
                            info.multipv === 1 ? "red" : "pink",
                        ),
                    );
                }
            }
        } else if (showArrows) {
            for (const info of o.engineInfo) {
                if (info.pv) {
                    const move = parseUci(info.pv[0]) as NormalMove;
                    shapes.push(
                        makeArrowShape(
                            makeSquare(move.from),
                            makeSquare(move.to),
                            "gray",
                        ),
                    );
                }
            }
        }

        return {
            ...baseConfig,
            highlight: {
                ...baseConfig.highlight,
                custom: hints,
            },
            draggable: {
                enabled: true,
            },
            viewOnly: false,
            turnColor: pos.turn,
            movable: {
                free: false,
                color: movableColor,
                dests: chessgroundDests(pos),
            },
            check: pos.isCheck(),
            events: {
                move: o.onMove,
            },
            drawable: {
                ...baseConfig.drawable,
                shapes,
                eraseOnClick: false,
                onChange: o.onDrawChange,
            },
        };
    };
}
