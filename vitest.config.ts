import { defineConfig } from "vitest/config";

// Unit tests cover pure modules (models, engine parsing), so they run in Node without the
// Solid plugin from vite.config.ts.
export default defineConfig({
    test: {
        environment: "node",
        include: ["src/**/*.test.ts"],
        server: {
            deps: {
                // published with extensionless ESM imports, which only bundlers resolve
                inline: ["@scoriiu/fenshot"],
            },
        },
    },
});
