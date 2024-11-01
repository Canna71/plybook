import { Chess, Color, makeUci, pgn, Position } from "chessops";
import { Chessboard } from "./Chessboard";
import { Config } from "chessground/config";
import { makeFen, parseFen } from 'chessops/fen';
import { makeSanAndPlay, parseSan } from 'chessops/san';
import { Accessor, Component, createEffect, createSignal } from "solid-js";
import { Game, parseComment, parsePgn, PgnNodeData, Node, startingPosition, transform } from "chessops/pgn";
import { Api } from "chessground/api";
import { Clocks, Comments, Initial, Metadata, MoveData, Path, State, Headers, Players, Player, GameModel } from "../models/pgn";
import { scalachessCharPair } from "chessops/compat";

// see: https://github.com/lichess-org/pgn-viewer


// PgnViwer options

export type PgnViewerOptions = {
	pgn: Accessor<string | undefined>;

}

function makeMetadata(headers: Headers): Metadata {
	const site = headers.get('source') || headers.get('site');
	const tcs = headers
		.get('timecontrol')
		?.split('+')
		.map(x => parseInt(x));
	const timeControl =
		tcs && tcs[0]
			? {
				initial: tcs[0],
				increment: tcs[1] || 0,
			}
			: undefined;
	const orientation = headers.get('orientation');
	return {
		externalLink: site && site.match(/^https?:\/\//) ? site : undefined,
		timeControl,
		orientation: orientation === 'white' || orientation === 'black' ? orientation : undefined,
		result: headers.get('result') || undefined,
	};
}

const makeClocks = (prev: Clocks, turn: Color, clk?: number): Clocks =>
	turn == 'white' ? { ...prev, black: clk } : { ...prev, white: clk };

function sanToFan(san: string, turn: Color): string {
    // Define the mapping from SAN piece letters to FAN symbols

	function isPiece(letter: string): boolean {
		return 'KQRBN'.includes(letter);
	}

    const fanMap: { [key: string]: string } = {
        K: '♔',  // King
        Q: '♕',  // Queen
        R: '♖',  // Rook
        B: '♗',  // Bishop
        N: '♘',  // Knight
		// black pieces
		k: '♚',  // King
		q: '♛',  // Queen
		r: '♜',  // Rook
		b: '♝',  // Bishop
		n: '♞',  // Knight

        // Pawns do not need an entry, as they are not represented by a letter in SAN
    };

    // Convert SAN notation to FAN by replacing each piece letter with its corresponding symbol
    let fan = '';
    for (const char of san) {
		const lookup = turn === 'white' ? char.toUpperCase() : char.toLowerCase();
        fan += isPiece(char) ? fanMap[lookup] : char;  // Replace piece letter or leave character as-is if no match
    }

    return fan;
}



const makeMoves = (start: Position, moves: Node<PgnNodeData>, metadata: Metadata) =>
	transform<PgnNodeData, MoveData, State>(moves, new State(start, Path.root, {}), (state, node, _index) => {
		const move = parseSan(state.pos, node.san);
		if (!move) return undefined;
		const moveId = scalachessCharPair(move);
		const path = state.path.append(moveId);
		const san = makeSanAndPlay(state.pos, move);
		const fan = sanToFan(san, state.pos.turn);
		state.path = path;
		const setup = state.pos.toSetup();
		const comments = parseComments(node.comments || []);
		const startingComments = parseComments(node.startingComments || []);
		const shapes = [...comments.shapes, ...startingComments.shapes];
		const ply = (setup.fullmoves - 1) * 2 + (state.pos.turn === 'white' ? 0 : 1);
		let clocks = (state.clocks = makeClocks(state.clocks, state.pos.turn, comments.clock));
		if (ply < 2 && metadata.timeControl)
			clocks = {
				white: metadata.timeControl.initial,
				black: metadata.timeControl.initial,
				...clocks,
			};
		const moveNode: MoveData = {
			path,
			ply,
			move,
			san,
			fan,
			uci: makeUci(move),
			fen: makeFen(state.pos.toSetup()),
			turn: state.pos.turn,
			check: state.pos.isCheck(),
			comments: comments.texts,
			startingComments: startingComments.texts,
			nags: node.nags || [],
			shapes,
			clocks,
			emt: comments.emt,
		};
		return moveNode;
	});

function makePlayers(headers: Headers, metadata: Metadata): Players {
	const get = (color: Color, field: string): string | undefined => {
		const raw = headers.get(`${color}${field}`);
		return raw == '?' || raw == '' ? undefined : raw;
	};
	const makePlayer = (color: Color): Player => {
		const name = get(color, '');
		return {
			name,
			title: get(color, 'title'),
			rating: parseInt(get(color, 'elo') || '') || undefined,
		};
	};
	return {
		white: makePlayer('white'),
		black: makePlayer('black'),
	};
}

function makeGame(pgnString: string): [Game<PgnNodeData>, string] {
	const game = parsePgn(pgnString)[0];

	const start = startingPosition(game.headers).unwrap();
	const setup = start.toSetup();
	const fen = makeFen(setup);
	// const moves = pgn.moves;
	const comments = parseComments(game.comments || []);
	console.log(comments);
	const headers: Headers = new Map(Array.from(game.headers, ([key, value]) => [key.toLowerCase(), value]));
	const metadata = makeMetadata(headers);
	console.log("metadata", metadata);

	console.log(game, start, setup, fen);

	const initial: Initial = {
		fen,
		turn: start.turn,
		check: start.isCheck(),
		pos: start.clone(),
		comments: comments.texts,
		shapes: comments.shapes,
		clocks: {
			white: metadata.timeControl?.initial || comments.clock,
			black: metadata.timeControl?.initial || comments.clock,
		},
	};
	const moves = makeMoves(start, game.moves, metadata);
	const players = makePlayers(headers, metadata);

	const gameModel = new GameModel(initial, moves, players, metadata);

	console.log(gameModel);

	return [game, fen];
}

function parseComments(strings: string[]): Comments {
	const comments = strings.map(parseComment);
	const reduceTimes = (times: Array<number | undefined>) =>
		times.reduce<number | undefined>((last, time) => (typeof time == undefined ? last : time), undefined);
	return {
		texts: comments.map(c => c.text).filter(t => !!t),
		shapes: comments.flatMap(c => c.shapes),
		clock: reduceTimes(comments.map(c => c.clock)),
		emt: reduceTimes(comments.map(c => c.emt)),
	};
};

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