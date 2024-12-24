import { Chessboard } from "../common/chessboard";
import { Config } from "chessground/config";
import { Accessor, Component, createEffect, createSignal, onMount, Setter } from "solid-js";
import { Api } from "chessground/api";
import { PiecesToolbar } from "./Piece";
import { Key, Piece, Role } from "chessground/types";
import ToggleSwitch from "../common/ToggleSwitch";
import { makeFen, parseFen } from "chessops/fen";
import { set } from "es-toolkit/compat";
import { kingCastlesTo, SquareSet } from "chessops";
import { squareFromCoords } from "chessops/util";

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
    const [baseFen, setBaseFen] = createSignal<string | undefined>(undefined);
    const [flip, setFlip] = createSignal(false);
    const [whiteKingside, setWhiteKingside] = createSignal(true);
    const [whiteQueenside, setWhiteQueenside] = createSignal(true);
    const [blackKingside, setBlackKingside] = createSignal(true);
    const [blackQueenside, setBlackQueenside] = createSignal(true);


    createEffect(() => {
        // loadDataFromBlock(app, ctx);
        const cg = api();
        if (!cg) {
            return;
        }
        if (!props.fen()) {
            setBaseFen(cg.getFen());
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
        console.log("onDrop", role, color, rect);
        // setSelectedPiece({ role, color });
        const key = api()?.getKeyAtDomPos([rect.x + rect.width / 2, rect.y + rect.height / 2]);
        console.log("onDrop", key);
        if (key) {
            api()?.newPiece({ role, color }, key);
        }
    }

    const onChange = () => {
        let fen = api()?.getFen();
        setBaseFen(fen);
        console.log("onChange", fen);
    }

    const fen = () => {
        let fen = baseFen();
        console.log("fen", fen);
        if (fen) {
            const parsed = parseFen(fen);
            if (parsed.isOk) {
                const setup = parsed.value;
                setup.turn = whitesTurn() ? 'white' : 'black';
                let castlingRights = SquareSet.empty();
                if (whiteKingside()) {
                    castlingRights = castlingRights.with(squareFromCoords(7 , 0)!)
                }
                if (whiteQueenside()) {
                    castlingRights = castlingRights.with(squareFromCoords(0 , 0)!)
                }
                if (blackKingside()) {
                    castlingRights = castlingRights.with(squareFromCoords(7 , 7)!)
                }
                if (blackQueenside()) {
                    castlingRights = castlingRights.with(squareFromCoords(0 , 7)!)
                }


                setup.castlingRights = castlingRights;
                fen = makeFen(setup, { epd: true });
                console.log("fen", fen);
            }
        }
        return fen;
    }

    createEffect(() => {
        const turn = whitesTurn() ? 'white' : 'black';
        props.setFen(fen());
    });

    const onClear = () => {
        setBaseFen('8/8/8/8/8/8/8/8');
    }

    const onStartingPosition = () => {
        setBaseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
    }

    const config = (): Config => {


        const config: Config = {
            fen: props.fen(),
            turnColor: whitesTurn() ? 'white' : 'black',
            orientation: flip() ? 'black' : 'white',
            draggable: {
                enabled: true,
                deleteOnDropOff: true
            },
            movable: {
                free: true,  // Allow pieces to be placed freely
                color: 'both', // Both sides can move pieces
                events: {
                    after: (orig, dest, metadata) => {
                        // console.log(orig, dest, metadata);
                        // console.log(api()?.getFen());
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

        };
        // console.log("config", config);
        return config;
    };

    return (<div class="board-editor-container"
    // onDragOver={(e) => {
    //     e.preventDefault();
    //     console.log("dragover", e);
    // }}
    >
        <div class="form-line">
            <ToggleSwitch isToggled={whitesTurn} setIsToggled={setWhitesTurn} labels={["Black's turn", "White's turn"]} />
            <ToggleSwitch isToggled={flip} setIsToggled={setFlip} labels={["A1⇄H8", "H8⇄A1"]} />
        </div>
        <div  class="form-line">
            <ToggleSwitch isToggled={whiteKingside} setIsToggled={setWhiteKingside} labels={["White O-O", "White O-O"]} />
            <ToggleSwitch isToggled={whiteQueenside} setIsToggled={setWhiteQueenside} labels={["White O-O-O", "White O-O-O"]} />
            <ToggleSwitch isToggled={blackKingside} setIsToggled={setBlackKingside} labels={["Black O-O", "Black O-O"]} />
            <ToggleSwitch isToggled={blackQueenside} setIsToggled={setBlackQueenside} labels={["Black O-O-O", "Black O-O-O"]} />
        </div>
        <div class="form-line">
            <button onClick={onClear}>Clear</button>
            <button onClick={onStartingPosition}>Starting Position</button>

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
            onDrop={onDrop}
        />
        <div class="board-editor-toolbar">

            <input class="board-editor-textbox fen" type="text" value={props.fen()} />

        </div>
    </div>);
}

export default BoardEditor;