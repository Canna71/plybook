import { createSignal, onMount } from "solid-js";
import { Chess } from "chess.js";
// import  StockfishInit  from "/node_modules/stockfish-nnue.wasm/stockfish.js";
// import { Worker } from "stockfish-nnue.wasm";

const Play = () => {

    const [game, setGame] = createSignal(new Chess());


    onMount(() => {
        console.log(Stockfish);
        Stockfish().then((sf) => {
            sf.addMessageListener((line) => {
                console.log(line);
            });

            sf.postMessage("uci");
            // sf.postMessage("position startpos");
            // sf.postMessage("init");

            sf.postMessage('position fen ' + "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
            sf.postMessage('go depth 2');
        });
    });
    // const stockfish = new Worker('node_modules/stockfish-nnue.wasm/stockfish.js');



    // stockfish.addEventListener('message', function (e) {
    //     console.log(e);
    //     if (e.data.startsWith('bestmove')) {
    //         var bestMove = e.data.split(' ')[1];
    //         //   game.move({ from: bestMove.slice(0, 2), to: bestMove.slice(2, 4), promotion: 'q' });
    //         //   board.position(game.fen());
    //         //   updateStatus();
    //         console.log(bestMove);
    //     }
    // });

    // console.log(stockfish);

    // stockfish.postMessage('init');

    // stockfish.postMessage('position fen ' + "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    // stockfish.postMessage('go depth 2');

    return (
        <div>
            <h1>Play</h1>
        </div>
    );
}

export default Play;