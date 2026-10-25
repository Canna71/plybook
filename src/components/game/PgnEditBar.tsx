import {
    Component,
    useContext,
    batch,
    Show,
    Accessor,
    createSignal,
} from "solid-js";
import Button from "../common/Button";
import { GameContext } from "./GameContext";
import { updateGameFromPgnString, useFen } from "../common/utils";
import { StartingPositionIcon } from "../common/Icons";
import {
    IconBrackets,
    IconCheck,
    IconCopy,
    IconGif,
    IconPhotoDown,
    IconPlayerPlayFilled,
    IconSwitchVertical,
    IconTextPlus,
} from "@tabler/icons-solidjs";
import { boardGif, boardPng, copyPng } from "../../export/boardexport";
import { frameAt, lineFrames } from "../../models/boardframes";
import { Path } from "../../models/pgn";
import { saveExport } from "../../storage/exports";
import { makeErrorToast, makeToast } from "../common/Toast";
import { useNavigate } from "@solidjs/router";

export enum ViewMode {
    STARTING_POSITION,
    MOVES,
    PGN,
}

type PgnEditBarProps = {
    isEditable: Accessor<boolean>;
};

const PgnEditBar: Component<PgnEditBarProps> = (props) => {
    const gameContext = useContext(GameContext)!;
    const {
        viewModeSignal: [viewMode, setViewMode],
        startingPositionSignal: [startingPosition],
        gameSignal: [game, setGame],
        editPgnSignal: [editPgn, setEditPgn],
        isEditingDescriptionSignal: [
            isEditingDescription,
            setIsEditingDescription,
        ],
        orientation,
        currentPathSignal: [currentPath],
    } = gameContext;
    const navigate = useNavigate();

    const onEditStartingPosition = () => {
        setViewMode(ViewMode.STARTING_POSITION);
    };

    const onAcceptStartingPosition = () => {
        // const newGame = game()?.updateHeaders(
        //     new Map([
        //         ["FEN", startingPosition() || ""],
        //         ["Setup", "1"],
        //     ]),
        // );
        const newGame = game()?.withStartingPosition(startingPosition() || "");
        batch(() => {
            setGame(newGame);
            setViewMode(ViewMode.MOVES);
        });
    };

    const onCancelStartingPosition = () => {
        setViewMode(ViewMode.MOVES);
    };

    const onEditPgn = () => {
        batch(() => {
            setEditPgn(game()?.pgn());
            setViewMode(ViewMode.PGN);
        });
    };

    const onAcceptPgn = () => {
        batch(() => {
            updateGameFromPgnString(editPgn()!, gameContext);
            setViewMode(ViewMode.MOVES);
        });
    };

    // #region export: the board as an image, the line as a GIF
    const [exporting, setExporting] = createSignal(false);
    const exportName = () => game()?.title() || "board";
    const exportTask = async (task: () => Promise<string | undefined>) => {
        setExporting(true);
        try {
            const done = await task();
            if (done) makeToast(done);
        } catch (err) {
            makeErrorToast(`Export failed: ${String(err)}`);
        } finally {
            setExporting(false);
        }
    };
    const pngNow = () =>
        boardPng(frameAt(game()!, currentPath() ?? Path.root), orientation());
    const onCopyImage = () =>
        exportTask(async () => {
            await copyPng(await pngNow());
            return "Board image copied";
        });
    const onSaveImage = () =>
        exportTask(async () => {
            const bytes = new Uint8Array(await (await pngNow()).arrayBuffer());
            const path = await saveExport(bytes, "png", exportName());
            return path && `Saved ${path}`;
        });
    const onSaveGif = () =>
        exportTask(async () => {
            const frames = lineFrames(game()!, currentPath() ?? Path.root);
            const bytes = await boardGif(frames, orientation());
            const path = await saveExport(bytes, "gif", exportName());
            return path && `Saved ${path}`;
        });
    // #endregion

    const onEditDescription = () => {
        setIsEditingDescription(true);
    };

    const onFinishEditDescription = () => {
        setIsEditingDescription(false);
    };

    const onFLipBoard = () => {
        const newOrientation = orientation() === "white" ? "black" : "white";
        const newGame = game()?.updateHeaders(
            new Map([["Orientation", newOrientation]]),
        );
        // initFromGameModel(gameContext, newGame!);
        setGame(newGame);
    };

    const fen = useFen(game, currentPath);

    const onPlayAgainstEngine = () => {
        // Toggle the playing engine state (commented out for now)
        const currentFen = fen();
        const playUrl = `/play?fen=${encodeURIComponent(currentFen)}`;
        navigate(playUrl);
    };

    return (
        <div class="buttons-bar are-small">
            <Show when={props.isEditable()}>
                <Button onClick={onFLipBoard} title="Flip Board (F)">
                    <IconSwitchVertical />
                </Button>
                <Button
                    onClick={onCopyImage}
                    disabled={exporting()}
                    title="Copy the board as an image"
                >
                    <IconCopy />
                </Button>
                <Button
                    onClick={onSaveImage}
                    disabled={exporting()}
                    title="Save the board as a PNG image…"
                >
                    <IconPhotoDown />
                </Button>
                <Button
                    onClick={onSaveGif}
                    disabled={exporting()}
                    title="Save the line shown as an animated GIF…"
                >
                    <IconGif />
                </Button>

                <Show when={isEditingDescription()}>
                    <Button
                        onClick={onFinishEditDescription}
                        title="Finish Editing Description"
                    >
                        <IconCheck />
                    </Button>
                </Show>

                <Show when={!isEditingDescription()}>
                    <Button
                        onClick={onEditDescription}
                        title="Edit Description"
                    >
                        <IconTextPlus />
                    </Button>
                </Show>
                <Show when={viewMode() === ViewMode.MOVES}>
                    <Button onClick={onEditPgn} title="Edit PGN">
                        <IconBrackets />
                    </Button>
                    <Button
                        title="Play Against Engine"
                        onClick={onPlayAgainstEngine}
                    >
                        <IconPlayerPlayFilled />
                    </Button>
                </Show>
                <Show when={viewMode() === ViewMode.MOVES}>
                    <Button
                        onClick={onEditStartingPosition}
                        title="Change Starting Position"
                    >
                        <StartingPositionIcon />
                    </Button>
                </Show>
            </Show>

            <Show when={viewMode() === ViewMode.STARTING_POSITION}>
                <div class="is-flex is-flex-direction-row is-gap-1">
                    <Button onClick={onCancelStartingPosition}>Cancel</Button>
                    <Button
                        class="is-primary"
                        onClick={onAcceptStartingPosition}
                    >
                        Accept
                    </Button>
                </div>
            </Show>
            <Show when={viewMode() === ViewMode.PGN}>
                <div class="is-flex is-flex-direction-row is-gap-1">
                    <Button onClick={onCancelStartingPosition}>Cancel</Button>
                    <Button class="is-primary" onClick={onAcceptPgn}>
                        Accept
                    </Button>
                </div>
            </Show>
        </div>
    );
};

export default PgnEditBar;
