import { z } from "zod";

/**
 * Konfiguracja z zmiennych środowiskowych.
 *
 * ODSTĘPSTWO OD ORYGINAŁU (zatwierdzone, plan.md O2): oryginał miał
 * `process.env.JWT_SECRET || "bridge-agrowiec-secret-2026"` (deminified/backend-index.cjs:47853).
 * Zahardkodowany fallback pozwala każdemu z dostępem do kodu podrobić dowolny token,
 * więc tutaj JWT_SECRET jest WYMAGANY — bez niego serwer nie wstaje (fail-fast).
 */
const listaOriginow = z
  .string()
  .default("")
  .transform((s) =>
    s
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  );

const flagaBool = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

/** Ta sama składnia, ale z domyślnym „wyłączone" — dla przełączników schedulera. */
const flagaBoolDomyslnieWylaczona = z
  .enum(["true", "false", "1", "0"])
  .default("false")
  .transform((v) => v === "true" || v === "1");

const schemaEnv = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5001),
  DB_PATH: z.string().min(1),
  JWT_SECRET: z.string().min(1, "JWT_SECRET jest wymagany — patrz .env.example"),
  CORS_ORIGINS: listaOriginow,
  COOKIE_SECURE: flagaBool.optional(),
  // Katalog archiwum plików importu. Oryginał trzyma go obok `__dirname`
  // (mirror/backend/archive_module.cjs:24); u nas musi być konfigurowalny, bo po
  // `npm run build` `__dirname` wskazuje `dist/` (plan.md D11).
  IMPORT_ARCHIVE_DIR: z.string().min(1).optional(),
  /**
   * Automatyczny polling dostawców URL (port `D4()`, blok 3f-3) — DOMYŚLNIE WYŁĄCZONY.
   *
   * ODSTĘPSTWO ŚWIADOME, decyzja zaklepana 2026-09-01 (roadmapa §5, blok 3f): produkcja
   * przełącznika nie ma, automat startuje tam bezwarunkowo. U nas musi być jawnie włączony,
   * bo włączony na stagingu odpytywałby REALNE serwery pięciu dostawców co 60 min,
   * podmieniając dane pod Anią w trakcie testów, i — przy braku dławika alertów (decyzja
   * 3f-2) — zalewałby tabelę alertów tempem ~24 wierszy na dobę na padniętego dostawcę.
   */
  IMPORT_SCHEDULER: flagaBoolDomyslnieWylaczona,
  /**
   * Przebieg zaraz po starcie schedulera, poza cyklem — DOMYŚLNIE WYŁĄCZONY, działa
   * wyłącznie razem z `IMPORT_SCHEDULER`.
   *
   * ODSTĘPSTWO ŚWIADOME, decyzja użytkownika 2026-09-01: oryginalne `D4()` stawia sam
   * `setInterval` (`:48125`), więc po włączeniu automatu przez GODZINĘ nie dzieje się nic.
   * Produkcji to nie dotyczy (proces żyje ciągle), ale na stagingu jest to różnica między
   * „widzę, że działa" a „nie wiem, czy wystartowało". Osobna zmienna, żeby proces
   * produkcyjny został 1:1 — przy obu domyślnych wartościach zachowanie jest identyczne
   * jak w oryginale.
   */
  IMPORT_SCHEDULER_PIERWSZY_PRZEBIEG: flagaBoolDomyslnieWylaczona,
  /**
   * ── Integracja Selly.pl (Iteracja 8a) ─────────────────────────────────────
   *
   * Sekrety klienta REST Selly — 1:1 z oryginałem (`mirror/backend/selly/client.cjs:21-24`),
   * łącznie z nazwami zmiennych. OPCJONALNE, i to jest świadome: `assertConfig()`
   * (`client.cjs:28-32`) rzuca dopiero przy PIERWSZYM wywołaniu API, więc brak konfiguracji
   * daje 500 na sześciu trasach zewnętrznych, a nie martwy proces. Cztery trasy lokalne
   * (`status`, `log`, `csv-status`, `generate-csv`) działają bez nich (plan.md D6).
   */
  SELLY_SHOP_URL: z.string().default(""),
  SELLY_CLIENT_ID: z.string().default(""),
  SELLY_CLIENT_SECRET: z.string().default(""),
  SELLY_SCOPE: z.string().min(1).default("READWRITE"),
  /**
   * Codzienny eksport CSV dla Selly (pull po stronie marketplace'u): katalog, nazwa pliku
   * i publiczny URL. Oryginał ma je zahardkodowane w DWÓCH miejscach
   * (`mirror/backend/selly/routes.cjs:300-301` i `:361`) oraz w skrypcie generatora
   * (`mirror/backend/generate_selly_export.cjs:8-9`).
   *
   * ODSTĘPSTWO ŚWIADOME (plan.md D4, decyzja użytkownika 2026-09-04): ścieżki idą do env
   * z domyślnymi = wartości produkcyjne, więc przy pustym `.env` zachowanie jest identyczne
   * jak w oryginale. Bez tego testy musiałyby pisać po `/home/admin`, a `csv-status` na
   * każdym innym środowisku zwracałby „Brak pliku CSV" niezależnie od stanu faktycznego.
   */
  SELLY_CSV_DIR: z
    .string()
    .min(1)
    .default("/home/admin/domains/agritires.eu/public_html/panel/ex-port-files"),
  SELLY_CSV_PLIK: z.string().min(1).default("sellycsv-vDsrvHnz7jmyqlvtubo4g3JA.csv"),
  SELLY_CSV_URL: z
    .string()
    .min(1)
    .default("https://agritires.eu/panel/ex-port-files/sellycsv-vDsrvHnz7jmyqlvtubo4g3JA.csv"),
});

export type Env = z.infer<typeof schemaEnv> & { cookieSecure: boolean };

export function wczytajEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const wynik = schemaEnv.safeParse(source);
  if (!wynik.success) {
    const problemy = wynik.error.issues
      .map((i) => `  - ${i.path.join(".") || "(env)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Nieprawidłowa konfiguracja środowiska:\n${problemy}\n` +
        `Uzupełnij zmienne (wzór: rebuild/backend/.env.example).`,
    );
  }
  const env = wynik.data;
  return {
    ...env,
    // Domyślnie Secure w produkcji/stagingu (za proxy HTTPS), bez Secure lokalnie po HTTP.
    cookieSecure: env.COOKIE_SECURE ?? env.NODE_ENV === "production",
  };
}
