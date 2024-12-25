import globals from "globals";
import tseslint from "typescript-eslint";


/** @type {import('eslint').Linter.Config[]} */
export default [
    { files: ["**/*.{js,mjs,cjs,ts}"] },
    { languageOptions: { globals: globals.browser } },
    {
        "extends": ["eslint:recommended","plugin:prettier/recommended"],
        "rules": {
            "no-multiple-empty-lines": ["error",{ "max": 1,"maxEOF": 0 }],
            "prettier/prettier": "error"
        }
    },
  ...tseslint.configs.recommended,

];