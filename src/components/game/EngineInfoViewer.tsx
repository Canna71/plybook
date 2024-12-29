import { Accessor, For, useContext } from "solid-js";
import { EngineInfo } from "../../engine/engineinterfaces";
import "./EngineInfoViewer.scss"; // Create and import your custom styles
import { GameContext } from "./GameContext";
import { Path, PlyData, sanToFan, State } from "../../models/pgn";
import { GameModel } from "../../models/GameModel";
import { getPosition, getPositionFromData, makeMove } from "../common/utils";
import { Chess, makeUci, parseUci, Position } from "chessops";
import { makeFen, parseFen } from "chessops/fen";
import { makeSanAndPlay, parseSan } from "chessops/san";
import { scalachessCharPair } from "chessops/compat";

type EngineInfoViewerProps = {
    engineInfo: EngineInfo[];
};

function makeLine(info: EngineInfo, path: Path, game: GameModel) {
    const data = game.dataAt(path);
    const pos = getPositionFromData(data);

    const pvMoves = info.pv || [];
    const line = pvMoves.reduce(
        ([pos,path,list], currentMove) => {
            // const move = parseSan(pos as Position, currentMove)!;
            const move = parseUci(currentMove)!;
            const moveId = scalachessCharPair(move);
            const nextPath = path.append(moveId);
            const san = makeSanAndPlay(pos, move); // note we have mutate posiiton!
            const fan = sanToFan(san, pos.turn);
            const setup = pos.toSetup();
            const ply = (setup.fullmoves - 1) * 2 + (pos.turn === 'white' ? 0 : 1);

            const moveNode: PlyData = {
                path,
                ply,
                move,
                san,
                fan,
                uci: makeUci(move),
                fen: makeFen(pos.toSetup()),
                turn: pos.turn,
                check: pos.isCheck(),
                comments: [],
                startingComments: [],
                nags:  [],
                shapes: [],
                clocks: {}
                // emt: comments.emt,
                // pgnNode: node,
            };
            return [pos, nextPath, [...list, moveNode]] as [Position, Path, PlyData[]];
        },
        [pos, path, []] as [Position, Path, PlyData[]],
    );
    return line[2];
}

const EngineInfoViewer = (props: EngineInfoViewerProps) => {
    const { currentPath, game } = useContext(GameContext)!;

    
    return (
        <div class="engine-info-viewer">
            <For each={props.engineInfo}>
                {(info) => (
                    <div class="engine-info-row">
                        {/* <div class="engine-info-depth">Depth: {info.depth}</div> */}
                        <span class="engine-info-score has-background-info has-text-info-invert">
                            {info.score?.type === "cp"
                                ? info.score.value / 100
                                : `#${info.score?.value}`}
                        </span>{
                            makeLine(info, currentPath()!, game()!).map((move) => {
                                return (
                                    <span class="engine-info-pv-move">{move.fan}</span>
                                );
                            })
                        }
                        
                    </div>
                )}
            </For>
        </div>
    );
};

export default EngineInfoViewer;


