import {
    Component,
    createEffect,
    createSignal,
    For,
    onCleanup,
    onMount,
    Show,
} from "solid-js";
import { useNavigate } from "@solidjs/router";
import anylogger from "anylogger";
import BoardEditor from "../components/boardeditor/BoardEditor";
import Button from "../components/common/Button";
import { pendingScan, setPendingScan } from "../paste/pending";
import { scanImage, warmUpScanner } from "../scan/recognizer";
import { captureScreenRegion } from "../scan/capture";
import "./ScanView.scss";
const log = anylogger("scan");

/**
 * Screenshot or diagram → position: paste an image (anywhere in the app) or choose one, check
 * the recognized position in the editor, then analyse it, play it or look it up.
 */
const ScanView: Component = () => {
    const navigate = useNavigate();
    const [fen, setFen] = createSignal<string>();
    const [imageUrl, setImageUrl] = createSignal<string>();
    const [scanning, setScanning] = createSignal(false);
    const [warnings, setWarnings] = createSignal<string[]>([]);
    const [notFound, setNotFound] = createSignal(false);

    onMount(warmUpScanner);
    onCleanup(() => {
        const url = imageUrl();
        if (url) URL.revokeObjectURL(url);
    });

    const scan = async (image: Blob) => {
        const old = imageUrl();
        if (old) URL.revokeObjectURL(old);
        setImageUrl(URL.createObjectURL(image));
        setScanning(true);
        setNotFound(false);
        setWarnings([]);
        try {
            const position = await scanImage(image);
            if (!position) {
                setNotFound(true);
                return;
            }
            setFen(position.fen);
            setWarnings(position.warnings);
        } catch (err) {
            log.error("scan failed", err);
            setWarnings([`Could not read the image: ${String(err)}`]);
        } finally {
            setScanning(false);
        }
    };

    // images pasted elsewhere in the app arrive here
    createEffect(() => {
        const image = pendingScan();
        if (image) {
            setPendingScan(undefined);
            scan(image);
        }
    });

    const fromScreen = async () => {
        try {
            const image = await captureScreenRegion();
            if (image) scan(image);
        } catch (err) {
            setWarnings([String(err)]);
        }
    };

    const onFile = (e: Event) => {
        const file = (e.currentTarget as HTMLInputElement).files?.[0];
        if (file) scan(file);
    };

    const open = (route: string) => {
        const current = fen();
        if (current) navigate(`${route}?fen=${encodeURIComponent(current)}`);
    };

    return (
        <div class="scan_view">
            <div class="scan-panel">
                <h1 class="title is-5">Scan a position</h1>
                <p class="block">
                    Capture a board from the screen (any app or website), paste
                    a screenshot or a book diagram (⌘V) anywhere in ReChess, or
                    choose an image. Everything is read on this computer.
                </p>
                <div class="buttons block">
                    <Button
                        class="is-primary"
                        title="ReChess hides: drag a rectangle around the board, Esc to cancel"
                        onClick={fromScreen}
                    >
                        Capture from screen
                    </Button>
                    <Button
                        title="Every diagram of a PDF or of page images, saved as a collection"
                        onClick={() => navigate("/scan-book")}
                    >
                        Scan a whole book…
                    </Button>
                </div>
                <div class="file is-small block">
                    <label class="file-label">
                        <input
                            class="file-input"
                            type="file"
                            accept="image/*"
                            onChange={onFile}
                        />
                        <span class="file-cta">
                            <span class="file-label">Choose an image…</span>
                        </span>
                    </label>
                </div>
                <Show when={scanning()}>
                    <progress class="progress is-small is-primary" />
                </Show>
                <Show when={notFound()}>
                    <p class="notification is-warning is-light">
                        No chessboard found in this image. Crop it closer to the
                        board, or set the position up in the editor.
                    </p>
                </Show>
                <For each={warnings()}>
                    {(w) => <p class="notification is-warning is-light">{w}</p>}
                </For>
                <Show when={fen()}>
                    <div class="buttons">
                        <Button
                            class="is-primary"
                            onClick={() => open("/analysis")}
                        >
                            Analyze
                        </Button>
                        <Button onClick={() => open("/play")}>
                            Play from here
                        </Button>
                        <Button onClick={() => open("/databases")}>
                            Find in databases
                        </Button>
                    </div>
                </Show>
                <Show when={imageUrl()}>
                    <img
                        class="scan-image"
                        src={imageUrl()}
                        alt="Scanned image"
                    />
                </Show>
            </div>
            <div class="scan-editor">
                <BoardEditor fen={fen} setFen={setFen} />
            </div>
        </div>
    );
};

export default ScanView;
