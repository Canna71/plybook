import { NormalMove, squareFile } from "chessops";
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
        // chessops castles as the king taking its rook: the king then stands elsewhere, so ask
        // the position before (comparing ranks, as before, never matched)
        const before = previousPly?.pos.board;
        const isCastling =
            before?.get(lastMove.from)?.role === "king" &&
            Math.abs(squareFile(lastMove.to) - squareFile(lastMove.from)) >= 2;
        // not the castling rook, which is the mover's own; en passant lands on an empty square
        const mover = before?.get(lastMove.from);
        const isCapture =
            (!!before?.has(lastMove.to) &&
                before.get(lastMove.to)?.color !== mover?.color) ||
            (mover?.role === "pawn" &&
                squareFile(lastMove.to) !== squareFile(lastMove.from));
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
