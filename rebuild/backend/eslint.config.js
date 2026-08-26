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
      ".tmp-oryginal/**",
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
);
