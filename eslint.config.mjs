import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = defineConfig([
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "next-env.d.ts",
      // The original game is reference material that must never be edited. It is
      // also pre-strict-mode JavaScript ESLint cannot parse — before this entry,
      // parse errors in here were the *only* findings a lint run produced, so the
      // command failed on the one directory nobody is allowed to touch.
      "lg-DO NOT EDIT - ORIGINAL LG RPG GAME - FOR REFERENCE ONLY/**",
      // Vendored and generated browser assets.
      "public/**",
      // Emitted by the icon pipeline.
      "src/lib/icon-mappings.ts",
      "src/generated/**",
    ],
  },

  js.configs.recommended,
  // core-web-vitals only. `next/typescript` additionally turns on a large
  // opinionated ruleset (no-explicit-any and friends) whose ~300 findings are a
  // typing project, not a correctness gate — the TypeScript block below picks up
  // the one rule from that plugin actually worth failing a build over.
  ...compat.extends("next/core-web-vitals"),

  // The game engine, socket server, data modules, scripts and server entry
  // points are CommonJS running under Node — not browser ES modules. Note
  // "script", not "commonjs": the Next config applies the TypeScript parser to
  // every file, and that parser rejects "commonjs" outright.
  {
    files: [
      "src/lib/**/*.js",
      "scripts/**/*.js",
      "server.js",
      "socket-server.js",
      "*.config.js",
    ],
    languageOptions: {
      sourceType: "script",
      globals: { ...globals.node },
    },
  },

  // Config and build files that run in Node but ship as ES modules.
  {
    files: ["*.mjs", "prisma/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  {
    rules: {
      // An unused binding is usually a leftover from a refactor; an underscore
      // prefix is the escape hatch for an intentionally ignored one.
      //
      // A warning rather than an error *for now*: this rule has never run, so it
      // starts with a ~70-item backlog. Warning keeps every one of them visible
      // on each run while still letting lint gate CI on genuine errors today.
      // Raise to "error" once the backlog is cleared.
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  // TypeScript needs the TypeScript-aware versions of these two rules. The base
  // ones read a type signature's parameter names as unused variables and do not
  // know built-in DOM/TS globals, which together accounted for nearly 300 false
  // positives; `tsc` is what actually catches undefined identifiers here.
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
      // Warning for the same reason as the base rule above.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Pulling a CommonJS game-data module into TypeScript with require() is a
      // deliberate pattern here — it is how the client shares the server's own
      // recipe, teleport and quest definitions instead of copying them.
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  {
    rules: {
      // Stylistic, and the game's icon/sprite pipeline is built around <img>.
      "@next/next/no-img-element": "warn",
    },
  },
]);

export default eslintConfig;
