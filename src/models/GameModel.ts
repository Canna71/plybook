import { Move, Chess, parseSquare, makeSquare } from "chessops";
import { scalachessCharPair } from "chessops/compat";
import { parseFen } from "chessops/fen";
import { Game, PgnNodeData, Node, isChildNode, extend, makePgn, CommentShapeColor, makeComment, CommentShape, parseComment } from "chessops/pgn";
import { makeSan } from "chessops/san";
import { PlyData, AnyNode, Initial, Players, Metadata, Path, nodeAtPathFrom, isMoveNode, Ply, makeGameInternal } from "./pgn";
import { DrawShape } from "chessground/draw";

// immutable ?

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

    // private clone(): GameModel {
    //     return new GameModel(this.initial, this.moves, this.players, this.metadata, this.game);
    // }

    nodeAt = (path: Path): AnyNode | undefined => nodeAtPathFrom(this.moves, path);

    dataAt = (path: Path): PlyData | Initial | undefined => {
        const node = this.nodeAt(path);
        return node ? (isMoveNode(node) ? node.data : this.initial) : undefined;
    };

    title = () => this.players.white.name
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

    pathAtMainlinePly = (ply: Ply | 'last') => ply == 0
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

    };

    *allPgnNodes(n: Node<PgnNodeData>): Iterable<Node<PgnNodeData>> {
        yield n;
        for (const c of n.children) {
            yield* this.allPgnNodes(c);
        }
    }

    applyMove(path: Path, move: Move): [GameModel, Path] {
        const pos = this.getPosition(path);

        const san = makeSan(pos, move);
        const moveId = scalachessCharPair(move);
        const pgnNode = this.findPgnNode(path);
        extend(pgnNode!, [{ san }]);
        // this.updateMoves();
        const newGameModel = this.getNewGameModel();
        const newPath = path.append(moveId);
        return [newGameModel, newPath];
    }

    private getNewGameModel(): GameModel {

        // const moves = this.updateMoves();
        console.log("this.game.pgn", this.pgn());
        // return new GameModel(this.initial, moves, this.players, this.metadata, this.game);
        return makeGameInternal(this.game);
    }

    private getPosition(path: Path) {
        const data = this.dataAt(path);
        const fen = data?.fen;
        const setup = parseFen(fen!).unwrap();
        const pos = Chess.fromSetup(setup).unwrap();
        return pos;
    }

    // private updateMoves(): Node<PlyData> {
    //     const start = startingPosition(this.game.headers).unwrap();
    //     const headers: Headers = new Map(Array.from(this.game.headers, ([key, value]) => [key.toLowerCase(), value]));
    //     const metadata = makeMetadata(headers);
    //     return makeMoves(start, this.game.moves, metadata);
    // }

    private changeCommentText(comment: string, text: string): string {
        const c = parseComment(comment);
        c.text = text;
        return makeComment(c);
    }

    updateComment(path: Path, index: number, comment: string, starting: boolean = false): GameModel {
        console.log("updateComment", path, index, comment, starting);
        const pgnNode = this.findPgnNode(path);
        if (!pgnNode) return this;
        console.log(pgnNode);
        if (isChildNode(pgnNode)) {
            const comments = (starting ? pgnNode.data.startingComments : pgnNode.data.comments) || []
            comments[index] = this.changeCommentText(comments[index], comment);

        } else {
            const comments = this.game.comments || [];
            comments[index] = this.changeCommentText(comments[index], comment);
        }
        return this.getNewGameModel();

    }

    insertComment(path: Path, comment: string, before: boolean = false) {
        console.log("insertComment", path, comment, before);
        if (before) path = path.previous();
        const pgnNode = this.findPgnNode(path);
        if (!pgnNode) return this;

        if (isChildNode(pgnNode)) {
            const comments = pgnNode.data.comments || [];
            comments.splice(0, 0, comment);
            // pgnNode.data.comments = comments;
        } else {
            const comments = this.game.comments || [];
            comments.splice(0, 0, comment);
            // this.game.comments = comments;
        }
        return this.getNewGameModel();
    }

    deleteComment(path: Path, index: number, starting: boolean = false) {
        console.log("deleteComment", path, index, starting);
        const pgnNode = this.findPgnNode(path);
        const node = nodeAtPathFrom(this.moves, path);

        if (!pgnNode || !node) return this;
        const shapes = isChildNode(node) ? node.data.shapes : this.initial.shapes;
        if (isChildNode(pgnNode)) {
            let comments = pgnNode.data[starting ? "startingComments" : "comments"] || [];
            comments = this.removeCommentAtIndex(comments, index, shapes);
            pgnNode.data[starting ? "startingComments" : "comments"] = comments;
        } else {
            let comments = this.game.comments || [];
            comments = this.removeCommentAtIndex(comments, index, shapes);
            this.game.comments = comments;
        }
        return this.getNewGameModel();
    }

    private removeCommentAtIndex(comments: string[], index: number, shapes: CommentShape[]) {
        comments = this.mergeShapes(comments, []);
        comments.splice(index, 1);
        comments = this.mergeShapes(comments, shapes.map(s => {
            const orig = makeSquare(s.from);
            const dest = makeSquare(s.to);
            const brush = s.color;
            return { orig, dest, brush } as DrawShape;
        }));
        return comments;
    }

    deleteFrom(path: Path) {
        console.log("deleteFrom", path);
        const pgnNode = this.findPgnNode(path);
        if (!pgnNode) return this;
        if (isChildNode(pgnNode)) {
            const parent = this.findPgnNode(path.previous());
            if (!parent) return this;
            parent.children = parent.children.filter(c => c !== pgnNode);
        } else {
            return this;
        }
        return this.getNewGameModel();
    }

    public annotate(path: Path, nag: number): GameModel {
        console.log("annotate", path, nag);
        const pgnNode = this.findPgnNode(path);
        if (!pgnNode) return this;
        if (isChildNode(pgnNode)) {
            pgnNode.data.nags = pgnNode.data.nags || [];
            if (nag > 0) {
                if (!pgnNode.data.nags.includes(nag)) {
                    pgnNode.data.nags.push(nag);
                } else {
                    pgnNode.data.nags = pgnNode.data.nags.filter(n => n !== nag);
                }
            } else {
                pgnNode.data.nags = [];
            }
        }
        return this.getNewGameModel();
    }

    private  mergeShapes(oldComments: string[] | undefined, shapes: DrawShape[]):string[] {
        const cShapes = shapes.map(s => {
            const from = parseSquare(s.orig)!;
            const to = s.dest && parseSquare(s.dest)!;
            const color = s.brush! as CommentShapeColor;
            return { from, to, color } as CommentShape;
        });
        const comments = (oldComments || [""]).map(parseComment);
        const tc = comments.map((c, i) => {
            c.shapes = i === 0 ? cShapes : [];
            return makeComment(c);
        });
        return tc;
    }

    public updateShapes(path: Path, shapes: DrawShape[]) {
        console.log("updateShapes", shapes);
        const pgnNode = this.findPgnNode(path);
        const node = nodeAtPathFrom(this.moves, path);
        if (!pgnNode || !node) return this;
        console.log(node, pgnNode);
        if (isChildNode(node) && isChildNode(pgnNode)) {
            pgnNode.data.comments = this.mergeShapes(pgnNode.data.comments, shapes);
        } else {
            this.game.comments = this.mergeShapes(this.game.comments, shapes);
        }
        return this.getNewGameModel();
    }

    pgn() {
        return makePgn(this.game);
    }
}


