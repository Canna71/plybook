import { Chessboard } from "../common/chessboard";
import { Config } from "chessground/config";
import {
    Accessor,
    Component,
    createEffect,
    createSignal,
    Setter,
} from "solid-js";
import { Api } from "chessground/api";
import { PiecesToolbar } from "./PiecesToolbar";
import { Piece, Role } from "chessground/types";
import ToggleSwitch from "../common/ToggleSwitch";
import { INITIAL_BOARD_FEN, makeFen, parseFen } from "chessops/fen";
import { SquareSet } from "chessops";
import { squareFromCoords } from "chessops/util";
import Select from "../common/Select";
import { getEnPassantSquares, selectAll } from "../common/utils";
// see: https://lichess.org/editor/1nbqkbn1/p3pppp/1bp2n2/3r3r/8/8/PPPPPPPP/RNBQKBNR_w_KQha_-_0_1?color=white

import "./BoardEditor.scss";
import Button from "../common/Button";
import { IconCopy, IconRestore } from "@tabler/icons-solidjs";
import Collapsible from "../common/Collapsible";
import { makeToast } from "../common/Toast";


export type BoardEditorProps = {
    fen: Accessor<string | undefined>;
    setFen: Setter<string | undefined>;
};

const BoardEditor: Component<BoardEditorProps> = (props) => {
    const [selectedPiece, _setSelectedPiece] = createSignal<Piece | null>(null);
    const [deleteMode, _setDeleteMode] = createSignal(false);
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
        setBaseFen(props.fen() || INITIAL_BOARD_FEN);
    });

    // const onSave = () => {
    //     const cg = api();
    //     if (!cg) {
    //         return;
    //     }
    //     const fen = cg.getFen();
    // }

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
    };

    const onDrop = (role: Role, color: "white" | "black", rect: DOMRect) => {
        const key = api()?.getKeyAtDomPos([
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
        ]);
        if (key) {
            api()?.newPiece({ role, color }, key);
        }
    };

    const onChange = () => {
        let fen = api()?.getFen();
        setBaseFen(fen);
    };

    const fen = () => {
        let fen = baseFen();
        console.log("fen changed", fen);
        if (fen) {
            const parsed = parseFen(fen);
            if (parsed.isOk) {
                const setup = parsed.value;
                setup.turn = whitesTurn() ? "white" : "black";
                let castlingRights = SquareSet.empty();
                if (whiteKingside()) {
                    castlingRights = castlingRights.with(
                        squareFromCoords(7, 0)!,
                    );
                }
                if (whiteQueenside()) {
                    castlingRights = castlingRights.with(
                        squareFromCoords(0, 0)!,
                    );
                }
                if (blackKingside()) {
                    castlingRights = castlingRights.with(
                        squareFromCoords(7, 7)!,
                    );
                }
                if (blackQueenside()) {
                    castlingRights = castlingRights.with(
                        squareFromCoords(0, 7)!,
                    );
                }

                if (enPassant() !== "") {
                    setup.epSquare = squareFromCoords(
                        enPassant().charCodeAt(0) - "a".charCodeAt(0),
                        enPassant().charCodeAt(1) - "1".charCodeAt(0),
                    );
                }

                setup.castlingRights = castlingRights;
                fen = makeFen(setup, { epd: true });
            }
        }
        return fen;
    };

    createEffect(() => {
        const newFen = fen();
        if (newFen) {
            props.setFen(fen());
        }
    });

    const onClear = () => {
        setBaseFen("8/8/8/8/8/8/8/8");
    };

    const onStartingPosition = () => {
        setBaseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
    };

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
        const options = [{ key: "", value: "None" }].concat(
            squares.map((square) => ({ key: square, value: square })),
        );
        return options;
    };

    const config = (): Config => {
        const config: Config = {
            fen: props.fen(),
            turnColor: whitesTurn() ? "white" : "black",
            orientation: flip() ? "black" : "white",
            draggable: {
                enabled: true,
                deleteOnDropOff: true,
            },
            movable: {
                free: true, // Allow pieces to be placed freely
                color: "both", // Both sides can move pieces
                events: {
                    
                },
            },
            selectable: {
                enabled: true, // Allow pieces to be selectable
            },
            drawable: {
                enabled: false,
            },
            events: {
                change: onChange,
            },
        };
        return config;
    };

    const onFenChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        setBaseFen(target.value);
    };

    const onCopy = async () => {
       // copy to clipboard
       const text = fen();
       if(!text) return;
        try {
            await navigator.clipboard.writeText(text);
            makeToast("FEN copied to clipboard");
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };


    const onClick = (e: Event) => {
        const target = e.target as HTMLInputElement;
        // select all text
        target.select();
    };

    return (
        <div class="board-editor-container">
            <div class="is-flex is-flex-direction-row is-align-items-center is-gap-1 is-flex-wrap-wrap">
                <div class="is-flex is-flex-direction-row is-align-items-center is-gap-1">
                    <ToggleSwitch
                        toggleSignal={[whitesTurn, setWhitesTurn]}
                        labels={["Black's turn", "White's turn"]}
                    />

                    <ToggleSwitch
                        toggleSignal={[flip, setFlip]}
                        labels={["A1⇄H8", "H8⇄A1"]}
                    />
                </div>
                <div class="is-flex is-flex-direction-row is-align-items-center is-gap-1">
                    <Button onClick={onClear}>
                        <IconRestore />
                        Clear
                    </Button>
                    <Button onClick={onStartingPosition}>
                        Starting Position
                    </Button>
                </div>
            </div>

            <Collapsible title="Advanced settings" class="mt-4">
                <label class="label">Castling rights:</label>
                <div class="fixed-grid mb-4">
                    <div class="grid">
                        <ToggleSwitch
                            toggleSignal={[blackQueenside, setBlackQueenside]}
                            labels={["Black O-O-O", "Black O-O-O"]}
                        />
                        <ToggleSwitch
                            toggleSignal={[blackKingside, setBlackKingside]}
                            labels={["Black O-O", "Black O-O"]}
                        />
                        <ToggleSwitch
                            toggleSignal={[whiteQueenside, setWhiteQueenside]}
                            labels={["White O-O-O", "White O-O-O"]}
                        />
                        <ToggleSwitch
                            toggleSignal={[whiteKingside, setWhiteKingside]}
                            labels={["White O-O", "White O-O"]}
                        />
                    </div>
                </div>
                <div class="field">
                    <div class="is-flex is-flex-direction-row is-align-items-baseline">
                        <label class="label">En passant:</label>
                        <Select
                            options={availableEnPassant}
                            selectedValue={enPassant}
                            setSelectedValue={setEnPassant}
                        />
                    </div>
                </div>
            </Collapsible>

            <PiecesToolbar color="black" onDrop={onDrop} />
            <Chessboard
                onChessboardClick={onChessboardClick}
                setApi={setApi}
                config={config}
            />
            <PiecesToolbar color="white" onDrop={onDrop} />
            <div class="board-editor-toolbar">
                <input
                    class="input"
                    type="text"
                    value={props.fen()}
                    onChange={onFenChange}
                    onClick={onClick}
                />
                <Button  onClick={onCopy}>
                    <IconCopy />
                </Button>
            </div>
        </div>
    );
};

export default BoardEditor;
