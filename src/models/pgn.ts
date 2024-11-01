import { FEN } from "chessground/types";
import { Color, Move, Position } from "chessops";
import { CommentShape, Node, ChildNode } from "chessops/pgn";

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

    static root = new Path('');
}

export interface MoveData extends InitialOrMove {
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



export type AnyNode = Node<MoveData>;
export type MoveNode = ChildNode<MoveData>;

// immutable
export class GameModel {
    mainline: MoveData[];

    constructor(
        readonly initial: Initial,
        readonly moves: AnyNode,
        readonly players: Players,
        readonly metadata: Metadata,
    ) {
        this.mainline = Array.from(this.moves.mainline());
    }

    nodeAt = (path: Path): AnyNode | undefined => nodeAtPathFrom(this.moves, path);

    dataAt = (path: Path): MoveData | Initial | undefined => {
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
}

const childById = (node: AnyNode, id: Id): MoveNode | undefined =>
    node.children.find(c => c.data.path.last() == id);

const nodeAtPathFrom = (node: AnyNode, path: Path): AnyNode | undefined => {
    if (path.empty()) return node;
    const child = childById(node, path.head());
    return child ? nodeAtPathFrom(child, path.tail()) : undefined;
};

export const isMoveNode = (n: AnyNode): n is MoveNode => 'data' in n;
export const isMoveData = (d: InitialOrMove): d is MoveData => 'uci' in d;