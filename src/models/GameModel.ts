import { Move, Chess, parseSquare  } from "chessops";
import { scalachessCharPair } from "chessops/compat";
import { parseFen } from "chessops/fen";
import { Game, PgnNodeData, Node, isChildNode, extend, makePgn, CommentShapeColor, makeComment, CommentShape, parseComment } from "chessops/pgn";
import { makeSan, parseSan } from "chessops/san";
import { PlyData, AnyNode, Initial, Players, Metadata, Path, nodeAtPathFrom, isMoveNode, Ply, makeGameInternal, EMPTY_COMMENT } from "./pgn";
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

    clone(): GameModel {
        return new GameModel(this.initial, this.moves, this.players, this.metadata, this.game);
    }

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

    // applyMove(path: Path, move: Move): [GameModel, Path] {
    //     const pos = this.getPosition(path);

    //     const san = makeSan(pos, move);
    //     const moveId = scalachessCharPair(move);
    //     const pgnNode = this.findPgnNode(path);
    //     extend(pgnNode!, [{ san }]);
    //     // this.updateMoves();
    //     const newGameModel = this.getNewGameModel();
    //     const newPath = path.append(moveId);
    //     return [newGameModel, newPath];
    // }

    applyMoves(path: Path, moves: Move[]): [GameModel, Path] {
        const pos = this.getPosition(path).clone();
        const pgnNode = this.findPgnNode(path);
        let node = pgnNode;
        let p = path;
        for(let i=0; i<moves.length; i++) {
            const move = moves[i];
            const san = makeSan(pos, move);
            // Note: this is to avoid different Ids for castling moves
            const move2 = parseSan(pos, san);
            pos.play(move2!);
            const moveId = scalachessCharPair(move2!);
            p = p.append(moveId);
            // extend(node!, [{ san }]);
            const children = node!.children;
            const existing = children.find(c => c.data.san === san);
            if(existing) {
                node = existing;
            } else {
               node = extend(node!, [{ san }]);
            }
        }
        const newGameModel = this.getNewGameModel();
        const newPath = p;
        console.log("newPath", newPath.path);
        return [newGameModel, newPath];
    }

    private getNewGameModel(): GameModel {

        // const moves = this.updateMoves();
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
        const pgnNode = this.findPgnNode(path);
        if (!pgnNode) return this;
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
        let isStarting = false;
        const originalPath = path;
        if (before) path = path.previous();
        let pgnNode = this.findPgnNode(path);
        let node = nodeAtPathFrom(this.moves, path);
        if (!pgnNode || !node) return this;
        const isVariation = node?.children.length > 1 && !node.children[0].data.path.equals(originalPath);
        if (isVariation) {
            pgnNode = this.findPgnNode(originalPath);
            node = nodeAtPathFrom(this.moves, originalPath);
            if(before) isStarting = true;
            if (!pgnNode || !node) return this;
        }
        const shapes = isChildNode(node) ? node.data.shapes : this.initial.shapes;
        const field = isStarting ? "startingComments" : "comments";
        if (isChildNode(pgnNode) && isChildNode(node)) {
            const comments = node.data[field].filter(t => t !== EMPTY_COMMENT) || [];
            comments.splice(0, 0, comment);
            pgnNode.data[field] = this.mergeShapes(comments,shapes,true);
            // pgnNode.data.comments = this.insertCommentInternal(node.data.comments, comment, shapes);
        } else {    
            const comments = this.game.comments || [];
            comments.splice(0, 0, comment);
            this.game.comments = this.mergeShapes(comments,shapes,true);
            // this.game.comments = this.insertCommentInternal(this.initial.comments, comment, shapes);
        }
        return this.getNewGameModel();
    }

    // private insertCommentInternal(comments: string[], comment:string, shapes: CommentShape[]) {
    //     const c = comments.filter(t => t !== EMPTY_COMMENT) || [];
    //     comments.splice(0, 0, comment);
    //     return this.mergeShapes(comments, shapes);
    // }

    deleteComment(path: Path, index: number, starting: boolean = false) {
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

    // private toDrawShapes(s: CommentShape[]): DrawShape[] {
    //     return s.map(s => {
    //         const orig = makeSquare(s.from);
    //         const dest = makeSquare(s.to);
    //         const brush = s.color;
    //         return { orig, dest, brush } as DrawShape;
    //     });
    // }

    private removeCommentAtIndex(comments: string[], index: number, shapes: CommentShape[]) {
        comments = this.mergeShapes(comments, []);
        comments.splice(index, 1);
        comments = this.mergeShapes(comments, shapes);
        return comments;
    }

    deleteFrom(path: Path) {
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

    private toCommentShapes(shapes: DrawShape[]): CommentShape[] {
        return shapes.map(s => {
            const from = parseSquare(s.orig)!;
            const to = s.dest && parseSquare(s.dest)!;
            const color = s.brush! as CommentShapeColor;
            return { from, to, color } as CommentShape;
        });
    }

    private  mergeShapes(oldComments: string[] | undefined, shapes: CommentShape[], allowEmpty:boolean=false):string[] {
        
        const comments = (oldComments || [""])
            .map(parseComment)
            .filter(c => c.text !== EMPTY_COMMENT);
        const tc = comments.map((c, i) => {
            c.shapes = i === 0 ? shapes : [];
            c.text = (i > 0 || allowEmpty) ? c.text : (
                c.text || EMPTY_COMMENT
            );
            return makeComment(c);
        });
        return tc;
    }

    public updateShapes(path: Path, shapes: DrawShape[]) {
        const pgnNode = this.findPgnNode(path);
        const node = nodeAtPathFrom(this.moves, path);
        if (!pgnNode || !node) return this;
        if (isChildNode(node) && isChildNode(pgnNode)) {
            pgnNode.data.comments = this.mergeShapes(pgnNode.data.comments, this.toCommentShapes(shapes));
        } else {
            this.game.comments = this.mergeShapes(this.game.comments, this.toCommentShapes(shapes));
        }
        return this.getNewGameModel();
    }

    pgn() {
        return makePgn(this.game);
    }

    // get a header from the game
    get headers() {
        return this.game.headers;
    }
    
}


