import {
    IconBulbFilled,
    IconPlayerSkipBackFilled,
    IconPlayerSkipForwardFilled,
    IconPlayerTrackNextFilled,
    IconPlayerTrackPrevFilled,
} from "@tabler/icons-solidjs";
import {
    Component,
    createMemo,
    Show,
    useContext,
} from "solid-js";
import Button from "../common/Button";
import { GameContext, HintType } from "./GameContext";

export type ButtonBarProps = {
    // game: Accessor<GameModel | undefined>;
    // currentPath: Accessor<Path | undefined>;
    // setCurrentPath: Setter<Path | undefined>;
};

const ButtonBar: Component<ButtonBarProps> = ({}) => {
    const {
        gameSignal: [game],
        currentPathSignal: [currentPath, setCurrentPath],
        moveHintSignal: [moveHint],
        playingEngine,
        hintTypeSignal: [_hintType, setHintType],
    } = useContext(GameContext)!;

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

    const hasMoves = createMemo(() => game()?.mainline?.length ?? 0 > 0);

    const onHintPiece = () => {
        // setModalVisible(!modalVisible());
        setHintType(HintType.Piece);
    };

    const onHintMove = () => {
        setHintType(HintType.Move);
    };

    return (
        <>
            <Show when={game() && currentPath() && hasMoves()}>
                <div class="pgnviewer-buttonbar are-small">
                    <Button onClick={onRewind} disabled={!canRewind()}>
                        <IconPlayerTrackPrevFilled />
                    </Button>
                    <Button onClick={onPrev} disabled={!canGoBack()}>
                        <IconPlayerSkipBackFilled />
                    </Button>
                    <Button onClick={onNext} disabled={!canMoveNext()}>
                        <IconPlayerSkipForwardFilled />
                    </Button>
                    <Button
                        onClick={onFastForward}
                        disabled={!canFastForward()}
                    >
                        <IconPlayerTrackNextFilled />
                    </Button>
                </div>
            </Show>
            <Show when={playingEngine() && moveHint()}>
                <div class="pgnviewer-buttonbar are-small">
                    <Button onClick={onHintPiece} title="Suggest Piece">
                        <IconBulbFilled /><span>Piece</span>
                    </Button>
                    <Button onClick={onHintMove} title="Suggest Move">
                        <IconBulbFilled /><span>Move</span>
                    </Button>
                </div>
            </Show>
        </>
    );
};

export default ButtonBar;
