import { Chessboard } from "../common/chessboard";
import { Config } from "chessground/config";
import { createSignal } from "solid-js";
import { Api } from "chessground/api";
import { PiecesToolbar } from "./Piece";
import { Piece } from "chessground/types";

const BoardEditor = () => {
    const [selectedPiece, setSelectedPiece] = createSignal<Piece | null>(null);
    const [deleteMode, setDeleteMode] = createSignal(false);
    const [api, setApi] = createSignal<Api | undefined>(undefined);

    const onDeleteModeClicked = () => {
        setDeleteMode(!deleteMode());
        setSelectedPiece(null);
    }

    const onSave = () => {
        const cg = api();
        if (!cg) {
            return;
        }
        const fen = cg.getFen();
        console.debug("TODO: save fen", fen);
        // saveDataIntoBlock(app, { fen: cg.getFen() }, ctx);
    }

    const onChessboardClick = (e: MouseEvent) => {
        const cg = api();
        if (!cg) {
            return;
        }
        const square = cg.getKeyAtDomPos([e.clientX, e.clientY]);
        if (!square) return;
        const piece = selectedPiece();
        if (piece !== null) {
            cg.newPiece(piece, square);
            // addPiece(square, 'K');
        } else if (deleteMode()) {
            cg.state.pieces.delete(square);
        }
    }



    const config = (): Config => {

        
        return {
        draggable: {
            enabled: true
        },
        movable: {
            free: true,  // Allow pieces to be placed freely
            color: 'both', // Both sides can move pieces
            events: {
                after: (orig, dest, metadata) => {
                    console.log(orig, dest, metadata);
                    console.log(api()?.getFen());
                }
            }
        },
        selectable: {
            enabled: true, // Allow pieces to be selectable
        },
        drawable: {
            enabled: false
        }

    }};

    return (<div class="chess-container">
        <PiecesToolbar
            color='black'
        />
        <Chessboard
            onChessboardClick={onChessboardClick}
            setApi={setApi}
            config={config}
        />
        <PiecesToolbar
            color='white'
        />
    </div>);
}

export default BoardEditor;