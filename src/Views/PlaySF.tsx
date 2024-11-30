import { createSignal, onMount } from "solid-js";
import { Chess } from "chess.js";
import { Api } from "chessground/api";
import { Chessboard } from "../chessboard/chessboard";
import { Key } from "chessground/types";
import { Piece } from "chessops";
import { StockfishManager } from "../engine/stockfish";

const PlaySF = () => {
    // @ts-ignore
    const [game, setGame] = createSignal(new Chess());
    const [api, setApi] = createSignal<Api | undefined>(undefined);
    const [stockfish, setStockfish] = createSignal<StockfishManager | undefined>(undefined);

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

    const onEngineEvent = (event: string, ...args: any[]) => {
        console.log(event, args);
        if (event === 'bestmove') {
            var bestMove = args[0];
            game().move({ from: bestMove.slice(0, 2), to: bestMove.slice(2, 4), promotion: 'q' });
            api()?.set({
                fen: game().fen()
            });
            updateStatus();
        }
    }

    onMount(async () => {
        var engine = StockfishManager.GetEngine(onEngineEvent); 
        console.log("waiting for engine to init");
        await engine.init();
        console.log("engine initialized");
        setStockfish(engine);
        engine.newGame();
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

        updateStatus();

        const moves = game().history({
            verbose: true
        }).map(move => move.lan);

        stockfish()?.analyzeFromMoves(moves, {
            depth: 15
        });

        // stockfish().postMessage('position fen ' + game().fen());
        // stockfish().postMessage('go depth 15');

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

export default PlaySF;