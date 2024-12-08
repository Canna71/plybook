import { Chessboard } from "./chessboard";
import { Config } from "chessground/config";
import { createSignal } from "solid-js";
import { Api } from "chessground/api";
import { Toolbar } from "./Piece";
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



    const config = (): Config => ({
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
            enabled: true, // Allow drawings
            // autoShapes: [{
            //     orig: 'b2',
            //     // dest: 'b6',
            //     brush: 'green',
            //     // label: { text: 'B' },
            //     // modifiers: {
            //     //     lineWidth: 6,
            //     // },
            // }]
        },
        highlight: {
            lastMove: true,
            check: true,
        },

    });

    return (<div class="chess-container">
        <Chessboard
            onChessboardClick={onChessboardClick}
            setApi={setApi}
            config={config}
        />
        <div>
            <button onClick={onSave} >Save</button>
            <button onClick={onDeleteModeClicked} classList={{
                selected: deleteMode()
            }} >X</button>


        </div>
        <Toolbar
            selectedPiece={selectedPiece}
            setSelectedPiece={setSelectedPiece}
            color='white'
        />
        <Toolbar
            selectedPiece={selectedPiece}
            setSelectedPiece={setSelectedPiece}
            color='black'
        />
    </div>);
}

export default BoardEditor;