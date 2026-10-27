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
import { updateGameFromPgnString } from "./gameInit";
import { useFen } from "./gamePosition";
import { StartingPositionIcon } from "../common/Icons";
import {
    IconBrackets,
    IconBrandYoutube,
    IconCheck,
    IconCopy,
    IconDots,
    IconDownload,
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
import AttachVideo from "../video/AttachVideo";
import Menu from "../common/Menu";
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

    // a YouTube link becomes a comment on the move shown, played from the comment
    const attachVideo = createSignal(false);
    const setAttachingVideo = attachVideo[1];
    const onAttachVideo = (link: string) => {
        const g = game();
        if (g)
            setGame(
                g.insertComment(currentPath() ?? Path.root, link, false, true),
            );
    };

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
            <Show when={props.isEditable() && viewMode() === ViewMode.MOVES}>
                <Button onClick={onFLipBoard} title="Flip the board (F)">
                    <IconSwitchVertical />
                </Button>
                <Menu
                    iconOnly
                    title="Export the board or the line"
                    disabled={exporting()}
                    alignRight
                    items={[
                        {
                            label: "Copy the board as an image",
                            icon: <IconCopy />,
                            onClick: onCopyImage,
                        },
                        {
                            label: "Save the board as PNG…",
                            icon: <IconPhotoDown />,
                            onClick: onSaveImage,
                        },
                        {
                            label: "Save the line as an animated GIF…",
                            icon: <IconGif />,
                            onClick: onSaveGif,
                        },
                    ]}
                >
                    <IconDownload />
                </Menu>
                <Menu
                    iconOnly
                    title="More"
                    alignRight
                    items={[
                        {
                            label: "Play the engine from here",
                            icon: <IconPlayerPlayFilled />,
                            onClick: onPlayAgainstEngine,
                        },
                        "separator",
                        {
                            label: isEditingDescription()
                                ? "Finish the description"
                                : "Write a description",
                            icon: isEditingDescription() ? (
                                <IconCheck />
                            ) : (
                                <IconTextPlus />
                            ),
                            onClick: isEditingDescription()
                                ? onFinishEditDescription
                                : onEditDescription,
                        },
                        {
                            label: "Link a YouTube video to this move…",
                            icon: <IconBrandYoutube />,
                            onClick: () => setAttachingVideo(true),
                        },
                        "separator",
                        {
                            label: "Change the starting position",
                            icon: <StartingPositionIcon />,
                            onClick: onEditStartingPosition,
                        },
                        {
                            label: "Edit the PGN text",
                            icon: <IconBrackets />,
                            onClick: onEditPgn,
                        },
                    ]}
                >
                    <IconDots />
                </Menu>
            </Show>
            <AttachVideo open={attachVideo} onAttach={onAttachVideo} />

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
