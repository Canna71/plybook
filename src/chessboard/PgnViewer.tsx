import { Chess, Color, makeUci, pgn, Position } from "chessops";
import { Chessboard } from "./Chessboard";
import { Config } from "chessground/config";
import { makeFen, parseFen } from 'chessops/fen';
import {  parseSan } from 'chessops/san';
import { Accessor, Component, createEffect, createSignal } from "solid-js";
import { Api } from "chessground/api";
import { makeGame } from "../models/pgn";
import { Game, PgnNodeData } from "chessops/pgn";


// see: https://github.com/lichess-org/pgn-viewer


// PgnViwer options

export type PgnViewerOptions = {
	pgn: Accessor<string | undefined>;

}









const PgnViewer: Component<PgnViewerOptions> = ({ pgn }) => {
	const [currentMove, setCurrentMove] = createSignal<pgn.Node<PgnNodeData> | undefined>(undefined);
	const [game, setGame] = createSignal<Game<PgnNodeData> | undefined>(undefined);

	const [api, setApi] = createSignal<Api | undefined>(undefined);

	const config: Config = {

	}

	createEffect(() => {
		const cg = api();
		const pgnString = pgn();
		if (!cg || !pgnString) {
			return;
		}

		const [g, fen] = makeGame(pgnString);
		setGame(g);

		cg.set({
			fen: fen
		});
	});

	const onNext = () => {
		const cg = api();
		if (!cg) {
			return;
		}
		const g = game();
		if (!g) {
			return;
		}
		const current_move = currentMove() || g.moves;
		if (current_move.children.length === 0) {
			return;
		}
		let next = current_move.children[0];
		if (!next.data) next = next.children[0];
		const fen: string = (cg.state as any).fen;
		const setup = parseFen(fen).unwrap();
		// const fen = next.fen;
		// cg.set({
		// 	fen: fen
		// });
		setCurrentMove(next);
		const san = next.data.san;
		const chess = Chess.fromSetup(setup).unwrap();
		const move = parseSan(chess, san);
		if (!move) return;
		chess.play(move);
		const fen2 = makeFen(chess.toSetup());
		cg.set({
			fen: fen2
		});
	}

	return (
		<div>
			<Chessboard config={config} setApi={setApi} />
			<div>
				<button onClick={onNext} >&gt;|</button>
			</div>
		</div>
	);
}

export default PgnViewer;