import { Chessground } from 'chessground';
import { Config } from 'chessground/config';
// import { Chess } from 'chessops/chess';
import { parsePgn, PgnNodeData, startingPosition, Game } from 'chessops/pgn';
// import { parseSquare, parseUci } from 'chessops';
import { createSignal, onMount } from 'solid-js';
import { Api } from 'chessground/api';
import { Toolbar } from './Piece';
import { Piece } from 'chessground/types';
import { makeFen, parseFen } from 'chessops/fen';
import { Chess, pgn } from 'chessops';
import { parseSan } from 'chessops/san';

const TESTPGN= '[Event "San Sebastian"][Site "San Sebastian"][Date "1911.??.??"][Round "?"][White "Capablanca, Jose"][Black "Burn, Amos"][Result "1-0"] 1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.d3 { This is a very solid development, to which I was much addicted at the time, because of my ignorance of the multiple variations of the openings. } 5...d6 6.c3 Be7 ( { In this variation there is the alternative of developing this Bishop via **g7**, after } 6...g6 ) 7.Nbd2 O-O 8.Nf1 b5 9.Bc2 d5 10.Qe2 dxe4 11.dxe4 Bc5 { Evidently to make room for the Queen at **e7**, but I do not think the move advisable at this stage. } ( 11...Be6 { is a more natural and effective move. It develops a piece and threatens Bc4 which would have to be stopped. } ) 12.Bg5 Be6 { Now it is not so effective, because White\'s Queen\'s Bishop is out, and the Knight, in going to **e3** } 13.Ne3 { defends **c4** and does not block the Queen\'s Bishop. } 13...Re8 14.O-O Qe7 { # This is bad. Black\'s game was already not good. He probably had no choice but to take the Knight with the Bishop before making this move. } 15.Nd5 Bxd5 16.exd5 Nb8 { In order to bring it to **d7**, to support the other Knight and also his King\'s Pawn. White, however, does not allow time for this, and by taking advantage of his superior position is able to win a Pawn. } 17.a4 b4 ( { Since he had no way to prevent the loss of a Pawn, he should have given it up where it is, and played } 17...Nbd7 { in order to make his position more solid. The text move not only loses a Pawn, but leaves Black\'s game very much weakened. } ) 18.cxb4 Bxb4 19.Bxf6 Qxf6 20.Qe4 Bd6 21.Qxh7+ Kf8 { With a Pawn more and all his pieces ready for action, while Black is still backward in development, it only remains for White to drive home his advantage before Black can come out with his pieces, in which case, by using the open h-file, Black might be able to start a strong attack against White\'s King. White is able by his next move to eliminate all danger. # } 22.Nh4 Qh6 { This is practically forced. } ( { Black could not play } 22...g6 { because of } 23.Bxg6 { White meanwhile threatened } ) 23.Qxh6 gxh6 24.Nf5 h5 25.Bd1 Nd7 26.Bxh5 Nf6 27.Be2 Nxd5 28.Rfd1 Nf4 29.Bc4 Red8 30.h4 a5 { Black must lose time assuring the safety of this Pawn. } 31.g3 Ne6 32.Bxe6 fxe6 33.Ne3 Rdb8 34.Nc4 Ke7 { Black fights a hopeless battle. He is two Pawns down for all practical purposes, and the Pawns he has are isolated and have to be defended by pieces. } 35.Rac1 Ra7 { White threatened } 36.Re1 Kf6 37.Re4 Rb4 38.g4 Ra6 ( { If } 38...Rxa4 { then } 39.Nxd6 { would of course win a piece. } ) 39.Rc3 Bc5 40.Rf3+ Kg7 41.b3 Bd4 42.Kg2 Ra8 43.g5 Ra6 44.h5 Rxc4 45.bxc4 Rc6 46.g6 { Black resigns. } 1-0';


export function Chessboard() {
	// create a div under el and set its width and height to 100%

	let wrapper!: HTMLDivElement;
	const [api, setApi] = createSignal<Api | undefined>(undefined);
	const [selectedPiece, setSelectedPiece] = createSignal<Piece | null>(null);
	const [deleteMode, setDeleteMode] = createSignal(false);
	const [game, setGame] = createSignal<Game<PgnNodeData> | undefined>(undefined);
	const [currentMove, setCurrentMove] = createSignal<pgn.Node<PgnNodeData> | undefined>(undefined);
	// const [boarddaa, setData] = createSignal<BoardData | undefined>(boardData);

	const onSave = () => {
		const cg = api();
		if (!cg) {
			return;
		}
		
		// saveDataIntoBlock(app, { fen: cg.getFen() }, ctx);
	}

	const onDeleteModeClicked = () => {
		setDeleteMode(!deleteMode());
		setSelectedPiece(null);
	}

	const onChessboardClick = (e: MouseEvent) => {
		const cg = api();
		if (!cg) {
			return;
		}
		const square = cg.getKeyAtDomPos([e.clientX, e.clientY]);
		if(!square) return;
		const piece = selectedPiece();
		if (piece !== null) {
			console.log(square);
			cg.newPiece(piece, square);
			// addPiece(square, 'K');
		} else if (deleteMode()) {
			cg.state.pieces.delete(square);
		}
		console.log(cg.getFen());
	}

	const onParsePgn = () => {
		const cg = api();
		if (!cg) {
			return;
		}
		
		const pgn = parsePgn(TESTPGN)[0];
		setGame(pgn);
		const start = startingPosition(pgn.headers).unwrap();
		const setup = start.toSetup();
		const fen = makeFen(setup);
		// const moves = pgn.moves;
		// const comments = parseComments(game.comments || []);
		// const headers = new Map(Array.from(game.headers, ([key, value]) => [key.toLowerCase(), value]));
		// const metadata = makeMetadata(headers, lichess);
		console.log(pgn, start, setup, fen);
		cg.set({
			fen: fen
		});
	}

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
		if(!next.data) next = next.children[0];
		const fen : string = (cg.state as any).fen;
		const setup = parseFen(fen).unwrap();
		// const fen = next.fen;
		// cg.set({
		// 	fen: fen
		// });
		setCurrentMove(next);
		const san = next.data.san;
		const chess = Chess.fromSetup(setup).unwrap();
		const move = parseSan(chess, san);
		if(!move) return;
		chess.play(move);
		const fen2 = makeFen(chess.toSetup());
		cg.set({
			fen: fen2
		});
	}

	



	// 'r2q2k1/1p6/p2p4/2pN1rp1/N1Pb2Q1/8/PP1B4/R6K b - - 2 25'

	const config: Config = {
		// fen: boardData?.fen,
		fen: 'r2q2k1/1p6/p2p4/2pN1rp1/N1Pb2Q1/8/PP1B4/R6K b - - 2 25',
		draggable: {
			enabled: true
		},
		movable: {
			free: true,  // Allow pieces to be placed freely
			color: 'both', // Both sides can move pieces
		},
		selectable: {
			enabled: true, // Allow pieces to be selectable

		},
		highlight: {
			lastMove: true,
			check: true,
		},

	};

	// solid-js onLoad equivalent
	onMount(async () => {
		if (!wrapper) {
			return;
		}
		const api = Chessground(wrapper, config);
		api.set({
			movable: {
				events: {
					after: (orig, dest, metadata) => {
						console.log(orig, dest, metadata);
						console.log(api.getFen());
					}
				}
			}
		});
		setApi(api);
	});


	return (<div class="chess-container">
		<div ref={wrapper} class="chessboard" onclick={onChessboardClick} >

		</div>
		<div>
			<button onClick={onSave} >Save</button>
			<button onClick={onDeleteModeClicked} classList={{
				selected: deleteMode()
			}} >X</button>
			<button onClick={onParsePgn} >pgn</button>
			<button onClick={onNext} >&gt;|</button>

		</div>
		<Toolbar
			selectedPiece={selectedPiece}
			setSelectedPiece={setSelectedPiece}
			color='white'
		/>
		<Toolbar
			selectedPiece={selectedPiece}
			setSelectedPiece={setSelectedPiece}
			color='black'
		/>
	</div>);



	// api.newPiece(WhitePawn, 'e2');
	// const setup = parseFen('r1bqkbnr/ppp2Qpp/2np4/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4').unwrap();
	// const pos = Chess.fromSetup(setup).unwrap();

	// Function to add a piece to the board
	// function addPiece(square: string, piece: string) {
	// 	chessboard.set({
	// 		fen: updateFen(chessboard, square, piece)
	// 	});
	// }

	// // Function to remove a piece from the board
	// function removePiece(square: string) {
	// 	chessboard.set({
	// 		fen: updateFen(chessboard, square, null)
	// 	});
	// }

	// Helper function to update the FEN string
	// function updateFen(board: Api, square: string, piece: string | null): string {
	// 	// update fen using chessops
	// 	const fen = board.getFen();
	// 	const setup = parseFen(fen).unwrap();
	// 	const sq = parseSquare(square);
	// 	setup.board.set(sq, piece);		
	// 	// return the new fen from the updated setup
	// 	return makeFen(setup);

	// }
}

