import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettierRecommended from "eslint-plugin-prettier/recommended";

export default tseslint.config(
    {
        ignores: [
            "dist/",
            "src-tauri/",
            "public/",
            "tools/",
            "src/Views/obsoleted/",
        ],
    },
    {
        files: ["**/*.{js,mjs,cjs,ts,tsx}"],
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        languageOptions: { globals: globals.browser },
        rules: {
            "no-multiple-empty-lines": ["error", { max: 1, maxEOF: 0 }],
            // `cond && doSomething()` is used as a statement throughout the codebase
            "@typescript-eslint/no-unused-expressions": [
                "error",
                { allowShortCircuit: true, allowTernary: true },
            ],
            // reported but not blocking until the engine/settings types are tightened
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unsafe-function-type": "warn",
            // match tsc's convention: a leading underscore marks an intentionally unused name
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                    destructuredArrayIgnorePattern: "^_",
                },
            ],
        },
    },
    prettierRecommended,
);
