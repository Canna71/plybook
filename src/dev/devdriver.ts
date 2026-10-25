// Dev builds only (`pnpm tauri dev`): lets a script drive the running app, so UI work can be
// checked with screenshots without clicking by hand. The app polls /dev-driver.json (served by
// Vite from public/, git-ignored) and runs each new command once. Production builds never
// call this: `import.meta.env.DEV` is false there and the module is dropped.
//
// A command: { "id": "any unique value", "go": "/route", "click": "css selector",
//              "key": "ArrowRight", "theme": "light" | "dark" | "" }

import anylogger from "anylogger";
const log = anylogger("devdriver");

type Command = {
    id: string;
    go?: string;
    click?: string;
    key?: string;
    theme?: "light" | "dark" | "";
};

const POLL = 500;

export function startDevDriver(navigate: (to: string) => void) {
    let last: string | undefined;
    const timer = setInterval(async () => {
        let cmd: Command;
        try {
            const res = await fetch("/dev-driver.json", { cache: "no-store" });
            if (!res.ok) return;
            cmd = await res.json();
        } catch {
            return;
        }
        if (!cmd?.id || cmd.id === last) return;
        last = cmd.id;
        log.info("command", cmd);
        if (cmd.theme !== undefined) {
            if (cmd.theme) document.documentElement.dataset.theme = cmd.theme;
            else delete document.documentElement.dataset.theme;
        }
        if (cmd.go) navigate(cmd.go);
        // after the route has rendered
        setTimeout(() => {
            if (cmd.click) {
                const el = document.querySelector<HTMLElement>(cmd.click);
                if (el) el.click();
                else log.warn("nothing matches", cmd.click);
            }
            if (cmd.key) {
                document.dispatchEvent(
                    new KeyboardEvent("keydown", {
                        key: cmd.key,
                        bubbles: true,
                    }),
                );
            }
        }, 300);
    }, POLL);
    return () => clearInterval(timer);
}
