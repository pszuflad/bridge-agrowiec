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
