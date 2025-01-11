import {
    IconPlayerSkipBackFilled,
    IconPlayerSkipForwardFilled,
    IconPlayerTrackNextFilled,
    IconPlayerTrackPrevFilled,
} from "@tabler/icons-solidjs";
import { Accessor, Component, Setter, Show } from "solid-js";
import { Path } from "../../models/pgn";
import { GameModel } from "../../models/GameModel";
import Button from "../common/Button";

export type ButtonBarProps = {
    game: Accessor<GameModel | undefined>;
    currentPath: Accessor<Path | undefined>;
    setCurrentPath: Setter<Path | undefined>;
};

const ButtonBar: Component<ButtonBarProps> = ({
    game,
    currentPath,
    setCurrentPath,
}) => {
    const nextNode = () => {
        const path = currentPath();
        const nextNode = (path && game()?.nodeAt(path))?.children[0];
        return nextNode;
    };

    const previousPath = () => {
        const path = currentPath();
        if (!path) {
            return;
        }
        return path.previous();
    };

    const canMoveNext = () => {
        return !!nextNode();
    };

    const canGoBack = () => {
        const path = currentPath();
        return path && path.path.length > 1;
    };

    const onNext = () => {
        const next = nextNode();

        if (next) {
            setCurrentPath(next?.data.path);
        }
    };

    const onPrev = () => {
        const previous = previousPath();
        previous && setCurrentPath(previous);
    };

    const onRewind = () => {
        setCurrentPath(game()!.pathAtMainlinePly(0));
    };

    const canRewind = () => {
        const path = currentPath();

        return path && !game()?.pathAtMainlinePly(0).equals(path);
    };

    const onFastForward = () => {
        const g = game();
        if (!g) {
            return;
        }
        const path = g.pathAtMainlinePly(g.mainline.length);
        setCurrentPath(path);
    };

    const canFastForward = () => {
        const path = currentPath();
        const g = game();
        return (
            path &&
            g &&
            !g.pathAtMainlinePly(g.mainline.length - 1).equals(path)
        );
    };

    return (
        <Show when={game() && currentPath()}>
            <div class="pgnviewer-buttonbar buttons are-small">
                <Button onClick={onRewind} disabled={!canRewind()}>
                    <IconPlayerTrackPrevFilled />
                </Button>
                <Button onClick={onPrev} disabled={!canGoBack()}>
                    <IconPlayerSkipBackFilled />
                </Button>
                <Button onClick={onNext} disabled={!canMoveNext()}>
                    <IconPlayerSkipForwardFilled />
                </Button>
                <Button onClick={onFastForward} disabled={!canFastForward()}>
                    <IconPlayerTrackNextFilled />
                </Button>
            </div>
        </Show>
    );
};

export default ButtonBar;
