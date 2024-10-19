import { Chessground } from 'chessground';
import { Config } from 'chessground/config';
// import { Chess } from 'chessops/chess';
// import { parsePgn, PgnNodeData, startingPosition, Game } from 'chessops/pgn';
// import { parseSquare, parseUci } from 'chessops';
import { Accessor, createSignal, onMount, Setter } from 'solid-js';
import { Api } from 'chessground/api';
// import { Toolbar } from './Piece';
// import { Piece } from 'chessground/types';
// import { makeFen, parseFen } from 'chessops/fen';
// import { Chess, pgn } from 'chessops';
// import { parseSan } from 'chessops/san';


interface ChessboardProps {
	config?: Config;
	setApi?: Setter<Api | undefined>;
	onChessboardClick?: (e: MouseEvent) => void;
}

export function Chessboard(props: ChessboardProps) {
	// create a div under el and set its width and height to 100%

	let wrapper!: HTMLDivElement;
	// const [api, setApi] = createSignal<Api | undefined>(undefined);
	// const [selectedPiece, setSelectedPiece] = createSignal<Piece | null>(null);
	// const [deleteMode, setDeleteMode] = createSignal(false);
	// const [boarddaa, setData] = createSignal<BoardData | undefined>(boardData);


	/*
	const onSave = () => {
		const cg = api();
		if (!cg) {
			return;
		}
		
		// saveDataIntoBlock(app, { fen: cg.getFen() }, ctx);
	}
	*/

	/*

	const onDeleteModeClicked = () => {
		setDeleteMode(!deleteMode());
		setSelectedPiece(null);
	}

	*/

	const onChessboardClick = (e: MouseEvent) => {
		props.onChessboardClick?.(e);
	}

	/*

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

	*/

	/*



	*/

	/*
	

	*/



	// 'r2q2k1/1p6/p2p4/2pN1rp1/N1Pb2Q1/8/PP1B4/R6K b - - 2 25'

	// const config: Config = {
	// 	// fen: boardData?.fen,
	// 	fen: 'r2q2k1/1p6/p2p4/2pN1rp1/N1Pb2Q1/8/PP1B4/R6K b - - 2 25',
	// 	draggable: {
	// 		enabled: true
	// 	},
	// 	movable: {
	// 		free: true,  // Allow pieces to be placed freely
	// 		color: 'both', // Both sides can move pieces
	// 	},
	// 	selectable: {
	// 		enabled: true, // Allow pieces to be selectable

	// 	},
	// 	highlight: {
	// 		lastMove: true,
	// 		check: true,
	// 	},

	// };

	// solid-js onLoad equivalent
	onMount(async () => {
		if (!wrapper) {
			return;
		}
		const api = Chessground(wrapper, props.config);
		// api.set({
		// 	movable: {
		// 		events: {
		// 			after: (orig, dest, metadata) => {
		// 				console.log(orig, dest, metadata);
		// 				console.log(api.getFen());
		// 			}
		// 		}
		// 	}
		// });
		props.setApi?.(api);
	});


	return (<div class="chess-container">
		<div ref={wrapper} class="chessboard" onclick={onChessboardClick} >

		</div>
		{/* <div>
			<button onClick={onSave} >Save</button>
			<button onClick={onDeleteModeClicked} classList={{
				selected: deleteMode()
			}} >X</button>
			
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
		/> */}
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

