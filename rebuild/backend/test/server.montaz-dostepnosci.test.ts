/**
 * Montaż modułu dostępności w `src/server.ts` (karta I15.10b, ticket 139).
 *
 * ⭐ TEN PLIK IMPORTUJE PRAWDZIWY `src/server.ts` — jedyny taki test w repo. Powód: montaż
 * żyje wyłącznie w module wejściowym procesu, a cała reszta suity buduje aplikację przez
 * `stworzApp`, więc dla niej jest niewidoczny. Test powtarzający wiring u siebie testowałby
 * własną kopię i przespałby regresję „ktoś wyciął montaż z `server.ts`".
 *
 * Zero atrap logiki: prawdziwa baza (tymczasowa, po migracjach), prawdziwy `wygenerujCsvSelly`,
 * prawdziwy `syncDelta`. Dowodem zamontowania jest PLIK CSV, który realnie powstaje w katalogu
 * tymczasowym po `zadajOdswiezenie()`. Podmieniamy jedną rzecz — `process.exit` — bo `zamknij()`
 * kończy proces, a to zabiłoby workera Vitesta.
 *
 * ⚠ `server.ts` ma efekty uboczne na poziomie modułu (`wczytajEnv`, `otworzBaze`, `listen`),
 * więc każdy scenariusz startuje od `vi.resetModules()` i importuje `server.js` RAZEM
 * z `dostepnosc.js` — globalne `domyslna` żyje w module, więc oba muszą pochodzić z tego samego,
 * świeżego rejestru. Bez resetu drugi scenariusz widziałby instancję z pierwszego.
 */
import { existsSync, mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { otworzBaze } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import { KATALOG_SCHEMATU } from "./gate/repo.js";

/** Adres gwarantowanie nieosiągalny — port 1 na pętli zwrotnej. Zero DNS, zero ruchu na zewnątrz. */
const SELLY_NIEOSIAGALNE = "http://127.0.0.1:1";

const PLIK_CSV = "selly-test.csv";

type UruchomionyServer = {
  zadajOdswiezenie: (dostawca: string) => void;
  /** Woła handler SIGTERM `server.ts` i CZEKA, aż domknie serwer (patrz `atrapaExit`). */
  zamknij: () => Promise<void>;
  sciezkaCsv: string;
};

const odczekaj = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wolny port od systemu. `PORT=0` (port efemeryczny) odpada, bo strażnik konfiguracji wymaga
 * `PORT >= 1` (`config/env.ts`) — a stały numer biłby się z równoległymi sesjami i workerami.
 */
function wolnyPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const sonda = createServer();
    sonda.once("error", reject);
    sonda.listen(0, "127.0.0.1", () => {
      const adres = sonda.address();
      if (adres === null || typeof adres === "string") {
        sonda.close(() => reject(new Error("nie udało się odczytać portu sondy")));
        return;
      }
      sonda.close(() => resolve(adres.port));
    });
  });
}

/** Kolejka modułu jest asynchroniczna (`setImmediate` + `await`), więc czekamy na SKUTEK. */
async function poczekajNaPlik(sciezka: string, limitMs = 10_000): Promise<boolean> {
  const koniec = Date.now() + limitMs;
  while (Date.now() < koniec) {
    if (existsSync(sciezka)) return true;
    await odczekaj(10);
  }
  return false;
}

describe("montaż modułu dostępności w server.ts", () => {
  let katalog: string;
  let envPrzed: NodeJS.ProcessEnv;
  let sluchaczePrzed: Set<unknown>;
  let uruchomiony: UruchomionyServer | null;
  let zamkniety: boolean;
  let atrapaExit: MockInstance<typeof process.exit>;

  beforeEach(() => {
    katalog = mkdtempSync(join(tmpdir(), "bridge-montaz-dostepnosci-"));
    envPrzed = { ...process.env };
    sluchaczePrzed = new Set([...process.listeners("SIGTERM"), ...process.listeners("SIGINT")]);
    uruchomiony = null;
    zamkniety = false;
    // `zamknij()` woła `process.exit(0)` w callbacku `server.close()`. Bez atrapy zginąłby
    // worker Vitesta; wywołanie atrapy jest przy okazji sygnałem, że domykanie dobiegło końca.
    atrapaExit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    vi.resetModules();
  });

  afterEach(async () => {
    if (uruchomiony && !zamkniety) await uruchomiony.zamknij();
    // `server.ts` dokłada handlery sygnałów — bez zdjęcia zostałyby na workerze Vitesta.
    for (const sygnal of ["SIGTERM", "SIGINT"] as const) {
      for (const sluchacz of process.listeners(sygnal)) {
        if (!sluchaczePrzed.has(sluchacz)) process.off(sygnal, sluchacz);
      }
    }
    vi.restoreAllMocks();
    process.env = envPrzed;
    rmSync(katalog, { recursive: true, force: true });
  });

  /**
   * Stawia bazę ze schematem, ustawia env i importuje `server.ts`. Bazę migrujemy PRZED
   * importem, bo `otworzBaze` migracji nie uruchamia (`src/db/index.ts`) — `server.ts` tylko
   * ją otworzy.
   */
  async function uruchomServer(tryb: "wylaczony" | "tylko-odczyt"): Promise<UruchomionyServer> {
    const sciezkaBazy = join(katalog, "data.db");
    const { sqlite } = otworzBaze(sciezkaBazy);
    zastosujMigracje(sqlite, KATALOG_SCHEMATU());
    sqlite.close();

    for (const klucz of Object.keys(process.env)) {
      if (klucz.startsWith("SELLY_") || klucz.startsWith("IMPORT_") || klucz.startsWith("PROMO_")) {
        delete process.env[klucz];
      }
    }
    Object.assign(process.env, {
      DB_PATH: sciezkaBazy,
      JWT_SECRET: "montaz-dostepnosci-test",
      CORS_ORIGINS: "",
      HOST: "127.0.0.1",
      PORT: String(await wolnyPort()),
      PROMO_WYGASZACZ_MINUTY: "0", // sam przebieg startowy, bez timera
      SELLY_TRYB: tryb,
      SELLY_SHOP_URL: SELLY_NIEOSIAGALNE,
      SELLY_CSV_DIR: join(katalog, "csv"),
      SELLY_CSV_PLIK: PLIK_CSV,
      SELLY_CSV_URL: "http://127.0.0.1:1/selly-test.csv",
    });

    const sluchaczeSigterm = new Set(process.listeners("SIGTERM"));
    await import("../src/server.js");
    const { zadajOdswiezenie } = await import("../src/selly/dostepnosc.js");

    const zamknij = process
      .listeners("SIGTERM")
      .find((sluchacz) => !sluchaczeSigterm.has(sluchacz));
    expect(zamknij, "server.ts ma zarejestrować handler SIGTERM").toBeDefined();

    uruchomiony = {
      zadajOdswiezenie,
      zamknij: async () => {
        zamkniety = true;
        (zamknij as (sygnal: string) => void)("SIGTERM");
        // `server.close()` domyka nasłuch asynchronicznie, a dopiero jego callback zamyka bazę
        // i woła `process.exit`. Czekamy na to TUTAJ — inaczej `afterEach` zdjąłby atrapę
        // `process.exit` przed czasem i Vitest zgłosiłby „process.exit unexpectedly called".
        const koniec = Date.now() + 5_000;
        while (atrapaExit.mock.calls.length === 0 && Date.now() < koniec) await odczekaj(10);
        expect(atrapaExit, "`zamknij()` ma domknąć serwer i zakończyć proces").toHaveBeenCalled();
      },
      sciezkaCsv: join(katalog, "csv", PLIK_CSV),
    };
    return uruchomiony;
  }

  it("po starcie `zadajOdswiezenie()` trafia do zamontowanej instancji, a po `zamknij()` już nie", async () => {
    const server = await uruchomServer("tylko-odczyt");

    expect(existsSync(server.sciezkaCsv), "przed zgłoszeniem CSV nie istnieje").toBe(false);

    // Montaż jest jedyną rzeczą, która nadaje temu wywołaniu skutek: bez zarejestrowanej
    // instancji `zadajOdswiezenie()` wraca po cichu (`selly/dostepnosc.ts`).
    server.zadajOdswiezenie("MO9");

    expect(
      await poczekajNaPlik(server.sciezkaCsv),
      "zamontowana instancja ma wygenerować CSV pod ścieżką z `SELLY_CSV_*`",
    ).toBe(true);

    // Po generatorze kolejka woła `syncDelta`, które przy nieosiągalnym Selly odrzuci obietnicę.
    // Moduł ma to ZŁAPAĆ (mechanizmem ponawiania jest okresowa synchronizacja), więc żaden
    // wyjątek nie ma wyciec i wywrócić tego testu.
    await odczekaj(200);

    await server.zamknij();

    unlinkSync(server.sciezkaCsv);

    // ⚠ Sam brak pliku NIE dowodzi wyrejestrowania: `zamknij()` zamyka też bazę, więc nadal
    // zarejestrowana instancja wywaliłaby się w generatorze i pliku też by nie było. Sprawdzone
    // sabotażem przy pisaniu tego testu — usunięcie `ustawDomyslnaSynchronizacjeDostepnosci(null)`
    // przechodziło na samej asercji o pliku. Rozróżnia je DOPIERO log: moduł łapie błąd biegu
    // i wypisuje go przez `console.error` (`selly/dostepnosc.ts`), więc „cisza" znaczy
    // „bieg w ogóle nie ruszył", czyli instancja jest zdjęta.
    const bledy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    server.zadajOdswiezenie("MO2");
    await odczekaj(200);

    expect(
      existsSync(server.sciezkaCsv),
      "po wyrejestrowaniu w `zamknij()` zgłoszenie ma być no-opem",
    ).toBe(false);
    expect(
      bledy,
      "wyrejestrowana instancja nie ma nawet PRÓBOWAĆ biegu — żadnego logu błędu",
    ).not.toHaveBeenCalled();
  });

  it("przy `SELLY_TRYB=wylaczony` montażu nie ma — zgłoszenie jest ciche", async () => {
    const server = await uruchomServer("wylaczony");

    // Bramka: staging dzieli VPS z produkcją, a `SELLY_CSV_DIR` domyślnie wskazuje katalog
    // produkcyjny — niezamontowany moduł nie ma prawa niczego wygenerować.
    expect(() => server.zadajOdswiezenie("MO9")).not.toThrow();
    await odczekaj(200);

    expect(existsSync(server.sciezkaCsv), "bez montażu żaden plik nie powstaje").toBe(false);
  });
});
