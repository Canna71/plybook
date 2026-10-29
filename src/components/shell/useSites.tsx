// What the user takes from a chess site (I.5) reaches the Library: while the site window is
// open, a game or position copied anywhere is offered ("Add to Library"), and a PGN the site
// downloaded (src-tauri/src/sites.rs saves it to Library/Downloads) is announced. Mounted once,
// in the app's layout.

import { onCleanup, onMount } from "solid-js";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { BaseDirectory, mkdir } from "@tauri-apps/plugin-fs";
import toast from "solid-toast";
import anylogger from "anylogger";
import { Clip, clipName, clipOf, clipPgn } from "../../models/sites";
import { SiteDownload, siteClipboard, siteIsOpen } from "../../storage/sites";
import { writeDataFile } from "../../storage/fs";
import { makeErrorToast } from "../common/Toast";
import { setPendingPgn } from "../../paste/pending";
const log = anylogger("sites");

/** Where copied games and positions go */
const CLIPPED = "Library/Clipped";
const POLL = 1000;

/** A toast with buttons: each runs and closes it */
function offerToast(
    message: string,
    actions: { label: string; run: () => void }[],
    duration = 12000,
) {
    toast(
        (t) => (
            <div class="rc-toast-offer">
                <span>{message}</span>
                {actions.map((a) => (
                    <button
                        class="button is-small"
                        onClick={() => {
                            toast.dismiss(t.id);
                            a.run();
                        }}
                    >
                        {a.label}
                    </button>
                ))}
            </div>
        ),
        { duration, position: "bottom-center", className: "rc-toast" },
    );
}

export function useSites(navigate: (to: string) => void) {
    const openFile = (path: string) =>
        navigate(`/game?path=${encodeURIComponent(path)}&source=library`);

    const save = async (clip: Clip) => {
        try {
            await mkdir(CLIPPED, {
                baseDir: BaseDirectory.AppLocalData,
                recursive: true,
            });
            const path = `${CLIPPED}/${clipName(clip, new Date())}`;
            await writeDataFile(path, clipPgn(clip));
            offerToast(`Saved to ${CLIPPED}`, [
                { label: "Open", run: () => openFile(path) },
            ]);
        } catch (err) {
            makeErrorToast(String(err));
        }
    };

    const offer = (clip: Clip) =>
        offerToast(
            clip.kind === "fen"
                ? "You copied a position"
                : clip.games > 1
                  ? `You copied ${clip.games} games`
                  : "You copied a game",
            [
                { label: "Add to Library", run: () => void save(clip) },
                {
                    label: "Open",
                    run: () =>
                        clip.kind === "fen"
                            ? navigate(
                                  `/analysis?fen=${encodeURIComponent(clip.fen)}`,
                              )
                            : (setPendingPgn(clip.pgn),
                              navigate("/analysis?source=pasted")),
                },
            ],
        );

    // the clipboard, watched only while the site window is open
    let timer: ReturnType<typeof setInterval> | undefined;
    let last: string | undefined;
    const stop = () => {
        if (timer) clearInterval(timer);
        timer = undefined;
    };
    const start = async () => {
        if (timer) return;
        // what was copied before the site opened is not offered
        last = await siteClipboard().catch(() => undefined);
        timer = setInterval(async () => {
            const text = await siteClipboard().catch(() => undefined);
            if (text === undefined) return;
            if (text === last) return;
            last = text;
            const clip = clipOf(text);
            if (clip) offer(clip);
        }, POLL);
    };

    // registered before any await: Solid only keeps cleanups made while the hook runs
    let unlisten: UnlistenFn[] = [];
    onCleanup(() => {
        stop();
        unlisten.forEach((u) => u());
    });
    onMount(async () => {
        unlisten = await Promise.all([
            listen("site-opened", () => void start()),
            listen("site-closed", stop),
            listen<SiteDownload>("site-download", (e) =>
                offerToast(`Saved ${e.payload.name} to Library/Downloads`, [
                    { label: "Open", run: () => openFile(e.payload.path) },
                ]),
            ),
        ]).catch((err) => {
            log.warn("site events", err);
            return [];
        });
        if (await siteIsOpen().catch(() => false)) void start();
    });
}
