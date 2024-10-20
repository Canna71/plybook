import { createSignal, onMount } from "solid-js";
import { Chess } from "chess.js";
import { Api } from "chessground/api";
import { Chessboard } from "../chessboard/Chessboard";
import { Key } from "chessground/types";
import { Piece } from "chessops";
// import  StockfishInit  from "/node_modules/stockfish-nnue.wasm/stockfish.js";
// import { Worker } from "stockfish-nnue.wasm";

const Play = () => {

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

    onMount(() => {
        // console.log(Stockfish);
        Stockfish().then(async (sf) => {
            setStockfish(sf);
            sf.addMessageListener((line: any) => {
                // var line = event.data;
                console.log("line", line);
                if (line.startsWith('bestmove')) {
                    var bestMove = line.split(' ')[1];
                    game().move({ from: bestMove.slice(0, 2), to: bestMove.slice(2, 4), promotion: 'q' });
                    api()?.set({
                        fen: game().fen()
                    });
                    updateStatus();
                }
            });

            sf.postMessage("uci");

            // await sf.ready
            // sf.postMessage("position startpos");
            // sf.postMessage("init");

            sf.postMessage('position fen ' + "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
            // await sf.ready

            sf.postMessage('go depth 16');
            // await sf.ready

        });
    });
    // const stockfish = new Worker('node_modules/stockfish-nnue.wasm/stockfish.js');

    function onDragStart(source, piece, position, orientation) {
        // do not pick up pieces if the game is over
        if (game().isGameOver()) return false

        // only pick up pieces for the side to move
        if ((game().turn() === 'w' && piece.search(/^b/) !== -1) ||
            (game().turn() === 'b' && piece.search(/^w/) !== -1)) {
            return false
        }
    }


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

    // update the board position after the piece snap
    // for castling, en passant, pawn promotion
    function onSnapEnd() {
        api()?.set({ fen: game().fen() });
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