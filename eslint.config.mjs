import { fixupConfigRules } from "@eslint/compat";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [...fixupConfigRules(compat.extends(
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
)), {
    plugins: {
        "react-refresh": reactRefresh,
    },

    languageOptions: {
        globals: {
            ...globals.browser,
        },

        parser: tsParser,
        ecmaVersion: "latest",
        sourceType: "module",
    },

    rules: {
        "prefer-rest-params": "off",
        "no-constant-condition": "off",
        "react-refresh/only-export-components": "warn",
        "@typescript-eslint/no-inferrable-types": "off",
        "@typescript-eslint/no-empty-function": "off",
        "@typescript-eslint/no-namespace": "off",

        "@typescript-eslint/no-unused-vars": ["warn", {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
	    caughtErrorsIgnorePattern: "ignored"
        }],
    },
}];