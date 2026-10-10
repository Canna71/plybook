import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettierRecommended from "eslint-plugin-prettier/recommended";

export default tseslint.config(
    { ignores: ["dist/", "src-tauri/", "public/", "tools/"] },
    {
        files: ["**/*.{js,mjs,cjs,ts,tsx}"],
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        languageOptions: { globals: globals.browser },
        rules: {
            "no-multiple-empty-lines": ["error", { max: 1, maxEOF: 0 }],
        },
    },
    prettierRecommended,
);
