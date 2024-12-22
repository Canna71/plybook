import { FEN } from "chessground/types";
import { CommentShape, Node, ChildNode, PgnNodeData, transform, parseComment, parsePgn, startingPosition, Game, isChildNode, extend } from "chessops/pgn";
import { Color, makeUci, Position, Move, makeSquare, NormalMove, SquareName, Chess } from "chessops";
import { scalachessCharPair } from "chessops/compat";
import { makeSan, makeSanAndPlay, parseSan } from "chessops/san";
import { makeFen, parseFen } from "chessops/fen";
import { path } from "@tauri-apps/api";
import { getPosition } from "../chessboard/utils";

export interface Comments {
    texts: string[];
    shapes: CommentShape[];
    clock?: number;
    emt?: number;
}

export interface Metadata {
    externalLink?: string;
    timeControl?: {
        initial: number;
        increment: number;
    };
    orientation?: Color;
    result?: string;
}

export interface InitialOrMove {
    fen: FEN;
    turn: Color;
    check: boolean;
    comments: string[];
    shapes: CommentShape[];
    clocks: Clocks;
}

export type Clocks = {
    white?: number;
    black?: number;
};

export interface Initial extends InitialOrMove {
    pos: Position;
}


export interface MoveData {
    number: number;
    white?: PlyData;
    black?: PlyData;
}

export class State {
    constructor(
        readonly pos: Position,
        public path: Path,
        public clocks: Clocks,
    ) { }
    clone = () => new State(this.pos.clone(), this.path, { ...this.clocks });
}

export type Id = string;
export type San = string;
export type Fan = string;
export type Uci = string;
export type Ply = number;

export class Path {
    constructor(readonly path: string) { }

    size = () => this.path.length / 2;

    head = (): Id => this.path.slice(0, 2);

    // returns an invalid path doesn't starting from root
    tail = (): Path => new Path(this.path.slice(2));

    init = (): Path => new Path(this.path.slice(0, -2));

    last = (): Id => this.path.slice(-2);

    empty = () => this.path == '';

    contains = (other: Path): boolean => this.path.startsWith(other.path);

    isChildOf = (parent: Path): boolean => this.init() === parent;

    append = (id: Id) => new Path(this.path + id);

    equals = (other: Path) => this.path == other.path;

    previous = (): Path => new Path(this.path.slice(0, -2));

    static root = new Path('');
}

export interface PlyData extends InitialOrMove {
    path: Path;
    ply: number;
    move: Move;
    san: San;
    fan: Fan,
    uci: Uci;
    startingComments: string[];
    nags: number[];
    emt?: number;
    fen: FEN;
    pgnNode?: PgnNodeData;
}

// Type guard function to check if an object is PlyData
export function isPlyData(obj: any): obj is PlyData {
    // Check for specific properties that are unique to PlyData
    return obj && typeof obj === 'object' && 'move' in obj;
}

export type Headers = Map<string, string>;

export interface Player {
    name?: string;
    title?: string;
    rating?: number;
}
export interface Players {
    white: Player;
    black: Player;
}



export type AnyNode = Node<PlyData>;
export type MoveNode = ChildNode<PlyData>;

// immutable
export class GameModel {
    mainline: PlyData[];
    moves: AnyNode;
    constructor(
        readonly initial: Initial,
         moves: AnyNode,
        readonly players: Players,
        readonly metadata: Metadata,
        readonly game: Game<PgnNodeData>
    ) {
        this.moves = moves;
        this.mainline = Array.from(this.moves.mainline());
    }

    clone() : GameModel {
        return new GameModel(this.initial, this.moves, this.players, this.metadata, this.game);
    }

    nodeAt = (path: Path): AnyNode | undefined => nodeAtPathFrom(this.moves, path);

    dataAt = (path: Path): PlyData | Initial | undefined => {
        const node = this.nodeAt(path);
        return node ? (isMoveNode(node) ? node.data : this.initial) : undefined;
    };

    title = () =>
        this.players.white.name
            ? [
                this.players.white.title,
                this.players.white.name,
                'vs',
                this.players.black.title,
                this.players.black.name,
            ]
                .filter(x => x && !!x.trim())
                .join('_')
                .replace(' ', '-')
            : 'lichess-pgn-viewer';

    pathAtMainlinePly = (ply: Ply | 'last') =>
        ply == 0
            ? Path.root
            : this.mainline[Math.max(0, Math.min(this.mainline.length - 1, ply == 'last' ? 9999 : ply - 1))]
                ?.path || Path.root;

    hasPlayerName = () => !!(this.players.white?.name || this.players.black?.name);

    findPgnNode = (path: Path): Node<PgnNodeData> | undefined => {
        const node = nodeAtPathFrom(this.moves, path);
        if (!node) return undefined;
        let n = this.game.moves;
        if (isChildNode(node)) {
            for (let pn of this.allPgnNodes(n)) {
                if (isChildNode(pn)) {
                    if (pn.data === node.data.pgnNode) {
                        return pn;
                    }
                }
            }
        } else {
            return n;
        }

    }

    *allPgnNodes(n: Node<PgnNodeData>): Iterable<Node<PgnNodeData>> {
        yield n;
        for (const c of n.children) {
            yield* this.allPgnNodes(c);
        }
    }

    applyMove(path: Path, move: Move): Path {
        const pos = this.getPosition(path);

        const san = makeSan(pos, move);
        const moveId = scalachessCharPair(move);
        const pgnNode = this.findPgnNode(path);
        extend(pgnNode!, [{san}]);
        this.updateMoves();
        const newPath = path.append(moveId);
        return newPath;
    }

    private getPosition(path: Path) {
        const data = this.dataAt(path);
        const fen = data?.fen;
        const setup = parseFen(fen!).unwrap();
        const pos = Chess.fromSetup(setup).unwrap();
        return pos;
    }

    private updateMoves() {
        const start = startingPosition(this.game.headers).unwrap();
        const headers: Headers = new Map(Array.from(this.game.headers, ([key, value]) => [key.toLowerCase(), value]));
        const metadata = makeMetadata(headers);
        this.moves = makeMoves(start, this.game.moves, metadata);

    }
}

const childById = (node: AnyNode, id: Id): MoveNode | undefined =>
    node.children.find(c => c.data.path.last() == id);

const nodeAtPathFrom = (node: AnyNode, path: Path): AnyNode | undefined => {
    if (path.empty()) return node;
    const child = childById(node, path.head());
    return child ? nodeAtPathFrom(child, path.tail()) : undefined;
};

export const isMoveNode = (n: AnyNode): n is MoveNode => 'data' in n;
export const isMoveData = (d: InitialOrMove): d is PlyData => 'uci' in d;

const makeMoves = (start: Position, moves: Node<PgnNodeData>, metadata: Metadata) =>
    transform<PgnNodeData, PlyData, State>(moves, new State(start, Path.root, {}), makeMove(metadata));

function makeMove(metadata: Metadata): (ctx: State, data: PgnNodeData, childIndex: number) => PlyData | undefined {
    return (state, node, _index) => {
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
        const moveNode: PlyData = {
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
            pgnNode: node,
        };
        return moveNode;
    };
}

//@ts-ignore
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

export function toMove(move: NormalMove): [SquareName, SquareName] {
    return move && [makeSquare(move.from), makeSquare(move.to)]
}


export function makeGame(pgnString: string): GameModel {
    const game = parsePgn(pgnString)[0];
    const start = startingPosition(game.headers).unwrap();
    const setup = start.toSetup();
    const fen = makeFen(setup);
    // const moves = pgn.moves;
    const comments = parseComments(game.comments || []);
    const headers: Headers = new Map(Array.from(game.headers, ([key, value]) => [key.toLowerCase(), value]));
    const metadata = makeMetadata(headers);

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

    const gameModel = new GameModel(initial, moves, players, metadata, game);

    console.log("gameModel", gameModel);

    return gameModel;
}
