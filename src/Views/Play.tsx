import { createSignal, onMount } from "solid-js";
import { Chess } from "chess.js";
import { Api } from "chessground/api";
import { Chessboard } from "../chessboard/Chessboard";
import { Key } from "chessground/types";
import { Piece } from "chessops";
// import { Stockfish } from "../declarations";
// import  StockfishInit  from "/node_modules/stockfish-nnue.wasm/stockfish.js";
// import { Worker } from "stockfish-nnue.wasm";
// import Stockfish from "stockfish.wasm";
import StockFish from "stockfish.wasm";
const Play = () => {
    // @ts-ignore
    const [game, setGame] = createSignal(new Chess());
    const [api, setApi] = createSignal<Api | undefined>(undefined);
    const [stockfish, setStockfish] = createSignal<any | undefined>(undefined);

    const updateStatus = () => {
        var status = ''

        var moveColor = 'White'
        if (game().turn() === 'b') {
            moveColor = 'Black'
        }

        // checkmate?
        if (game().isCheckmate()) {
            status = 'Game over, ' + moveColor + ' is in checkmate.'
        }

        // draw?
        else if (game().isDraw()) {
            status = 'Game over, drawn position'
        }

        // game still on
        else {
            status = moveColor + ' to move'

            // check?
            if (game().inCheck()) {
                status += ', ' + moveColor + ' is in check'
            }
        }
        console.log(status);
        // $status.html(status)
        // $fen.html(game.fen())
        // $pgn.html(game.pgn())
    }

    onMount(async () => {
        // const engine = new Worker("stockfish.wasm?worker");
        // const engine = new MyWorker()
        const engine = await StockFish();
        setStockfish(engine);
        console.log(engine);
        // var sf = await Stockfish();
        var sf = engine;
        sf.onmessage = (event) => {
            console.log(event.data);
        }
        // Stockfish().then(async (sf) => {
            // setStockfish(sf);
            // sf.addMessageListener((line: any) => {
            //     // var line = event.data;
            //     console.log("line", line);
            //     if (line.startsWith('bestmove')) {
            //         var bestMove = line.split(' ')[1];
            //         game().move({ from: bestMove.slice(0, 2), to: bestMove.slice(2, 4), promotion: 'q' });
            //         api()?.set({
            //             fen: game().fen()
            //         });
            //         updateStatus();
            //     }
            // });

            sf.postMessage("uci");

        // });
    });
    // const stockfish = new Worker('node_modules/stockfish-nnue.wasm/stockfish.js');


    // @ts-ignore
    function onMove(from: Key, to: Key, captured: Piece | undefined) {
        // see if the move is legal
        var move = game().move({
            from: from,
            to: to,
            promotion: 'q' // NOTE: always promote to a queen for example simplicity
        })

        // illegal move
        if (move === null) return 'snapback'

        updateStatus()

        stockfish().postMessage('position fen ' + game().fen());
        stockfish().postMessage('go depth 15');

    }



    const config = {
        events: {
            move: onMove
        }

    }


    return (
        <div>
            <h1>Play</h1>
            <div style="max-width: 60%">
                <Chessboard config={config} setApi={setApi} />

            </div>


        </div>
    );
}

export default Play;