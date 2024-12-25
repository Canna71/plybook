import { Chessboard } from "../common/chessboard";
import { Config } from "chessground/config";
import { Accessor, Component, createEffect, createSignal, onMount, Setter } from "solid-js";
import { Api } from "chessground/api";
import { PiecesToolbar } from "./Piece";
import { Piece, Role } from "chessground/types";
import ToggleSwitch from "../common/ToggleSwitch";
import { makeFen, parseFen } from "chessops/fen";
import { SquareSet } from "chessops";
import { squareFromCoords } from "chessops/util";
import Select from "../common/Select";
import { makeSan } from "chessops/san";
import { getEnPassantSquares } from "../common/utils";
// see: https://lichess.org/editor/1nbqkbn1/p3pppp/1bp2n2/3r3r/8/8/PPPPPPPP/RNBQKBNR_w_KQha_-_0_1?color=white


import './BoardEditor.scss';
import Button from "../common/Button";

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
    const [enPassant, setEnPassant] = createSignal<string>("");

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
        const key = api()?.getKeyAtDomPos([rect.x + rect.width / 2, rect.y + rect.height / 2]);
        if (key) {
            api()?.newPiece({ role, color }, key);
        }
    }

    const onChange = () => {
        let fen = api()?.getFen();
        setBaseFen(fen);
    }

    const fen = () => {
        let fen = baseFen();
        if (fen) {
            const parsed = parseFen(fen);
            if (parsed.isOk) {
                const setup = parsed.value;
                setup.turn = whitesTurn() ? 'white' : 'black';
                let castlingRights = SquareSet.empty();
                if (whiteKingside()) {
                    castlingRights = castlingRights.with(squareFromCoords(7, 0)!)
                }
                if (whiteQueenside()) {
                    castlingRights = castlingRights.with(squareFromCoords(0, 0)!)
                }
                if (blackKingside()) {
                    castlingRights = castlingRights.with(squareFromCoords(7, 7)!)
                }
                if (blackQueenside()) {
                    castlingRights = castlingRights.with(squareFromCoords(0, 7)!)
                }

                if(enPassant() !== "") {
                    setup.epSquare = squareFromCoords(enPassant().charCodeAt(0) - 'a'.charCodeAt(0), enPassant().charCodeAt(1) - '1'.charCodeAt(0));
                }

                setup.castlingRights = castlingRights;
                fen = makeFen(setup, { epd: true });
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

    const availableEnPassant = () => {

        const fen = baseFen();
        if (!fen) {
            return [];
        }
        
        const parsed = parseFen(fen);
        let squares: string[] = [];
        if (parsed.isOk) {
            squares = getEnPassantSquares(parsed.value, whitesTurn());
        }
        //  squares = ["a3", "b3", "c3", "d3", "e3", "f3", "g3", "h3"];
        const options = [{ key: "", value: "None" }].concat(squares.map(square => ({ key: square, value: square })));
        console.log("options", options);
        return options;
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
        return config;
    };

    return (<div class="board-editor-container"
    
    >
        <div class="form-line">
            <ToggleSwitch isToggled={whitesTurn} setIsToggled={setWhitesTurn} labels={["Black's turn", "White's turn"]} />
            <ToggleSwitch isToggled={flip} setIsToggled={setFlip} labels={["A1⇄H8", "H8⇄A1"]} />
        </div>
        <div class="form-line">
            <ToggleSwitch isToggled={whiteKingside} setIsToggled={setWhiteKingside} labels={["White O-O", "White O-O"]} />
            <ToggleSwitch isToggled={whiteQueenside} setIsToggled={setWhiteQueenside} labels={["White O-O-O", "White O-O-O"]} />
            <ToggleSwitch isToggled={blackKingside} setIsToggled={setBlackKingside} labels={["Black O-O", "Black O-O"]} />
            <ToggleSwitch isToggled={blackQueenside} setIsToggled={setBlackQueenside} labels={["Black O-O-O", "Black O-O-O"]} />
        </div>
        <div class="form-line">
            En passant: <Select options={availableEnPassant} selectedValue={enPassant} setSelectedValue={setEnPassant}  />
            <Button onClick={onClear}>Clear</Button>
            <Button onClick={onStartingPosition}>Starting Position</Button>
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


