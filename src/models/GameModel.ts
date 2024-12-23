import { Move, Chess } from "chessops";
import { scalachessCharPair } from "chessops/compat";
import { parseFen } from "chessops/fen";
import { Game, PgnNodeData, Node, isChildNode, extend, startingPosition, makePgn } from "chessops/pgn";
import { makeSan } from "chessops/san";
import { PlyData, AnyNode, Initial, Players, Metadata, Path, nodeAtPathFrom, isMoveNode, Ply, Headers, makeMetadata, makeMoves, makeGameInternal } from "./pgn";
import { get } from "es-toolkit/compat";

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

    private clone(): GameModel {
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

    updateComment(path: Path, index: number, comment: string) : GameModel {
        const pgnNode = this.findPgnNode(path);
        if (!pgnNode) return this;
        if (isChildNode(pgnNode)) {
            const comments = pgnNode.data.comments || [];
            comments[index] = comment;
            pgnNode.data.comments = comments;
            
        } else {
            const comments =  this.game.comments || [];
            comments[index] = comment;
            this.game.comments = comments;
        }
        return this.getNewGameModel();

    }

    insertComment(path: Path, comment: string, before:boolean = false){
        if(before) path = path.previous();
        const pgnNode = this.findPgnNode(path);
        if (!pgnNode) return this;
        
        if (isChildNode(pgnNode)) {
            const comments = pgnNode.data.comments || [];
            comments.splice(0, 0, comment);
            pgnNode.data.comments = comments;
        } else {
            const comments =  this.game.comments || [];
            comments.splice(0, 0, comment);
            this.game.comments = comments;
        }
        return this.getNewGameModel();
    }

    pgn() {
        return makePgn(this.game);
    }
}


