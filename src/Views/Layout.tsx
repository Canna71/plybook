import { onCleanup, onMount, ParentComponent } from "solid-js";
import { useNavigate } from "@solidjs/router";
import Sidebar from "./Sidebar";
import { invoke } from "@tauri-apps/api/core";
import {
    pastedImage,
    pastedText,
    setPendingPgn,
    setPendingScan,
} from "../paste/pending";
import { parsePasted } from "../paste/pasted";
import { makeErrorToast } from "../components/common/Toast";
import "./Layout.scss";
import { VDivider } from "../components/common/VDivider";
import { VideoPlayer } from "../components/video/VideoPlayer";
import { useSplitter } from "../components/common/utils";
import { getSettingValue, setSettingValue } from "../models/settings";

const Layout: ParentComponent = (props) => {
    const divider = useSplitter((layout) => {
        setSettingValue("layout.columnsTemplate", layout);
    });

    // pasted anywhere outside text fields: a screenshot is scanned for a position; a FEN, PGN
    // or Lichess game link opens in analysis
    const navigate = useNavigate();
    const openGames = (pgn: string) => {
        setPendingPgn(pgn);
        navigate("/analysis?source=pasted");
    };
    const onPaste = async (e: ClipboardEvent) => {
        const image = pastedImage(e);
        if (image) {
            e.preventDefault();
            setPendingScan(image);
            navigate("/scan");
            return;
        }
        const pasted = parsePasted(pastedText(e) ?? "");
        if (!pasted) return;
        e.preventDefault();
        switch (pasted.kind) {
            case "fen":
                navigate(`/analysis?fen=${encodeURIComponent(pasted.fen)}`);
                break;
            case "pgn":
                openGames(pasted.pgn);
                break;
            case "lichess":
                try {
                    openGames(
                        await invoke<string>("online_lichess_game", {
                            id: pasted.gameId,
                        }),
                    );
                } catch (err) {
                    makeErrorToast(String(err));
                }
                break;
        }
    };
    onMount(() => document.addEventListener("paste", onPaste));
    // dev builds: a script can drive the app for screenshots (src/dev/devdriver.ts)
    if (import.meta.env.DEV) {
        onMount(() => {
            let stop: (() => void) | undefined;
            void import("../dev/devdriver").then(
                (m) => (stop = m.startDevDriver(navigate)),
            );
            onCleanup(() => stop?.());
        });
    }
    onCleanup(() => document.removeEventListener("paste", onPaste));

    const gridTemplateColumns = () =>
        getSettingValue("layout.columnsTemplate", "180px 5px 1fr");

    return (
        <main
            class="layout-container"
            style={{ "grid-template-columns": gridTemplateColumns() }}
        >
            <aside class="sidebar">
                <Sidebar />
            </aside>

            <VDivider ref={divider} />

            <main class="main-content">{props.children}</main>
            <VideoPlayer />
        </main>
    );
};

export default Layout;
