import { onCleanup, onMount, ParentComponent, Show } from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";
import Sidebar, { sidebarCollapsed } from "./Sidebar";
import { CommandPalette } from "../components/shell/CommandPalette";
import { invoke } from "@tauri-apps/api/core";
import {
    pastedImage,
    pastedText,
    setPendingPgn,
    setPendingScan,
} from "../paste/pending";
import { parsePasted } from "../paste/pasted";
import { makeErrorToast, makeToast } from "../components/common/Toast";
import "./Layout.scss";
import { VDivider } from "../components/common/VDivider";
import { VideoPlayer } from "../components/video/VideoPlayer";
import { useSplitter } from "../components/common/useSplitter";
import { getSettingValue, setSettingValue } from "../models/settings";
import { useSites } from "../components/shell/useSites";
import { helpRoute } from "../models/navigation";

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
                if (pasted.note) makeToast(pasted.note, 8000);
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

    // F1 (or ⌘?, the macOS help key): the user guide at this screen's section (U.5)
    const location = useLocation();
    const onHelpKey = (e: KeyboardEvent) => {
        if (e.key === "F1" || ((e.metaKey || e.ctrlKey) && e.key === "?")) {
            e.preventDefault();
            navigate(helpRoute(location.pathname));
        }
    };
    onMount(() => document.addEventListener("keydown", onHelpKey));
    onCleanup(() => document.removeEventListener("keydown", onHelpKey));
    // chess sites (I.5): what is copied from them, or downloaded there, reaches the Library
    useSites(navigate);
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

    // collapsed: a narrow column of icons, not resizable
    const gridTemplateColumns = () =>
        sidebarCollapsed()
            ? "52px 0px 1fr"
            : getSettingValue("layout.columnsTemplate", "200px 5px 1fr");

    return (
        <main
            class="layout-container"
            style={{ "grid-template-columns": gridTemplateColumns() }}
        >
            <aside class="sidebar">
                <Sidebar />
            </aside>

            <Show when={!sidebarCollapsed()} fallback={<div />}>
                <VDivider ref={divider} />
            </Show>

            <main class="main-content">{props.children}</main>
            <VideoPlayer />
            <CommandPalette />
        </main>
    );
};

export default Layout;
