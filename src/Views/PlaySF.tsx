import { createSignal, onMount } from "solid-js";
import { Api } from "chessground/api";
import { Chessboard } from "../components/common/chessboard";
import { Key } from "chessground/types";
import { Chess, NormalMove, Piece } from "chessops";
import { StockfishManager } from "../engine/stockfish";
import { makeMove } from "../components/common/utils";
import { makeFen } from "chessops/fen";
import { setSettingValue } from "../models/settings";

const PlaySF = () => {
    
    const [game, _setGame] = createSignal(Chess.default());
    const [api, setApi] = createSignal<Api | undefined>(undefined);
    const [stockfish, setStockfish] = createSignal<StockfishManager | undefined>(undefined);

    const updateStatus = () => {
        var status = ''

        var moveColor = 'White'
        if (game().turn === 'black') {
            moveColor = 'Black'
        }

        // checkmate?
        if (game().isCheckmate()) {
            status = 'Game over, ' + moveColor + ' is in checkmate.'
        }

        // draw?
        else if (game().isStalemate()) {
            status = 'Game over, drawn position'
        }

        // game still on
        else {
            status = moveColor + ' to move'

            // check?
            if (game().isCheck()) {
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
            const m = {from: bestMove.slice(0, 2), to: bestMove.slice(2, 4)};
            console.log("best move", m);
            const move : NormalMove = makeMove(m.from, m.to);
            game().play(move);
            const newFen = makeFen(game().toSetup());
            console.log("new fen", newFen);
            api()?.set({
                fen: newFen,
                lastMove: [m.from, m.to]
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

        setSettingValue("engine.lastUsed", "stockfish");    
    });
    // const stockfish = new Worker('node_modules/stockfish-nnue.wasm/stockfish.js');


    // @ts-ignore
    function onMove(from: Key, to: Key, captured: Piece | undefined) {
        // see if the move is legal
        const m = makeMove(from, to);
        var move = game().play(m)   

        // illegal move
        if (move === null) return 'snapback'

        updateStatus();

        // const moves = game().history({
        //     verbose: true
        // }).map(move => move.lan);
        // const moves:string[] = [];
        const fen = makeFen(game().toSetup());
        // TODO: use gamemodel to keep track of moves


        stockfish()?.analyzeFromMoves(fen, {
            depth: 15
        });

        // stockfish().postMessage('position fen ' + game().fen());
        // stockfish().postMessage('go depth 15');

    }



    const config = () => ({
        events: {
            move: onMove
        }

    });


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