import {
    batch,
    createMemo,
    createSignal,
    For,
    Show,
    useContext,
} from "solid-js";
import { EngineInfo } from "../../engine/engineinterfaces";
import "./EngineInfoViewer.scss"; // Create and import your custom styles
import { GameContext } from "./GameContext";
import { Path, PlyData, sanToFan } from "../../models/pgn";
import { toColor, useFenTooltip } from "../common/utils";
import { makeUci, parseUci, Position } from "chessops";
import { makeFen, parseFen } from "chessops/fen";
import { Chess } from "chessops";
import { describeThreat } from "../../models/threat";
import { makeSanAndPlay } from "chessops/san";
import { scalachessCharPair } from "chessops/compat";
import { IconChevronRight } from "@tabler/icons-solidjs";
import { PlyFan } from "../common/PlyFan";
import { takeWhile } from "es-toolkit";

type EngineInfoViewerProps = {
    engineInfo: EngineInfo[];
};

/** The line from `fen`, the position the engine searched; it stops at a move that does not fit
 * (an info that arrived for the previous position). */
function makeLine(info: EngineInfo, path: Path, fen: string) {
    const setup = parseFen(fen);
    const start = setup.isOk ? Chess.fromSetup(setup.value) : undefined;
    if (!start || start.isErr) return [];
    const pos = start.value;
    const pvMoves = takeWhile(
        info.pv || [],
        (() => {
            const check = pos.clone();
            return (uci: string) => {
                const move = parseUci(uci);
                if (!move || !check.isLegal(move)) return false;
                check.play(move);
                return true;
            };
        })(),
    );
    const line = pvMoves.reduce(
        ([prevPos, path, list], currentMove) => {
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
                fen: makeFen(pos.toSetup(), { epd: false }),
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

const EngineInfoLine = (props: EngineInfoLineProps) => {
    const {
        currentPathSignal: [currentPath, setCurrentPath],
        gameSignal: [game, setGame],
        analyzedFen,
    } = useContext(GameContext)!;
    const [isExpanded, setIsExpanded] = createSignal(false);

    const line = createMemo(() =>
        makeLine(props.info, currentPath()!, analyzedFen()),
    );
    // threat lines start from another position: they cannot be played on the board
    const playable = () =>
        sameFen(game()?.dataAt(currentPath()!)?.fen, analyzedFen());

    const onMoveClicked = (move: PlyData) => {
        if (!playable()) return;
        const l = line();
        // gets the moves in l until and included move using es-toolkit
        const moves = [...takeWhile(l, (m) => m !== move), move];

        const [newGameModel, newPath] = game()!.applyMoves(
            currentPath()!,
            moves.map((m) => m.move),
        );
        batch(() => {
            setGame(newGameModel);
            setCurrentPath(newPath);
        });
    };

    const classList = () => ({
        "engine-info-row": true,
        "engine-info-row-expanded": isExpanded(),
    });

    const scoreString = () => {
        if (props.info.score?.type === "cp") {
            return `${props.info.score.value / 100}`;
        } else {
            return `#${props.info.score?.value}`;
        }
    };

    return (
        <div classList={classList()}>
            {/* <div class="engine-info-depth">Depth: {info.depth}</div> */}
            <span class="engine-info-score has-background-info has-text-info-invert">
                {scoreString()}
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

/** FENs without the move counters, which a null move changes. */
const sameFen = (a?: string, b?: string) =>
    !!a &&
    !!b &&
    a.split(" ").slice(0, 4).join(" ") === b.split(" ").slice(0, 4).join(" ");

const EngineInfoViewer = (props: EngineInfoViewerProps) => {
    const { threatFen } = useContext(GameContext)!;
    const threat = () => {
        const fen = threatFen();
        const best = props.engineInfo[0];
        return fen && best
            ? describeThreat(fen, best.pv, best.score)
            : undefined;
    };
    return (
        <div
            class="engine-info-viewer"
            classList={{ "is-threat": !!threatFen() }}
        >
            <Show when={threatFen()}>
                <div class="engine-info-threat">
                    {threat()?.text ?? "Looking for threats…"}
                </div>
            </Show>
            <For each={props.engineInfo}>
                {(info) => <EngineInfoLine info={info} />}
            </For>
        </div>
    );
};

export default EngineInfoViewer;
