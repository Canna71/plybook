import { createSignal, onMount } from "solid-js";
import { Chess } from "chess.js";
import { Api } from "chessground/api";
import { Chessboard } from "../chessboard/Chessboard";
import { Key } from "chessground/types";
import { Piece } from "chessops";
import { Child, Command } from '@tauri-apps/plugin-shell';

const PlaySF = () => {
    // @ts-ignore
    const [game, setGame] = createSignal(new Chess());
    const [api, setApi] = createSignal<Api | undefined>(undefined);
    const [stockfish, setStockfish] = createSignal<Child | undefined>(undefined);

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
        // console.log(Stockfish);
        let sf = await Command.sidecar('./binaries/stockfish-windows-x86-64-avx2', [
            "uci"
            // 'isready',
            // 'ucinewgame',
            // 'position startpos moves e2e4 e7e5 g1f3',
            // 'go depth 15'
        ]);

        sf.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
            if(data.includes('uciok')){
                stockfish()!.write('isready\n');
            }
        });

        sf.spawn().then((result) => {
            console.log(result);
            setStockfish(result);
            window.child = result;

            result.write('uci\n');
        

        });


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