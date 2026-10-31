// The Review section of the analysis panel: review the whole game with the engine, then its
// accuracy, graph and key moments (Review.tsx).

import { Show, useContext } from "solid-js";
import { IconDeviceAnalytics } from "@tabler/icons-solidjs";
import Button from "../common/Button";
import Progress from "../common/Progress";
import Review from "./Review";
import { GameContext } from "./GameContext";

const ReviewPanel = () => {
    const { isReviewing, startReview, reviewProgress } =
        useContext(GameContext)!;

    return (
        <div class="review-panel">
            <Show
                when={!isReviewing()}
                fallback={
                    <div class="review-progress">
                        <Progress
                            class="progress is-primary is-small"
                            value={reviewProgress()?.current}
                            max={reviewProgress()?.total}
                        />
                        <span>
                            Analyzing position {reviewProgress()?.current ?? 0}{" "}
                            of {reviewProgress()?.total ?? 0}…
                        </span>
                    </div>
                }
            >
                <Button
                    class="is-small"
                    onClick={startReview}
                    title="Every move of the main line, judged by the engine (about a minute for 40 moves)"
                >
                    <IconDeviceAnalytics />
                    Review the game
                </Button>
                <Review />
            </Show>
        </div>
    );
};

export default ReviewPanel;
