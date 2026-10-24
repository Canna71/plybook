import { Component, Show, useContext } from "solid-js";
import { EngineInfo } from "../../engine/engineinterfaces";
import { PlyData } from "../../models/pgn";
import { CLASS_NAGS, MoveClass, ReviewedMove } from "../../models/review";
import {
    describeOutcome,
    judgeMove,
    lineOutcome,
    scoreToEvaluation,
} from "../../models/whatif";
import { GameContext } from "./GameContext";
import { NagIcon } from "./Ply";
import "./WhatIf.scss";

const VERDICTS: Record<MoveClass, string> = {
    best: "is the engine's choice",
    good: "keeps the balance",
    inaccuracy: "is an inaccuracy",
    mistake: "is a mistake",
    blunder: "is a blunder",
};

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

    const text = () => {
        const v = verdict();
        if (!v) return undefined;
        const loss =
            v.class === "best" || v.loss < 1
                ? ""
                : ` (−${v.loss.toFixed(0)}% winning chances)`;
        const preferred =
            v.class !== "best" && v.bestSan
                ? `. The engine preferred ${v.bestSan}`
                : "";
        return `${v.san} ${VERDICTS[v.class]}${loss}${preferred}.`;
    };

    return (
        <Show when={move()}>
            <div class="what-if">
                <Show
                    when={text()}
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
                        {text()}
                    </div>
                </Show>
                <Show when={outcome()?.sans.length}>
                    <div class="what-if-line">
                        Then {outcome()!.sans.join(" ")}:{" "}
                        <strong>{describeOutcome(outcome()!)}</strong>
                    </div>
                </Show>
            </div>
        </Show>
    );
};

export default WhatIf;
