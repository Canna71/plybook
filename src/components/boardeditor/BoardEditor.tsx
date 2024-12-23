import { Chessboard } from "../common/chessboard";
import { Config } from "chessground/config";
import { createSignal } from "solid-js";
import { Api } from "chessground/api";
import { PiecesToolbar } from "./Piece";
import { Key, Piece, Role } from "chessground/types";

// see: https://lichess.org/editor/1nbqkbn1/p3pppp/1bp2n2/3r3r/8/8/PPPPPPPP/RNBQKBNR_w_KQha_-_0_1?color=white

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
            enabled: true,
            deleteOnDropOff: true
        },
        movable: {
            free: true,  // Allow pieces to be placed freely
            color: 'both', // Both sides can move pieces
            events: {
                after: (orig, dest, metadata) => {
                    console.log(orig, dest, metadata);
                    console.log(api()?.getFen());
                },

            }
        },
        selectable: {
            enabled: true, // Allow pieces to be selectable
        },
        drawable: {
            enabled: false
        },
        predroppable: {
                enabled: true,
                events: {
                    set: (role: Role, key: Key) => {
                        console.log("dropped", role, key);
                        // props.onPieceSelected(role);
                    },
                    unset: () => {
                        console.log("unset");
                    }
                }
            }

    }};

    return (<div class="chess-container"
        // onDragOver={(e) => {
        //     e.preventDefault();
        //     console.log("dragover", e);
        // }}
        >
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