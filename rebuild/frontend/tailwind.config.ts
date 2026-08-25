import type { Config } from "tailwindcss";

/**
 * Mapowanie tokenów z `src/styles/index.css` na skalę Tailwinda.
 * Nazwy kolorów odpowiadają klasom używanym w oryginalnym bundlu
 * (`bg-sidebar`, `text-sidebar-foreground`, `border-card-border`, `bg-destructive/10`…),
 * dzięki czemu klasy przepisane z produkcji działają bez tłumaczenia.
 *
 * Warianty `border` (np. `primary.border` → klasa `border-primary-border`) celowo mają
 * wartość SUROWĄ `var(--primary-border)`, bez `hsl()` i bez `<alpha-value>` — ten token
 * jest już gotowym kolorem liczonym przez `hsl(from ...)` w `src/styles/index.css`.
 * Produkcja generuje je dokładnie tak: `.border-primary-border{border-color:var(--primary-border)}`
 * (index-BVOkSOnE.css). Bez tego mapowania klasy z `Button` nie generowałyby żadnej reguły.
 */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
          border: "hsl(var(--card-border) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
          border: "hsl(var(--popover-border) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          border: "var(--primary-border)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
          border: "var(--secondary-border)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
          border: "var(--muted-border)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
          border: "var(--accent-border)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
          border: "var(--destructive-border)",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          border: "hsl(var(--sidebar-border) / <alpha-value>)",
          ring: "hsl(var(--sidebar-ring) / <alpha-value>)",
          primary: {
            DEFAULT: "hsl(var(--sidebar-primary) / <alpha-value>)",
            foreground: "hsl(var(--sidebar-primary-foreground) / <alpha-value>)",
            border: "var(--sidebar-primary-border)",
          },
          accent: {
            DEFAULT: "hsl(var(--sidebar-accent) / <alpha-value>)",
            foreground: "hsl(var(--sidebar-accent-foreground) / <alpha-value>)",
            border: "var(--sidebar-accent-border)",
          },
        },
        chart: {
          1: "hsl(var(--chart-1) / <alpha-value>)",
          2: "hsl(var(--chart-2) / <alpha-value>)",
          3: "hsl(var(--chart-3) / <alpha-value>)",
          4: "hsl(var(--chart-4) / <alpha-value>)",
          5: "hsl(var(--chart-5) / <alpha-value>)",
        },
      },
      // Skala zaokrągleń przepisana z WARTOŚCI wygenerowanych przez produkcję:
      // `.rounded-sm{.1875rem}`, `.rounded-md{.375rem}`, `.rounded-lg{.5625rem}`,
      // `.rounded-xl{.75rem}` (index-BVOkSOnE.css). Celowo NIE wyliczamy ich z `--radius`:
      // produkcyjny arkusz nie używa `var(--radius)` w żadnej regule (0 trafień), a domyślna
      // konwencja shadcn (`lg: var(--radius)`) dałaby 8 px zamiast 9 px i 4 px zamiast 3 px.
      // `rounded` (.25rem) i `rounded-full` zostają domyślne — produkcja ma je identyczne.
      borderRadius: {
        sm: "0.1875rem",
        md: "0.375rem",
        lg: "0.5625rem",
        xl: "0.75rem",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [],
} satisfies Config;
