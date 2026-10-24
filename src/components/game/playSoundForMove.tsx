import { NormalMove, squareRank } from "chessops";
import { GameModel } from "../../models/GameModel";
import { Initial, PlyData, Path, isPlyData } from "../../models/pgn";
import { PlayAudioForMove } from "../audio";

export function playSoundForMove(
    ply: Initial | PlyData | undefined,
    path: Path,
    game: GameModel,
) {
    if (isPlyData(ply)) {
        const pos = ply.pos;
        const isCheck = pos.isCheck();
        const isCheckmate = pos.isCheckmate();
        const isSelf = pos.turn === "black"; // self is white

        // determine if move is a capture
        const lastMove = ply.move as NormalMove;
        const previous = path.previous();
        const previousPly = game.dataAt(previous);
        const role = pos.board.get(lastMove.to)?.role;
        const isCastling =
            role === "king" &&
            Math.abs(squareRank(lastMove.to) - squareRank(lastMove.from)) === 2;
        const isCapture = previousPly?.pos.board.has(lastMove.to) || false;
        const flags = {
            isCapture,
            isCheck,
            isCheckmate,
            isSelf,
            isCastling,
        };
        PlayAudioForMove(flags);
    }
}
