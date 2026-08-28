import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // src/import/legacy/** to PORT VERBATIM podsystemu parserów z produkcji
    // (mirror/backend). Nie jest naszym kodem i nie wolno go ręcznie poprawiać —
    // wierność portu jest ważniejsza niż nasz styl, a każda edycja zrywa możliwość
    // przyjmowania poprawek Ani czystym `git diff`. Patrz rebuild/backend/README.md.
    ignores: [
      "dist/**",
      "node_modules/**",
      "src/db/schema.ts",
      "src/import/legacy/**",
      ".tmp/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
      globals: {
        console: "readonly",
        process: "readonly",
        NodeJS: "readonly",
        Buffer: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": "off",
    },
  },
  {
    // Skrypty `.cjs` są CommonJS-em ŚWIADOMIE, nie przez zaniedbanie: `scripts/kopia-bazy.cjs`
    // uruchamia deploy gołym `node` (bez tsx i bez builda), a `require('better-sqlite3')`
    // musi rozwiązać się względem `rebuild/backend/node_modules`. Rozszerzenie `.cjs` wymusza
    // CommonJS mimo `"type": "module"` w package.json.
    files: ["**/*.cjs"],
    languageOptions: {
      parserOptions: { sourceType: "commonjs" },
      globals: { require: "readonly", module: "writable", __dirname: "readonly" },
    },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);
