/**
 * Strażnik wierności wyglądu.
 *
 * `src/styles/index.css` ma być DOSŁOWNYM przepisaniem tokenów z produkcyjnego arkusza
 * `mirror/frontend/assets/index-BVOkSOnE.css`. Ten test porównuje EFEKTYWNE wartości
 * tokenów w obu motywach (`:root` dla jasnego, `:root` nadpisane przez `.dark` dla ciemnego),
 * więc jest odporny na inny podział na bloki, ale wyłapie każdą zmianę wartości.
 *
 * Gdy test padnie: albo ktoś ruszył token bez powodu, albo produkcja się zmieniła —
 * w drugim przypadku zmiana idzie przez triaż (`docs/rebuild-backlog.md`), nie przez
 * cichą edycję pliku.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const katalogTestow = dirname(fileURLToPath(import.meta.url));
const korzenFrontendu = resolve(katalogTestow, "..");
const korzenRepo = resolve(korzenFrontendu, "../..");

const NASZ_CSS = readFileSync(resolve(korzenFrontendu, "src/styles/index.css"), "utf8");
const CSS_PRODUKCJI = readFileSync(
  resolve(korzenRepo, "mirror/frontend/assets/index-BVOkSOnE.css"),
  "utf8",
);

/** Ujednolica zapis, żeby `.5rem` == `0.5rem`, a `hsl( from x )` == `hsl(from x)`. */
function znormalizuj(wartosc: string): string {
  return wartosc
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/([^0-9a-zA-Z])\.(\d)/g, "$10.$2")
    .replace(/^\.(\d)/, "0.$1")
    .trim();
}

/** Wyciąga deklaracje `--token: wartość` ze WSZYSTKICH bloków, których selektor pasuje. */
function tokenyZBlokow(css: string, pasujeSelektor: (selektor: string) => boolean) {
  const tokeny = new Map<string, string>();
  // Komentarze precz — inaczej przyklejają się do selektora następnego bloku.
  const bezKomentarzy = css.replace(/\/\*[\s\S]*?\*\//g, " ");
  const wzorzec = /([^{}]+)\{([^{}]*)\}/g;
  let dopasowanie: RegExpExecArray | null;

  while ((dopasowanie = wzorzec.exec(bezKomentarzy)) !== null) {
    const selektor = dopasowanie[1] ?? "";
    const cialo = dopasowanie[2] ?? "";
    const selektory = selektor.split(",").map((czesc) => czesc.trim());
    if (!selektory.some(pasujeSelektor)) continue;

    for (const deklaracja of cialo.split(";")) {
      const rozdzielone = deklaracja.match(/^\s*(--[a-z0-9-]+)\s*:\s*(.+)$/is);
      if (!rozdzielone) continue;
      const [, nazwa, wartosc] = rozdzielone;
      // Ostatnia deklaracja wygrywa — tak jak w kaskadzie CSS (fallback + wersja docelowa).
      tokeny.set(nazwa!, znormalizuj(wartosc!));
    }
  }
  return tokeny;
}

const jestRoot = (selektor: string) => selektor === ":root";
const jestDark = (selektor: string) => selektor === ".dark";

function efektywneTokeny(css: string, ciemny: boolean) {
  const podstawa = tokenyZBlokow(css, jestRoot);
  if (!ciemny) return podstawa;
  const nadpisania = tokenyZBlokow(css, jestDark);
  return new Map([...podstawa, ...nadpisania]);
}

describe.each([
  ["motyw jasny", false],
  ["motyw ciemny", true],
])("%s", (_nazwa, ciemny) => {
  const nasze = efektywneTokeny(NASZ_CSS, ciemny);
  const produkcyjne = efektywneTokeny(CSS_PRODUKCJI, ciemny);

  it("nie gubi żadnego tokenu z produkcji", () => {
    const brakujace = [...produkcyjne.keys()].filter((nazwa) => !nasze.has(nazwa));
    expect(brakujace).toEqual([]);
  });

  it("ma te same wartości co produkcja", () => {
    const rozjazdy = [...produkcyjne.entries()]
      .filter(([nazwa, wartosc]) => nasze.has(nazwa) && nasze.get(nazwa) !== wartosc)
      .map(([nazwa, wartosc]) => `${nazwa}: nasze „${nasze.get(nazwa)}" vs produkcja „${wartosc}"`);
    expect(rozjazdy).toEqual([]);
  });
});

describe("tokeny wymienione wprost w zakresie ticketa", () => {
  it("odpowiadają produkcji", () => {
    const jasne = efektywneTokeny(NASZ_CSS, false);
    expect(jasne.get("--primary")).toBe("35 70% 45%");
    expect(jasne.get("--sidebar")).toBe("215 28% 12%");
    expect(jasne.get("--background")).toBe("210 20% 98%");
    expect(jasne.get("--font-sans")).toContain("Inter");
    expect(jasne.get("--font-mono")).toContain("JetBrains Mono");
  });
});

/**
 * Druga warstwa strażnika — czy klasy przepisane z oryginału FAKTYCZNIE coś generują.
 *
 * Powód istnienia: porównanie samych deklaracji `:root`/`.dark` przepuściło błąd, w którym
 * tokeny `--primary-border` były zdefiniowane 1:1, ale `tailwind.config.ts` nie mapował ich
 * na kolory, więc `border-primary-border` z `Button` nie renderowało żadnej reguły —
 * CTA „Zaloguj się" dostawało szarą obwódkę zamiast bursztynowej.
 *
 * Test uruchamia prawdziwy potok PostCSS + Tailwind na naszym arkuszu i sprawdza,
 * że dla każdej klasy z listy powstała reguła.
 */
describe("wygenerowany arkusz", () => {
  it("renderuje reguły dla klas przepisanych z oryginału", async () => {
    const postcss = (await import("postcss")).default;
    const tailwindcss = (await import("tailwindcss")).default;
    const konfiguracja = (await import("../tailwind.config")).default;

    const wynik = await postcss([
      tailwindcss({
        ...konfiguracja,
        content: [resolve(korzenFrontendu, "src/**/*.{ts,tsx}")],
      }),
    ]).process(NASZ_CSS, { from: resolve(korzenFrontendu, "src/styles/index.css") });

    // Klasy, na których stoi wygląd shellu i ekranu logowania. Każda pochodzi
    // z bundla produkcji — brak reguły oznacza cichy rozjazd wyglądu.
    const wymagane = [
      "border-primary-border",
      "border-secondary-border",
      "border-destructive-border",
      "border-card-border",
      "border-sidebar-border",
      "bg-sidebar",
      "bg-sidebar-primary",
      "text-sidebar-primary",
      "text-sidebar-primary-foreground",
      "bg-sidebar-accent",
      "text-sidebar-accent-foreground",
      "bg-background",
      "bg-card",
      "text-primary",
      "bg-primary",
      "text-primary-foreground",
      "text-muted-foreground",
      "text-destructive",
      "border-input",
      "ring-ring",
    ];

    // Klasa może wystąpić samodzielnie (`.bg-sidebar`) albo za modyfikatorem
    // (`.hover\:bg-sidebar-accent:hover`, `.focus-visible\:ring-ring:focus-visible`),
    // dlatego dopuszczamy oba prefiksy: kropkę i escape'owany dwukropek.
    const czyWygenerowana = (klasa: string) =>
      new RegExp(`[.\\\\:]${klasa}(?![a-zA-Z0-9_-])`).test(wynik.css);

    const brakujace = wymagane.filter((klasa) => !czyWygenerowana(klasa));
    expect(brakujace).toEqual([]);

    // Warianty z alfą i modyfikatorami — używane wprost w Login.tsx i AppShell.tsx.
    for (const fragment of [
      "bg-destructive\\/10",
      "border-destructive\\/20",
      "text-sidebar-foreground\\/80",
      "bg-black\\/40",
    ]) {
      expect(wynik.css).toContain(`.${fragment}`);
    }

    // Wartość musi być SUROWA (`var(--primary-border)`), a nie owinięta w hsl() —
    // ten token jest już gotowym kolorem. Produkcja generuje dokładnie taką regułę.
    // PostCSS zwraca arkusz sformatowany, produkcja jest zminifikowana — porównujemy
    // po ujednoliceniu białych znaków.
    const zwiniety = wynik.css.replace(/\s+/g, "");
    expect(zwiniety).toContain(".border-primary-border{border-color:var(--primary-border);}");
  });
});
