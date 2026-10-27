import { Component, createResource, Show, untrack, useContext } from "solid-js";
import { explainPieceValues, explainThreats } from "../../engine/explainer";
import BoardText from "./BoardText";
import { EngineInfo } from "../../engine/engineinterfaces";
import { PlyData } from "../../models/pgn";
import { CLASS_NAGS, ReviewedMove } from "../../models/review";
import {
    describeOutcome,
    judgeMove,
    lineOutcome,
    scoreToEvaluation,
} from "../../models/whatif";
import { GameContext } from "./GameContext";
import { NagIcon } from "./Ply";
import { explainMove } from "../../models/explain";
import "./WhatIf.scss";

const sameFen = (a?: string, b?: string) =>
    !!a &&
    !!b &&
    a.split(" ").slice(0, 4).join(" ") === b.split(" ").slice(0, 4).join(" ");

/**
 * How the move just played compares with the engine's choice, and where the engine's line goes
 * from here: try a candidate move on the board and read why it works or fails.
 */
const WhatIf: Component<{ engineInfo: EngineInfo[] }> = (props) => {
    const {
        gameSignal: [game],
        currentPathSignal: [currentPath],
        analyzedFen,
        evaluationAt,
        lineAt,
    } = useContext(GameContext)!;

    const move = () => {
        const path = currentPath();
        const data = path && !path.empty() ? game()?.dataAt(path) : undefined;
        return data && "san" in data ? (data as PlyData) : undefined;
    };
    const before = () => {
        const path = currentPath();
        return path && game()?.dataAt(path.previous());
    };
    // the current search, if it is for this position
    const best = () =>
        sameFen(analyzedFen(), move()?.fen) ? props.engineInfo[0] : undefined;

    const verdict = (): ReviewedMove | undefined => {
        const m = move();
        const b = before();
        if (!m || !b) return undefined;
        const evBefore = evaluationAt(b.fen) ?? b.evaluation;
        const info = best();
        const evAfter =
            (info?.score && scoreToEvaluation(info.score)) ??
            evaluationAt(m.fen) ??
            m.evaluation;
        if (!evBefore || !evAfter) return undefined;
        return judgeMove(b.fen, evBefore, m.fen, evAfter, m.san);
    };

    const outcome = () => {
        const m = move();
        const pv = best()?.pv;
        const mover = before()?.turn;
        return m && pv && mover ? lineOutcome(m.fen, pv, mover) : undefined;
    };

    // what the move stops and threatens: two short searches by the explainer engine, in the
    // background (keyed by position and move, so a deepening analysis does not restart them)
    const [threats] = createResource(
        () => {
            const m = move();
            const b = before();
            return m && b ? { fen: b.fen, uci: m.uci } : undefined;
        },
        ({ fen, uci }) =>
            explainThreats(
                fen,
                uci,
                untrack(() => best()?.pv),
            ),
    );

    // Stockfish's piece values before and after the move (nothing for other engines)
    const [values] = createResource(
        () => {
            const m = move();
            const b = before();
            return m && b ? { fenBefore: b.fen, fenAfter: m.fen } : undefined;
        },
        async ({ fenBefore, fenAfter }) => ({
            before: await explainPieceValues(fenBefore),
            after: await explainPieceValues(fenAfter),
        }),
    );

    // why, in words: facts, ideas, the opponent's answer and the better move
    const explanation = () => {
        const m = move();
        const b = before();
        const v = verdict();
        if (!m || !b || !v) return [];
        const bestUci = (evaluationAt(b.fen) ?? b.evaluation)?.ext;
        return explainMove({
            fenBefore: b.fen,
            uci: m.uci,
            verdict: v,
            bestUci: typeof bestUci === "string" ? bestUci : undefined,
            bestPv: lineAt(b.fen),
            replyPv: best()?.pv,
            threats: threats.latest,
            values: values.latest,
        });
    };
    const isBad = () =>
        ["inaccuracy", "mistake", "blunder"].includes(verdict()?.class ?? "");

    return (
        <Show when={move()}>
            <div class="what-if">
                <Show
                    when={explanation().length}
                    fallback={
                        <div class="what-if-hint">
                            Step back one move and let the engine look at the
                            position before {move()!.san} to judge it.
                        </div>
                    }
                >
                    <div class="what-if-verdict">
                        <Show when={CLASS_NAGS[verdict()!.class]}>
                            {(nag) => <NagIcon nag={nag()} />}
                        </Show>
                        <BoardText
                            text={explanation().join(" ")}
                            fens={() =>
                                [before()?.fen, move()?.fen].filter(
                                    (f): f is string => !!f,
                                )
                            }
                        />
                    </div>
                </Show>
                {/* a bad move's explanation already follows the reply line */}
                <Show when={!isBad() && outcome()?.sans.length}>
                    <div class="what-if-line">
                        Then{" "}
                        <BoardText
                            text={outcome()!.sans.join(" ")}
                            fens={() => [move()!.fen]}
                        />
                        : <strong>{describeOutcome(outcome()!)}</strong>
                    </div>
                </Show>
            </div>
        </Show>
    );
};

export default WhatIf;
