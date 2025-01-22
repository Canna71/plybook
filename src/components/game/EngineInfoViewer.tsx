import { batch, createMemo, createSignal, For, useContext } from "solid-js";
import { EngineInfo } from "../../engine/engineinterfaces";
import "./EngineInfoViewer.scss"; // Create and import your custom styles
import { GameContext } from "./GameContext";
import { Path, PlyData, sanToFan } from "../../models/pgn";
import { GameModel } from "../../models/GameModel";
import { toColor, useFenTooltip } from "../common/utils";
import { makeUci, parseUci, Position } from "chessops";
import { makeFen } from "chessops/fen";
import { makeSanAndPlay } from "chessops/san";
import { scalachessCharPair } from "chessops/compat";
import { IconChevronRight } from "@tabler/icons-solidjs";
import { PlyFan } from "../common/PlyFan";
import { takeWhile } from "es-toolkit";

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
            // if(!prevPos) return undefined;
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
                pos,
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

const PVMove = (props: { move: PlyData; onClick: (move: PlyData) => void }) => {
    const innerShowTooltip = useFenTooltip(true, props.move);

    const onClick = () => {
        props.onClick(props.move);
    };

    const moveNumber = () => {
        const ply = props.move.ply;
        const fullMoveNum = Math.ceil(ply / 2);
        const hm = ply % 2;
        return `${fullMoveNum}${hm === 0 ? "..." : "."} `;
    };

    return (
        <>
            <span
                onClick={onClick}
                onMouseEnter={innerShowTooltip}
                onMouseLeave={() => innerShowTooltip(undefined)}
                class="engine-info-pv-move"
            >
                {" "}
                <span class="engine-info-pv-number">{moveNumber()}</span>
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
    const { currentPathSignal: [currentPath, setCurrentPath], gameSignal: [game, setGame] } = useContext(GameContext)!;
    const [isExpanded, setIsExpanded] = createSignal(false);

    const line = createMemo(() => {
        return makeLine(info, currentPath()!, game()!);
    });

    const onMoveClicked = (move: PlyData) => {
        const l = line();
        // gets the moves in l until and included move using es-toolkit
        const moves = [...takeWhile(l, (m) => m !== move), move];
        
        const [newGameModel, newPath] = game()!.applyMoves(currentPath()!, moves.map((m) => m.move));
        batch(() => {
            setGame(newGameModel);
            setCurrentPath(newPath);
        });
    };

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
            {line().map((move) => {
                return <PVMove move={move} onClick={onMoveClicked} />;
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
