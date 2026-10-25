// Dev server only: the webview's errors and warnings, printed in the terminal running
// `pnpm tauri dev` (prefixed "[webview]"), so problems are visible without opening devtools.
// A small script injected into index.html forwards console.error/warn, uncaught errors and
// rejected promises to POST /__devlog. Not part of `vite build`.

import type { Plugin } from "vite";

const forwarder = `
(() => {
  const send = (level, args) => {
    try {
      const text = args.map((a) =>
        a instanceof Error ? (a.stack || a.message) :
        typeof a === "string" ? a : JSON.stringify(a)).join(" ");
      fetch("/__devlog", { method: "POST", body: level + " " + text });
    } catch {}
  };
  for (const level of ["error", "warn"]) {
    const original = console[level];
    console[level] = (...args) => { send(level, args); original(...args); };
  }
  addEventListener("error", (e) => send("uncaught", [e.error || e.message]));
  addEventListener("unhandledrejection", (e) => send("unhandled", [e.reason]));
})();
`;

export const devLog = (): Plugin => ({
    name: "rechess-devlog",
    apply: "serve",
    configureServer(server) {
        server.middlewares.use("/__devlog", (req, res) => {
            let body = "";
            req.on("data", (chunk) => (body += chunk));
            req.on("end", () => {
                console.log(`[webview] ${body.slice(0, 4000)}`);
                res.statusCode = 204;
                res.end();
            });
        });
    },
    transformIndexHtml: () => [
        { tag: "script", children: forwarder, injectTo: "head-prepend" },
    ],
});
