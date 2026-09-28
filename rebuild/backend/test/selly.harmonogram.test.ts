/**
 * Harmonogram Selly (karta I15.8) — rotacja Toru 2, tick i zawory bezpieczeństwa.
 *
 * ⚠ ŻADEN TEST NIE WOŁA PRAWDZIWEGO SELLY. Discovery stoi na atrapie klienta
 * (`test/gate/selly-atrapa.ts`), a większość przypadków nie dochodzi nawet do niej.
 *
 * Zegar jest wstrzykiwany (`teraz`), więc „04:30" i „HH:55" sprawdzamy bez czekania —
 * wzorzec jak `ZegarLimitera` w `limiter.ts`. Tick chodzi na realnym `setInterval`
 * z krótkim interwałem, tak jak w `test/scheduler.test.ts` (suita nie używa fake timers).
 */
import { afterEach, describe, expect, it } from "vitest";

import type { BazaSqlite } from "../src/db/index.js";
import { stworzTestowaBaze } from "./gate/baza.js";
import { stworzAtrapeSelly } from "./gate/selly-atrapa.js";
import { stworzDiscoveryTestowe } from "./gate/selly-rest.js";
import {
  ACTIVE_SUPPLIERS,
  isFirstOfMonthDay,
  runFullBatch,
  stworzHarmonogramSelly,
  suppliersForFullToday,
} from "../src/selly/rest/scheduler.js";
import { ostatnieWpisySync, POWOD_PRZERWANIA } from "../src/repos/selly.js";

/** Data lokalna — konstruktor `new Date(y, m, d, …)` czyta strefę procesu, tak jak harmonogram. */
const dzien = (rok: number, miesiac: number, dzienMies: number, gg = 12, mm = 0): Date =>
  new Date(rok, miesiac - 1, dzienMies, gg, mm, 0, 0);

/**
 * Wiersze `selly_sync_log` liczymy SQL-em, nie przez `ostatnieWpisySync` — ta trasa tnie
 * do 20, a JEDEN przebieg Toru 1 to `syncDelta` dla wszystkich dziesięciu dostawców,
 * czyli DZIESIĘĆ wpisów. Stąd `PRZEBIEG_TORU_1 = 10` niżej.
 */
const liczbaWpisow = (baza: { sqlite: BazaSqlite }, operacja?: string): number => {
  const sql = operacja
    ? "SELECT COUNT(*) AS n FROM selly_sync_log WHERE operacja = ?"
    : "SELECT COUNT(*) AS n FROM selly_sync_log";
  const wiersz = (operacja ? baza.sqlite.prepare(sql).get(operacja) : baza.sqlite.prepare(sql).get()) as {
    n: number;
  };
  return wiersz.n;
};

/** Ile wpisów logu zostawia jeden cykl Toru 1 — po jednym na dostawcę z `ACTIVE_SUPPLIERS`. */
const PRZEBIEG_TORU_1 = ACTIVE_SUPPLIERS.length;

const poczekajNa = async (warunek: () => boolean, msMax = 2000): Promise<void> => {
  const koniec = Date.now() + msMax;
  while (Date.now() < koniec) {
    if (warunek()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("warunek nie zaszedł w czasie");
};

describe("harmonogram Selly — rotacja Toru 2 (`suppliersForFullToday`)", () => {
  // Wrzesień 2026: 1 = wtorek. Pierwsza sobota = 5.09, pierwsza niedziela = 6.09.
  it("odtwarza rotację z kodu dla dni roboczych", () => {
    expect(suppliersForFullToday(dzien(2026, 9, 7))).toEqual(["MO1", "MO2"]); // poniedziałek
    expect(suppliersForFullToday(dzien(2026, 9, 8))).toEqual(["MO3", "MO4"]); // wtorek
    expect(suppliersForFullToday(dzien(2026, 9, 9))).toEqual(["MO5", "MO6"]); // środa
    expect(suppliersForFullToday(dzien(2026, 9, 10))).toEqual(["MO9"]); // czwartek
    expect(suppliersForFullToday(dzien(2026, 9, 11))).toEqual(["MO10"]); // piątek
  });

  /**
   * Specyfikacja Ani podaje dla środy samo „MO5"; kod ma „MO5 + MO6" i to kod wygrywa
   * (`docs/karty/I15.8/wejscie-114.md`). Asercja wyżej jest tego zapisem.
   */
  it("MO7 wychodzi TYLKO w pierwszą sobotę miesiąca", () => {
    expect(suppliersForFullToday(dzien(2026, 9, 5))).toEqual(["MO7"]); // 1. sobota
    expect(suppliersForFullToday(dzien(2026, 9, 12))).toEqual([]); // 2. sobota
    expect(suppliersForFullToday(dzien(2026, 9, 19))).toEqual([]); // 3. sobota
    expect(suppliersForFullToday(dzien(2026, 9, 26))).toEqual([]); // 4. sobota
  });

  it("MO8 wychodzi TYLKO w pierwszą niedzielę miesiąca", () => {
    expect(suppliersForFullToday(dzien(2026, 9, 6))).toEqual(["MO8"]); // 1. niedziela
    expect(suppliersForFullToday(dzien(2026, 9, 13))).toEqual([]); // 2. niedziela
    expect(suppliersForFullToday(dzien(2026, 9, 27))).toEqual([]); // 4. niedziela
  });

  it("`isFirstOfMonthDay` to granica `date <= 7`, nie „pierwsze 7 dni tygodnia”", () => {
    expect(isFirstOfMonthDay(dzien(2026, 8, 1), 6)).toBe(true); // 1.08.2026 = sobota
    expect(isFirstOfMonthDay(dzien(2026, 8, 8), 6)).toBe(false); // 8.08 = druga sobota
    expect(isFirstOfMonthDay(dzien(2026, 8, 1), 0)).toBe(false); // zły dzień tygodnia
  });

  it("każdy dostawca z rotacji jest w ACTIVE_SUPPLIERS", () => {
    const wRotacji = new Set<string>();
    for (let d = 1; d <= 31; d++) {
      for (const s of suppliersForFullToday(dzien(2026, 8, d))) wRotacji.add(s);
    }
    for (const s of wRotacji) expect(ACTIVE_SUPPLIERS).toContain(s);
    // MO7/MO8 pojawiają się w pełnym miesiącu, więc pokrycie jest kompletne.
    expect(wRotacji.size).toBe(ACTIVE_SUPPLIERS.length);
  });
});

describe("harmonogram Selly — tick", () => {
  const sprzataczki: (() => void)[] = [];
  afterEach(() => {
    while (sprzataczki.length) sprzataczki.pop()!();
  });

  /** Stawia harmonogram na sterowanym zegarze; zwraca uchwyt i licznik biegów Toru 1/2. */
  function stanowisko(godzina: () => Date, tryb: "pelny" | "wylaczony" | "tylko-odczyt" = "pelny") {
    const baza = stworzTestowaBaze();
    const atrapa = stworzAtrapeSelly();
    const { discovery } = stworzDiscoveryTestowe(atrapa.klient);
    const h = stworzHarmonogramSelly({
      db: baza.db,
      discovery,
      tryb,
      teraz: godzina,
      interwalMs: 20,
    });
    sprzataczki.push(() => {
      h.zatrzymaj();
      baza.posprzataj();
    });
    return { h, baza, atrapa };
  }

  it("odpala Tor 1 o HH:55 i o fallbackach HH:10/25/40, a poza nimi nie", async () => {
    // `syncDelta` na pustej bazie nic nie wyśle, ale ZAŁOŻY wpis w `selly_sync_log`
    // — i to jest nasz licznik przebiegów, bez dotykania Selly.
    let chwila = dzien(2026, 9, 21, 9, 11);
    const { h, baza } = stanowisko(() => chwila);
    h.uruchom();

    const wpisy = (): number => liczbaWpisow(baza, "sync_delta");

    // 9:11 — nie jest minutą Toru 1.
    await new Promise((r) => setTimeout(r, 80));
    expect(wpisy()).toBe(0);

    const minuty = [10, 25, 40, 55];
    for (const [i, mm] of minuty.entries()) {
      chwila = dzien(2026, 9, 21, 9, mm);
      await poczekajNa(() => wpisy() >= (i + 1) * PRZEBIEG_TORU_1);
    }
    expect(wpisy()).toBe(minuty.length * PRZEBIEG_TORU_1);
  });

  it("ta sama minuta nie odpala Toru 1 dwa razy", async () => {
    const chwila = dzien(2026, 9, 21, 9, 55);
    const { h, baza } = stanowisko(() => chwila);
    h.uruchom();

    await poczekajNa(() => liczbaWpisow(baza, "sync_delta") >= PRZEBIEG_TORU_1);
    // Kilka kolejnych ticków w tej samej minucie — `lastRunKey` ma je wygasić.
    await new Promise((r) => setTimeout(r, 120));
    expect(liczbaWpisow(baza, "sync_delta")).toBe(PRZEBIEG_TORU_1);
  });

  it("Tor 2 rusza o 04:30 i tylko raz na dobę", async () => {
    // Poniedziałek 21.09.2026 → rotacja MO1+MO2, więc Tor 2 ma co robić.
    let chwila = dzien(2026, 9, 21, 4, 30);
    const { h, baza } = stanowisko(() => chwila);
    h.uruchom();

    await poczekajNa(() => liczbaWpisow(baza, "sync_full") >= 2);
    expect(liczbaWpisow(baza, "sync_full")).toBe(2); // MO1 + MO2

    // Kolejne ticki tej samej doby (04:31 nie jest minutą Toru 1) nic nie dokładają.
    chwila = dzien(2026, 9, 21, 4, 31);
    await new Promise((r) => setTimeout(r, 120));
    expect(liczbaWpisow(baza, "sync_full")).toBe(2);
  });

  it("o 04:30 w dzień bez rotacji Tor 2 nie rusza", async () => {
    // Druga sobota miesiąca — `suppliersForFullToday` daje pustą listę.
    const chwila = dzien(2026, 9, 12, 4, 30);
    const { h, baza } = stanowisko(() => chwila);
    h.uruchom();

    await new Promise((r) => setTimeout(r, 120));
    expect(liczbaWpisow(baza)).toBe(0);
  });
});

describe("harmonogram Selly — zawory (odstępstwa świadome I15.8)", () => {
  const sprzataczki: (() => void)[] = [];
  afterEach(() => {
    while (sprzataczki.length) sprzataczki.pop()!();
  });

  /**
   * ODSTĘPSTWO 2: przy `SELLY_TRYB=wylaczony` discovery myli blokadę odczytu z „produkt
   * nie istnieje" i zakłada DUPLIKATY w sklepie (`wejscie-108.md`), więc harmonogram
   * w ogóle nie startuje. Produkcja tego zaworu nie ma.
   */
  it("nie startuje przy SELLY_TRYB=wylaczony", async () => {
    const baza = stworzTestowaBaze();
    const atrapa = stworzAtrapeSelly();
    const { discovery } = stworzDiscoveryTestowe(atrapa.klient);
    const h = stworzHarmonogramSelly({
      db: baza.db,
      discovery,
      tryb: "wylaczony",
      teraz: () => dzien(2026, 9, 21, 9, 55),
      interwalMs: 20,
    });
    sprzataczki.push(() => {
      h.zatrzymaj();
      baza.posprzataj();
    });

    h.uruchom();
    expect(h.czyDziala()).toBe(false);
    await new Promise((r) => setTimeout(r, 120));
    expect(ostatnieWpisySync(baza.db)).toHaveLength(0);
  });

  it("startuje przy tylko-odczyt (zawór jest węższy niż „tylko pelny”)", () => {
    const baza = stworzTestowaBaze();
    const atrapa = stworzAtrapeSelly();
    const { discovery } = stworzDiscoveryTestowe(atrapa.klient);
    const h = stworzHarmonogramSelly({
      db: baza.db,
      discovery,
      tryb: "tylko-odczyt",
      teraz: () => dzien(2026, 9, 21, 9, 11),
      interwalMs: 60_000,
    });
    sprzataczki.push(() => {
      h.zatrzymaj();
      baza.posprzataj();
    });

    h.uruchom();
    expect(h.czyDziala()).toBe(true);
  });

  /**
   * ODSTĘPSTWO 3 (`wejscie-117.md`): wpisy `w_trakcie` zostawione przez ubity proces
   * domykamy przy starcie, żeby `sync-status` nie pokazywał wiecznie trwającego cyklu.
   */
  it("domyka osierocone wpisy `w_trakcie` przy starcie, nie ruszając zamkniętych", () => {
    const baza = stworzTestowaBaze();
    const atrapa = stworzAtrapeSelly();
    const { discovery } = stworzDiscoveryTestowe(atrapa.klient);

    baza.sqlite
      .prepare(
        `INSERT INTO selly_sync_log (operacja, dostawca_kod, rozpoczeto, status)
         VALUES ('sync_full', 'MO2', '2026-09-10 04:30:00', 'w_trakcie')`,
      )
      .run();
    baza.sqlite
      .prepare(
        `INSERT INTO selly_sync_log (operacja, dostawca_kod, rozpoczeto, zakonczono, status)
         VALUES ('sync_delta', 'MO1', '2026-09-20 09:55:00', '2026-09-20 09:55:03', 'zakonczono')`,
      )
      .run();

    const h = stworzHarmonogramSelly({
      db: baza.db,
      discovery,
      tryb: "pelny",
      teraz: () => dzien(2026, 9, 21, 9, 11),
      interwalMs: 60_000,
    });
    sprzataczki.push(() => {
      h.zatrzymaj();
      baza.posprzataj();
    });

    h.uruchom();

    const wpisy = ostatnieWpisySync(baza.db);
    const osierocony = wpisy.find((w) => w.dostawca_kod === "MO2")!;
    expect(osierocony.status).toBe("blad");
    expect(osierocony.zakonczono).not.toBeNull();
    expect(JSON.parse(osierocony.szczegoly_json!)).toEqual({ powod: POWOD_PRZERWANIA });

    const zamkniety = wpisy.find((w) => w.dostawca_kod === "MO1")!;
    expect(zamkniety.status).toBe("zakonczono");
    expect(zamkniety.zakonczono).toBe("2026-09-20 09:55:03");
  });
});

describe("harmonogram Selly — `runFullBatch`", () => {
  /** Ile stron katalogu Selly przewertowano — tyle kosztuje zbudowanie cache kodów. */
  const stronyKatalogu = (partia: string[]): Promise<number> => {
    const baza = stworzTestowaBaze();
    const atrapa = stworzAtrapeSelly();
    const { discovery } = stworzDiscoveryTestowe(atrapa.klient);
    return runFullBatch(baza.db, discovery, { suppliers: partia })
      .then(() => atrapa.liczba("listProductsPage"))
      .finally(() => baza.posprzataj());
  };

  /**
   * `buildCache: i === 0` — cache kodów Selly (~75 s na produkcji) budowany RAZ na partię,
   * nie per dostawca (`docs/karty/I15.8/wejscie-109.md`). Dowód: partia trzech dostawców
   * wertuje katalog Selly tyle samo razy, co partia jednego. Bez tego byłoby trzykrotnie.
   */
  it("buduje cache kodów Selly raz na partię, niezależnie od jej rozmiaru", async () => {
    const jeden = await stronyKatalogu(["MO1"]);
    const trzej = await stronyKatalogu(["MO1", "MO2", "MO3"]);

    expect(jeden).toBeGreaterThan(0);
    expect(trzej).toBe(jeden);
  });

  it("pusta rotacja kończy się pustym wynikiem, bez dotykania Selly", async () => {
    const baza = stworzTestowaBaze();
    const atrapa = stworzAtrapeSelly();
    const { discovery, limiter } = stworzDiscoveryTestowe(atrapa.klient);
    try {
      const wynik = await runFullBatch(baza.db, discovery, { suppliers: [] });
      expect(wynik).toEqual([]);
      expect(limiter.zgody()).toBe(0);
      expect(atrapa.wywolania).toHaveLength(0);
    } finally {
      baza.posprzataj();
    }
  });
});
