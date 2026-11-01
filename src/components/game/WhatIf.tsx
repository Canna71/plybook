import { Component, createResource, Show, untrack, useContext } from "solid-js";
import CoachWords from "./CoachWords";
import {
    explainAlternatives,
    explainPieceValues,
    explainThreats,
} from "../../engine/explainer";
import { gameHistory, historyFor } from "../../models/gamehistory";
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
import { explainMoveFull, MoveExplanation } from "../../models/explain";
import { positionsBefore } from "./gamePosition";
import ExplanationEvidence from "./ExplanationEvidence";
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

    /** The evaluations before and after the move, from White's side, with their depths */
    const evaluations = () => {
        const m = move();
        const b = before();
        if (!m || !b) return undefined;
        const info = best();
        return {
            before: evaluationAt(b.fen) ?? b.evaluation,
            after:
                (info?.score && {
                    ...scoreToEvaluation(info.score),
                    depth: info.depth,
                }) ??
                evaluationAt(m.fen) ??
                m.evaluation,
        };
    };

    const verdict = (): ReviewedMove | undefined => {
        const m = move();
        const b = before();
        const ev = evaluations();
        if (!m || !b || !ev?.before || !ev.after) return undefined;
        return judgeMove(b.fen, ev.before, m.fen, ev.after, m.san);
    };

    /** The game's positions before the move's, oldest first: repetitions need them */
    const history = () => {
        const g = game();
        const p = currentPath();
        return g && p && !p.empty() ? positionsBefore(g, p.previous()) : [];
    };

    // where the line leads, counted from before the move: what a capture took is part of it
    // (after Bxc6 dxc6 the material is level, not a piece down), and so is what a sacrifice
    // gave. Shown from the answer on
    const outcome = () => {
        const m = move();
        const b = before();
        const pv = best()?.pv;
        if (!m || !b || !pv) return undefined;
        const o = lineOutcome(b.fen, [m.uci, ...pv], b.turn, 7);
        return o && { ...o, sans: o.sans.slice(1) };
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

    // the engine's two best lines before the move: was its best the only good move?
    const [alternatives] = createResource(
        () => {
            const g = game();
            const p = currentPath();
            const b = before();
            return g && p && !p.empty() && b
                ? {
                      fen: b.fen,
                      history: historyFor(gameHistory(g, p.previous()), b.fen),
                  }
                : undefined;
        },
        ({ fen, history }) => explainAlternatives(fen, history),
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

    // why, in words, with the evidence behind it (models/explain.ts, docs/EXPLANATIONS.md)
    const full = (): MoveExplanation | undefined => {
        const m = move();
        const b = before();
        const v = verdict();
        if (!m || !b || !v) return undefined;
        const bestUci = (evaluationAt(b.fen) ?? b.evaluation)?.ext;
        return explainMoveFull({
            fenBefore: b.fen,
            uci: m.uci,
            verdict: v,
            bestUci: typeof bestUci === "string" ? bestUci : undefined,
            bestPv: lineAt(b.fen),
            replyPv: best()?.pv,
            threats: threats.latest,
            values: values.latest,
            evaluations: evaluations(),
            history: history(),
            // the analysis searches with the game's moves (useChessEngine)
            engineSawGame: true,
            alternatives: alternatives.latest,
        });
    };
    const explanation = () => full()?.text ?? [];
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
                    <CoachWords
                        text={explanation().join(" ")}
                        fens={() =>
                            [before()?.fen, move()?.fen].filter(
                                (f): f is string => !!f,
                            )
                        }
                    />
                    <Show when={full()}>
                        {(x) => <ExplanationEvidence explanation={x()} />}
                    </Show>
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
