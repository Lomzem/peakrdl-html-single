import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import ts from "typescript-eslint";
import { defineConfig } from "eslint/config";
import svelteConfig from "./svelte.config.js";

export default defineConfig(
  { ignores: [".svelte-kit/**", "build/**", "build-shell/**"] },
  js.configs.recommended,
  ts.configs.recommended,
  svelte.configs.recommended,
  prettier,
  svelte.configs.prettier,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "no-undef": "off",
      "svelte/prefer-svelte-reactivity": "off",
    },
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: [".svelte"],
        parser: ts.parser,
        svelteConfig,
      },
    },
  },
  {
    files: ["src/lib/components/ui/button/button.svelte"],
    rules: {
      "svelte/no-navigation-without-resolve": "off",
    },
  },
  {
    files: [
      "src/lib/components/register-document/register-field-card.svelte",
      "src/lib/components/register-document/register-view.svelte",
    ],
    rules: {
      "svelte/no-at-html-tags": "off",
    },
  },
);
