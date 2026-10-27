import { Chessboard } from "../common/chessboard";
import { Config } from "chessground/config";
import {
    Accessor,
    createEffect,
    createSignal,
    ParentComponent,
    Setter,
    Show,
} from "solid-js";
import { Api } from "chessground/api";
import { PiecesToolbar } from "./PiecesToolbar";
import { Piece, Role } from "chessground/types";
import { INITIAL_FEN, makeFen, parseFen } from "chessops/fen";
import { makeSquare, parseSquare, squareFromCoords } from "chessops/util";
import Select from "../common/Select";
import { getEnPassantSquares } from "../../models/chessutil";
// see: https://lichess.org/editor/1nbqkbn1/p3pppp/1bp2n2/3r3r/8/8/PPPPPPPP/RNBQKBNR_w_KQha_-_0_1?color=white

import "./BoardEditor.scss";
import Button from "../common/Button";
import {
    IconChess,
    IconCopy,
    IconRestore,
    IconSwitchVertical,
} from "@tabler/icons-solidjs";
import { makeToast } from "../common/Toast";
import anylogger from "anylogger";
const log = anylogger("boardeditor");

export type BoardEditorProps = {
    fen: Accessor<string | undefined>;
    setFen: Setter<string | undefined>;
};

/** The children are the screen's own actions, shown under the settings. */
const BoardEditor: ParentComponent<BoardEditorProps> = (props) => {
    const [selectedPiece, _setSelectedPiece] = createSignal<Piece | null>(null);
    const [deleteMode, _setDeleteMode] = createSignal(false);
    const [api, setApi] = createSignal<Api | undefined>(undefined);
    // const [whitesTurn, setWhitesTurn] = createSignal(true);
    // const [baseFen, setBaseFen] = createSignal<string | undefined>(undefined);
    const [flip, setFlip] = createSignal(false);
    // const [whiteKingside, setWhiteKingside] = createSignal(true);
    // const [whiteQueenside, setWhiteQueenside] = createSignal(true);
    // const [blackKingside, setBlackKingside] = createSignal(true);
    // const [blackQueenside, setBlackQueenside] = createSignal(true);
    // const [enPassant, setEnPassant] = createSignal<string>("");

    createEffect(() => {
        // loadDataFromBlock(app, ctx);
        const cg = api();
        if (!cg) {
            return;
        }
        // setBaseFen(props.fen() || INITIAL_BOARD_FEN);
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
        const fen = api()?.getFen();
        props.setFen(fen);
    };

    const createCastlingRightsGetter =
        (row: number, col: number): Accessor<boolean> =>
        () => {
            const setup = position();
            if (!setup) return false;
            const square = squareFromCoords(row, col)!;
            return setup.castlingRights.has(square);
        };

    const whiteKingside = createCastlingRightsGetter(7, 0);
    const whiteQueenside = createCastlingRightsGetter(0, 0);
    const blackKingside = createCastlingRightsGetter(7, 7);
    const blackQueenside = createCastlingRightsGetter(0, 7);

    // New helper function
    const createCastlingRightsSetter =
        (
            row: number,
            col: number,
            getter: Accessor<boolean>,
        ): Setter<boolean> =>
        (value) => {
            const setup = position();
            if (!setup) return false;

            const v = typeof value === "function" ? value(getter()) : value;
            const square = squareFromCoords(row, col)!;

            setup.castlingRights = v
                ? setup.castlingRights.with(square)
                : setup.castlingRights.without(square);

            const newFen = makeFen(setup);
            props.setFen(newFen);
            return v;
        };

    // Replace individual setters with:
    const setWhiteKingside = createCastlingRightsSetter(7, 0, whiteKingside);
    const setWhiteQueenside = createCastlingRightsSetter(0, 0, whiteQueenside);
    const setBlackKingside = createCastlingRightsSetter(7, 7, blackKingside);
    const setBlackQueenside = createCastlingRightsSetter(0, 7, blackQueenside);

    const enPassant = () => {
        const setup = position();
        if (setup && setup.epSquare) {
            return makeSquare(setup.epSquare);
        }
        return "";
    };

    const setEnPassant = (value: string) => {
        const setup = position();
        if (setup) {
            setup.epSquare = parseSquare(value);
            props.setFen(makeFen(setup));
        }
    };

    const onClear = () => {
        props.setFen("8/8/8/8/8/8/8/8");
    };

    const onStartingPosition = () => {
        props.setFen(INITIAL_FEN);
    };

    const position = () => {
        const fen = props.fen();
        if (!fen) {
            return;
        }
        const parsed = parseFen(fen);
        if (parsed.isOk) {
            return parsed.value;
        }
    };

    const whitesTurn = () => {
        const setup = position();
        if (setup) {
            return setup.turn === "white";
        }
        return true;
    };

    const setWhitesTurn: Setter<boolean> = (value) => {
        const v = typeof value === "function" ? value(whitesTurn()) : value;
        const setup = position();
        if (setup) {
            setup.turn = v ? "white" : "black";
            props.setFen(makeFen(setup));
        }
        return v;
    };

    const availableEnPassant = () => {
        const setup = position();
        let squares: string[] = [];
        if (setup) {
            squares = getEnPassantSquares(setup, whitesTurn());
        }
        //  squares = ["a3", "b3", "c3", "d3", "e3", "f3", "g3", "h3"];
        const options = [{ value: "", label: "None" }].concat(
            squares.map((square) => ({ value: square, label: square })),
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
                events: {},
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
        props.setFen(target.value);
    };

    const onCopy = async () => {
        // copy to clipboard
        const text = props.fen();
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            makeToast("FEN copied to clipboard");
        } catch (err) {
            log.error("Failed to copy text: ", err);
        }
    };

    const onClick = (e: Event) => {
        const target = e.target as HTMLInputElement;
        // select all text
        target.select();
    };

    return (
        // the board with its piece trays on the left, the settings on the right (one column
        // when narrow: a container query in BoardEditor.scss)
        <div class="board-editor-container">
            <div class="board-editor-layout">
                <div class="board-editor-board">
                    <div class="board-editor-stack">
                        <PiecesToolbar
                            color={flip() ? "white" : "black"}
                            onDrop={onDrop}
                        />
                        <Chessboard
                            onChessboardClick={onChessboardClick}
                            setApi={setApi}
                            config={config}
                        />
                        <PiecesToolbar
                            color={flip() ? "black" : "white"}
                            onDrop={onDrop}
                        />
                    </div>
                </div>

                <div class="board-editor-panel">
                    <p class="board-editor-help">
                        Drag pieces from the trays onto the board, between
                        squares, or off the board to remove them.
                    </p>

                    <div class="field">
                        <label class="label is-small">To move</label>
                        <div class="buttons has-addons">
                            <Button
                                class={
                                    whitesTurn() ? "is-selected is-primary" : ""
                                }
                                onClick={() => setWhitesTurn(true)}
                            >
                                White
                            </Button>
                            <Button
                                class={
                                    !whitesTurn()
                                        ? "is-selected is-primary"
                                        : ""
                                }
                                onClick={() => setWhitesTurn(false)}
                            >
                                Black
                            </Button>
                        </div>
                    </div>

                    <div class="field">
                        <label class="label is-small">Board</label>
                        <div class="buttons">
                            <Button
                                onClick={() => setFlip((f) => !f)}
                                title="Turn the board round"
                            >
                                <IconSwitchVertical />
                                Flip
                            </Button>
                            <Button onClick={onStartingPosition}>
                                <IconChess />
                                Starting position
                            </Button>
                            <Button onClick={onClear}>
                                <IconRestore />
                                Clear
                            </Button>
                        </div>
                    </div>

                    <div class="field">
                        <label class="label is-small">Castling</label>
                        <div class="board-editor-castling">
                            <span>White</span>
                            <label class="checkbox">
                                <input
                                    type="checkbox"
                                    checked={whiteKingside()}
                                    onChange={(e) =>
                                        setWhiteKingside(
                                            e.currentTarget.checked,
                                        )
                                    }
                                />{" "}
                                O-O
                            </label>
                            <label class="checkbox">
                                <input
                                    type="checkbox"
                                    checked={whiteQueenside()}
                                    onChange={(e) =>
                                        setWhiteQueenside(
                                            e.currentTarget.checked,
                                        )
                                    }
                                />{" "}
                                O-O-O
                            </label>
                            <span>Black</span>
                            <label class="checkbox">
                                <input
                                    type="checkbox"
                                    checked={blackKingside()}
                                    onChange={(e) =>
                                        setBlackKingside(
                                            e.currentTarget.checked,
                                        )
                                    }
                                />{" "}
                                O-O
                            </label>
                            <label class="checkbox">
                                <input
                                    type="checkbox"
                                    checked={blackQueenside()}
                                    onChange={(e) =>
                                        setBlackQueenside(
                                            e.currentTarget.checked,
                                        )
                                    }
                                />{" "}
                                O-O-O
                            </label>
                        </div>
                    </div>

                    <div class="field">
                        <label class="label is-small">En passant</label>
                        <Select
                            options={availableEnPassant}
                            selectedValue={enPassant}
                            setSelectedValue={setEnPassant}
                        />
                    </div>

                    <div class="field">
                        <label class="label is-small">FEN</label>
                        <div class="board-editor-fen">
                            <input
                                class="input"
                                type="text"
                                value={props.fen() ?? ""}
                                onChange={onFenChange}
                                onClick={onClick}
                            />
                            <Button onClick={onCopy} title="Copy the FEN">
                                <IconCopy />
                            </Button>
                        </div>
                    </div>

                    <Show when={props.children}>
                        <div class="board-editor-actions">{props.children}</div>
                    </Show>
                </div>
            </div>
        </div>
    );
};

export default BoardEditor;
