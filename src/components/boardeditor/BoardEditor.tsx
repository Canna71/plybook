import { Chessboard } from "../common/chessboard";
import { Config } from "chessground/config";
import { Accessor, Component, createEffect, createSignal, onMount, Setter } from "solid-js";
import { Api } from "chessground/api";
import { PiecesToolbar } from "./Piece";
import { Key, Piece, Role } from "chessground/types";
import ToggleSwitch from "../common/ToggleSwitch";

// see: https://lichess.org/editor/1nbqkbn1/p3pppp/1bp2n2/3r3r/8/8/PPPPPPPP/RNBQKBNR_w_KQha_-_0_1?color=white

export type BoardEditorProps = {
    fen: Accessor<string | undefined>;
    setFen: Setter<string | undefined>;
};

const BoardEditor: Component<BoardEditorProps> = (props) => {
    const [selectedPiece, setSelectedPiece] = createSignal<Piece | null>(null);
    const [deleteMode, setDeleteMode] = createSignal(false);
    const [api, setApi] = createSignal<Api | undefined>(undefined);
    const [whitesTurn, setWhitesTurn] = createSignal(true);

    // const onDeleteModeClicked = () => {
    //     setDeleteMode(!deleteMode());
    //     setSelectedPiece(null);
    // }

    createEffect(() => {
        // loadDataFromBlock(app, ctx);
        console.log("onMount");
        const cg = api();
        if (!cg) {
            return;
        }
        if (!props.fen()) {
            props.setFen(cg.getFen());
        }
    });

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

    const onDrop = (role: Role, color: 'white' | 'black', rect: DOMRect) => {
        // setSelectedPiece({ role, color });
        const key = api()?.getKeyAtDomPos([rect.x + rect.width / 2, rect.y + rect.height / 2]);
        if (key) {
            api()?.newPiece({ role, color }, key);
        }
    }

    const onChange = () => {
        const fen = api()?.getFen();
        props.setFen(fen);
    }

    const config = (): Config => {


        return {
            fen: props.fen(),
            turnColor: whitesTurn() ? 'white' : 'black',
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
            events: {
                change: onChange,
            }

        }
    };

    return (<div class="board-editor-container"
    // onDragOver={(e) => {
    //     e.preventDefault();
    //     console.log("dragover", e);
    // }}
    >
        <div>
            <ToggleSwitch isToggled={whitesTurn} setIsToggled={setWhitesTurn} labels={["Black's turn", "White's turn"]} />
        </div>
        <PiecesToolbar
            color='black'
            onDrop={onDrop}
        />
        <Chessboard
            onChessboardClick={onChessboardClick}
            setApi={setApi}
            config={config}

        />
        <PiecesToolbar
            color='white'
        />
        <div class="board-editor-toolbar">
            
            <input class="board-editor-textbox fen" type="text" value={props.fen()} />

        </div>
    </div>);
}

export default BoardEditor;