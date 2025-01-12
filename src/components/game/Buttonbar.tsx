import {
    IconPlayerSkipBackFilled,
    IconPlayerSkipForwardFilled,
    IconPlayerTrackNextFilled,
    IconPlayerTrackPrevFilled,
} from "@tabler/icons-solidjs";
import { Accessor, Component, createMemo, createSignal, Setter, Show, useContext } from "solid-js";
import { Path } from "../../models/pgn";
import { GameModel } from "../../models/GameModel";
import Button from "../common/Button";
import Modal from "../common/Modal";
import { GameContext } from "./GameContext";

export type ButtonBarProps = {
    // game: Accessor<GameModel | undefined>;
    // currentPath: Accessor<Path | undefined>;
    // setCurrentPath: Setter<Path | undefined>;
};

const ButtonBar: Component<ButtonBarProps> = ({
  
}) => {
    const [modalVisible, setModalVisible] = createSignal(false);
    const { gameSignal: [game],
        currentPathSignal: [currentPath, setCurrentPath],
        moveHintSignal: [moveHint],
        playingEngine
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
    
    const onHint = () => {
        setModalVisible(!modalVisible());
    };

    return (
        <>
            <Show when={game() && currentPath() && hasMoves()}>
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
                    <Button
                        onClick={onFastForward}
                        disabled={!canFastForward()}
                    >
                        <IconPlayerTrackNextFilled />
                    </Button>
                </div>

                
            </Show>
            <Show when={playingEngine() && moveHint()}> 
                <Button onClick={onHint}>Hint?</Button>
                <Modal isOpen={[modalVisible, setModalVisible]}>
                    <div>{moveHint()}</div>
                </Modal>
            </Show>
        </>
    );
};

export default ButtonBar;
