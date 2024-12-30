import { createSignal, For, useContext } from "solid-js";
import { EngineInfo } from "../../engine/engineinterfaces";
import "./EngineInfoViewer.scss"; // Create and import your custom styles
import { GameContext } from "./GameContext";
import { Path, PlyData, sanToFan } from "../../models/pgn";
import { GameModel } from "../../models/GameModel";
import {
    toColor,
    useFenTooltip,
} from "../common/utils";
import { makeUci, parseUci, Position } from "chessops";
import { makeFen } from "chessops/fen";
import { makeSanAndPlay } from "chessops/san";
import { scalachessCharPair } from "chessops/compat";
import { IconChevronRight } from "@tabler/icons-solidjs";
import { PlyFan } from "../common/PlyFan";

type EngineInfoViewerProps = {
    engineInfo: EngineInfo[];
};

function makeLine(info: EngineInfo, path: Path, game: GameModel) {
    const data = game.dataAt(path);
    const pos = data?.pos.clone();
    const pvMoves = info.pv || [];
    const line = pvMoves.reduce(
        ([prevPos, path, list], currentMove) => {
            // const move = parseSan(pos as Position, currentMove)!;
            const pos = prevPos.clone();
            const move = parseUci(currentMove)!;
            const moveId = scalachessCharPair(move);
            const nextPath = path.append(moveId);
            const san = makeSanAndPlay(pos, move); // note we have mutate posiiton!
            const fan = sanToFan(san, pos.turn);
            const setup = pos.toSetup();
            const ply =
                (setup.fullmoves - 1) * 2 + (pos.turn === "white" ? 0 : 1);

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
                nags: [],
                shapes: [],
                clocks: {},
                pos
                // emt: comments.emt,
                // pgnNode: node,
            };
            return [pos, nextPath, [...list, moveNode]] as [
                Position,
                Path,
                PlyData[],
            ];
        },
        [pos, path, []] as [Position, Path, PlyData[]],
    );

     return line[2];
}

const PVMove = (props: { move: PlyData }) => {
    const innerShowTooltip = useFenTooltip(true, props.move);

    const moveNumber = () => {
        const ply = props.move.ply;
        const fullMoveNum = Math.ceil(ply / 2);
        const hm = ply % 2;
        return `${fullMoveNum}${hm === 0 ? "..." : "."} `;
    }

    return (
        <>
            <span
                onMouseEnter={innerShowTooltip}
                onMouseLeave={() => innerShowTooltip(undefined)}
                class="engine-info-pv-move"
            >   <span class="engine-info-pv-number">{moveNumber()}</span>
                {/* <span class="enngine-info-pv-fan">{props.move.fan}</span> */}
                <PlyFan san={props.move.san} color={toColor(props.move.pos)} />
                
            </span>
        </>
    );
};

type EngineInfoLineProps = {
    info: EngineInfo;
};

const EngineInfoLine = ({ info }: EngineInfoLineProps) => {
    const { currentPath, game } = useContext(GameContext)!;
    const [isExpanded, setIsExpanded] = createSignal(false);


    const classList = () => ({
        "engine-info-row": true,
        "engine-info-row-expanded": isExpanded(),
    });

    return (
        <div classList={classList()}>
            {/* <div class="engine-info-depth">Depth: {info.depth}</div> */}
            <span class="engine-info-score has-background-info has-text-info-invert">
                {info.score?.type === "cp"
                    ? info.score.value / 100
                    : `#${info.score?.value}`}
            </span>
            {makeLine(info, currentPath()!, game()!).map((move) => {
                return <PVMove move={move} />;
            })}
            <button
                class="expand-line"
                onClick={() => setIsExpanded(!isExpanded())}
                // class={`${!isExpanded() ? "CollapseHeaderActive" : ""}`}
            >
                <span
                    class={`ChevronButton ${isExpanded() ? "ActiveChevron" : ""}`}
                >
                    <IconChevronRight />
                </span>
            </button>
        </div>
    );
};

const EngineInfoViewer = (props: EngineInfoViewerProps) => {
    return (
        <div class="engine-info-viewer">
            <For each={props.engineInfo}>
                {(info) => <EngineInfoLine info={info} />}
            </For>
        </div>
    );
};

export default EngineInfoViewer;
