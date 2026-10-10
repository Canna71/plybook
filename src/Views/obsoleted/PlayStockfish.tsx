import { createSignal, onMount } from "solid-js";
import { Api } from "chessground/api";
import { Chessboard } from "../../components/common/chessboard";
import { Key } from "chessground/types";
import { Piece } from "chessops";
// import { Stockfish } from "../declarations";
// import  StockfishInit  from "/node_modules/stockfish-nnue.wasm/stockfish.js";
// import { Worker } from "stockfish-nnue.wasm";

const Play = () => {
    // @ts-ignore
    const [game, setGame] = createSignal(new Chess());
    const [api, setApi] = createSignal<Api | undefined>(undefined);
    const [stockfish, setStockfish] = createSignal<any | undefined>(undefined);

    const updateStatus = () => {
        let status = "";

        let moveColor = "White";
        if (game().turn() === "b") {
            moveColor = "Black";
        }

        // checkmate?
        if (game().isCheckmate()) {
            status = "Game over, " + moveColor + " is in checkmate.";
        }

        // draw?
        else if (game().isDraw()) {
            status = "Game over, drawn position";
        }

        // game still on
        else {
            status = moveColor + " to move";

            // check?
            if (game().inCheck()) {
                status += ", " + moveColor + " is in check";
            }
        }
    };

    onMount(() => {
        Stockfish().then(async (sf) => {
            setStockfish(sf);
            sf.addMessageListener((line: any) => {
                // var line = event.data;
                if (line.startsWith("bestmove")) {
                    const bestMove = line.split(" ")[1];
                    game().move({
                        from: bestMove.slice(0, 2),
                        to: bestMove.slice(2, 4),
                        promotion: "q",
                    });
                    api()?.set({
                        fen: game().fen(),
                    });
                    updateStatus();
                }
            });

            sf.postMessage("uci");
        });
    });
    // const stockfish = new Worker('node_modules/stockfish-nnue.wasm/stockfish.js');

    // @ts-ignore
    function onMove(from: Key, to: Key, captured: Piece | undefined) {
        // see if the move is legal
        const move = game().move({
            from: from,
            to: to,
            promotion: "q", // NOTE: always promote to a queen for example simplicity
        });

        // illegal move
        if (move === null) return "snapback";

        updateStatus();

        stockfish().postMessage("position fen " + game().fen());
        stockfish().postMessage("go depth 15");
    }

    const config = () => ({
        events: {
            move: onMove,
        },
    });

    return (
        <div>
            <h1>Play</h1>
            <div style="max-width: 60%">
                <Chessboard config={config} setApi={setApi} />
            </div>
        </div>
    );
};

export default Play;
