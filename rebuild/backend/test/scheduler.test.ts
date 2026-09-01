/**
 * Scheduler pollingu dostawców URL — blok 3f-3, port `D4()` (`backend-index.cjs:48118-48131`).
 *
 * ⚠ NIC TU NIE JEST MOCKOWANE — ani `fetch`, ani timery. Scenariusz „interwał faktycznie
 * odpala pobranie" stawia PRAWDZIWY serwer HTTP na porcie efemerycznym i używa PRAWDZIWEGO
 * `setInterval`; krótki interwał bierze się z ułamkowej `czestotliwoscMinuty` (0,005 min =
 * 300 ms) wpisanej wprost do bazy. SQLite trzyma taką wartość jako REAL mimo deklaracji
 * kolumny INTEGER, więc kod produkcyjny nie musi o tym wiedzieć — mnożenie `× 60 × 1000`
 * jest to samo. Fałszywe timery ukryłyby dokładnie tę warstwę, o którą chodzi w gate.
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { wczytajEnv } from "../src/config/env.js";
import { alerts, auditLog, products, stagingItems, suppliers } from "../src/db/schema.js";
import { stworzScheduler, type Scheduler } from "../src/import/scheduler.js";
import { synchronizujDostawce } from "../src/import/synchronizuj.js";
import { stworzSrodowiskoTestowe, SEKRET_TESTOWY, type SrodowiskoTestowe } from "./gate/index.js";

const CENNIK_MO1 = readFileSync(join(import.meta.dirname, "charakteryzacja", "probki", "MO1.csv"));

/** 0,005 min = 300 ms — patrz nagłówek pliku. */
const SZYBKI_INTERWAL_MIN = 0.005;

type Serwer = { url: (sciezka?: string) => string; trafienia: () => number; zamknij: () => Promise<void> };

async function postawSerwerCennika(): Promise<Serwer> {
  let trafienia = 0;
  const serwer: Server = createServer((_zad, odp) => {
    trafienia += 1;
    odp.writeHead(200, { "content-type": "text/csv" });
    odp.end(CENNIK_MO1);
  });
  await new Promise<void>((gotowe) => serwer.listen(0, "127.0.0.1", gotowe));
  const port = (serwer.address() as AddressInfo).port;
  return {
    url: (sciezka = "/cennik.csv") => `http://127.0.0.1:${port}${sciezka}`,
    trafienia: () => trafienia,
    zamknij: () =>
      new Promise<void>((gotowe) => {
        serwer.closeAllConnections?.();
        serwer.close(() => gotowe());
      }),
  };
}

/** Czeka na warunek odpytując go co 20 ms — bez `sleep` na sztywno i bez fałszywych timerów. */
async function poczekajNa(warunek: () => boolean, limitMs = 5_000): Promise<void> {
  const koniec = Date.now() + limitMs;
  while (!warunek()) {
    if (Date.now() > koniec) throw new Error("Warunek nie zaszedł w wyznaczonym czasie");
    await new Promise((gotowe) => setTimeout(gotowe, 20));
  }
}

describe("scheduler importu (3f-3)", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;
  const serwery: Serwer[] = [];
  const schedulery: Scheduler[] = [];

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(async () => {
    await Promise.all(serwery.map((s) => s.zamknij()));
    srodowisko.posprzataj();
  });

  beforeEach(() => {
    srodowisko.db.delete(stagingItems).run();
    srodowisko.db.delete(auditLog).run();
    srodowisko.db.delete(alerts).run();
    srodowisko.db.delete(products).run();
    srodowisko.db.delete(suppliers).run();
  });

  // Każdy scheduler postawiony w teście jest gaszony — inaczej wiszący timer trzymałby proces.
  afterEach(() => {
    for (const s of schedulery.splice(0)) s.zatrzymaj();
    vi.restoreAllMocks();
  });

  const zapamietajSerwer = async () => {
    const s = await postawSerwerCennika();
    serwery.push(s);
    return s;
  };

  /**
   * ⚠ `ostatniPlik` MUSI być domyślnie świeży — inaczej dostawca w ogóle nie kwalifikuje się
   * do automatu i połowa scenariuszy testowałaby nie to, co trzeba. Powód siedzi
   * w `przeliczStatus` (port `:45026`): przy `ostatniPlik = null` i zerze produktów status
   * liczony w locie wychodzi „wstrzymany", niezależnie od tego, co stoi w kolumnie.
   * To także realna pułapka stagingu — patrz test „świeża baza bez produktów".
   */
  const zasiej = (nadpisania: Record<string, unknown> = {}) => {
    srodowisko.db
      .insert(suppliers)
      .values({
        kod: "MO1",
        nazwa: "Bohnenkamp",
        formatPliku: "csv",
        sposobDostarczania: "url",
        czestotliwoscMinuty: 60,
        url: "http://127.0.0.1:1/nieuzywany.csv",
        ostatniPlik: new Date().toISOString(),
        ...nadpisania,
      })
      .run();
  };

  /** Jedna pozycja w katalogu — potrzebna tam, gdzie ma zadziałać status Z KOLUMNY. */
  const zasiejProdukt = (kodDostawcy: string) => {
    srodowisko.db
      .insert(products)
      .values({
        kod: `${kodDostawcy}-1`,
        nazwa: "Opona",
        marka: "X",
        kategoria: "Opony",
        dostawca: kodDostawcy,
        magazyn: "PL",
        stan: 4,
        cenaZakupu: 100,
        cenaSprzedazy: 150,
        marzaPct: 50,
        dataAktualizacji: new Date().toISOString(),
      })
      .run();
  };

  /**
   * Scheduler z prawdziwą synchronizacją (żywy `fetch` do serwera z testu). `odstep…= 0`
   * dotyczy WYŁĄCZNIE rozrzutu przebiegów startowych, nie interwałów.
   */
  const stworz = (opcje: { pierwszyPrzebieg?: boolean } = {}) => {
    const scheduler = stworzScheduler({
      db: srodowisko.db,
      synchronizuj: synchronizujDostawce({
        db: srodowisko.db,
        katalogArchiwum: srodowisko.katalogArchiwum,
      }),
      odstepPierwszegoPrzebieguMs: 0,
      ...opcje,
    });
    schedulery.push(scheduler);
    return scheduler;
  };

  describe("GATE — przełącznik IMPORT_SCHEDULER", () => {
    it("jest domyślnie WYŁĄCZONY, gdy zmiennej nie ma w środowisku", () => {
      const env = wczytajEnv({
        NODE_ENV: "test",
        DB_PATH: srodowisko.sciezka,
        JWT_SECRET: SEKRET_TESTOWY,
      } as NodeJS.ProcessEnv);

      expect(env.IMPORT_SCHEDULER).toBe(false);
      expect(env.IMPORT_SCHEDULER_PIERWSZY_PRZEBIEG).toBe(false);
    });

    it("włącza się dopiero jawną wartością", () => {
      const env = wczytajEnv({
        NODE_ENV: "test",
        DB_PATH: srodowisko.sciezka,
        JWT_SECRET: SEKRET_TESTOWY,
        IMPORT_SCHEDULER: "true",
        IMPORT_SCHEDULER_PIERWSZY_PRZEBIEG: "1",
      } as NodeJS.ProcessEnv);

      expect(env.IMPORT_SCHEDULER).toBe(true);
      expect(env.IMPORT_SCHEDULER_PIERWSZY_PRZEBIEG).toBe(true);
    });

    it("bez `uruchom()` nie stawia ANI JEDNEGO timera, choćby dostawcy się kwalifikowali", () => {
      zasiej();
      const scheduler = stworz();

      // Samo stworzenie obiektu jest bezczynne — to jest gwarancja, na której stoi
      // domyślnie wyłączony przełącznik: `server.ts` woła `uruchom()` tylko pod warunkiem.
      expect(scheduler.czyDziala()).toBe(false);
      expect(scheduler.liczbaTimerow()).toBe(0);
    });

    it("`stworzApp` NIE uruchamia schedulera — cała suita buduje aplikację i zero timerów", () => {
      // Odstępstwo w umiejscowieniu (decyzja 2026-09-01): start jest w `server.ts` po
      // `listen()`, nie w `stworzApp` jak `D4()` w `M4()`. Ten test pilnuje, żeby ktoś
      // kiedyś nie „poprawił" tego z powrotem — timery w fabryce aplikacji weszłyby wtedy
      // do każdego scenariusza w suicie.
      const zrodlo = readFileSync(join(import.meta.dirname, "..", "src", "app.ts"), "utf8");
      expect(zrodlo).not.toContain("stworzScheduler");
      expect(zrodlo).not.toContain("setInterval");
    });
  });

  describe("GATE — dobór dostawców 1:1 z `D4()`", () => {
    it("bierze tylko `url` + URL + częstotliwość + status inny niż wstrzymany", () => {
      zasiej({ kod: "MO2", url: "http://przyklad/1.csv" }); // ✅ komplet
      zasiej({ kod: "MO3", sposobDostarczania: "mail", url: "http://przyklad/2.csv" }); // ✗ sposób
      zasiej({ kod: "MO4", url: null }); // ✗ brak URL
      zasiej({ kod: "MO5", url: "http://przyklad/3.csv", czestotliwoscMinuty: null }); // ✗ brak częst.
      // ✗ wstrzymany — żeby status Z KOLUMNY w ogóle doszedł do głosu, dostawca musi mieć
      // produkty i NIE mieć `ostatniPlik` (patrz `przeliczStatus`).
      zasiej({ kod: "MO6", url: "http://przyklad/4.csv", status: "wstrzymany", ostatniPlik: null });
      zasiejProdukt("MO6");
      zasiej({ kod: "MO7", url: "http://przyklad/5.csv", status: "blad" }); // ✅ „blad" NIE wyklucza

      const scheduler = stworz();
      expect(scheduler.uruchom()).toBe(2);
      expect(scheduler.liczbaTimerow()).toBe(2);
    });

    it("ŚWIEŻA BAZA BEZ PRODUKTÓW: nikt się nie kwalifikuje, choć wszystko wygląda poprawnie", () => {
      // Pułapka stagingu, bliźniacza do 30 dni. `przeliczStatus` przy `ostatniPlik = null`
      // i zerze produktów zwraca „wstrzymany" NIEZALEŻNIE od kolumny — więc na bazie
      // postawionej od zera automat planuje ZERO dostawców, mimo poprawnych URL-i
      // i częstotliwości. Odtwarzane 1:1; ratuje przed tym druga linia logu.
      zasiej({ kod: "MO2", url: "http://przyklad/1.csv", status: "aktywny", ostatniPlik: null });
      const log = vi.spyOn(console, "log").mockImplementation(() => {});

      expect(stworz().uruchom()).toBe(0);
      expect(log.mock.calls.map((c) => String(c[0])).join("\n")).toContain(
        "brak pliku i zero produktów",
      );
    });

    it("`czestotliwoscMinuty = 0` wypada — oryginał testuje prawdziwościowo, nie `!= null`", () => {
      zasiej({ url: "http://przyklad/1.csv", czestotliwoscMinuty: 0 });

      expect(stworz().uruchom()).toBe(0);
    });

    it("loguje treść 1:1 z oryginałem plus NASZĄ linię z powodami pominięcia", () => {
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      zasiej({ kod: "MO2", url: "http://przyklad/1.csv" });
      zasiej({ kod: "MO3", sposobDostarczania: "mail", url: "http://przyklad/2.csv" });

      stworz().uruchom();

      const linie = log.mock.calls.map((c) => String(c[0]));
      expect(linie).toContain("[scheduler] zaplanowano 1 dostawców z URL polling");
      expect(linie.some((l) => l.startsWith("[scheduler] pominięto:"))).toBe(true);
      expect(linie.join("\n")).toContain("MO3 (sposób dostarczania: mail)");
    });

    it("PUŁAPKA 30 DNI: status PRZELICZONY wyklucza z automatu i mówi o tym w logu", () => {
      // `listSuppliers()` (`:45026`) przelicza status w locie: `ostatniPlik` starszy niż
      // 30 dni ⇒ „wstrzymany". W bazie stoi „aktywny" — i właśnie ta rozbieżność jest
      // pułapką, przez którą staging ze snapshotu potrafi zaplanować ZERO dostawców.
      const dawno = new Date(Date.now() - 40 * 86_400_000).toISOString();
      zasiej({ url: "http://przyklad/1.csv", status: "aktywny", ostatniPlik: dawno });
      const log = vi.spyOn(console, "log").mockImplementation(() => {});

      expect(stworz().uruchom()).toBe(0);

      const wBazie = srodowisko.sqlite
        .prepare("SELECT status FROM suppliers WHERE kod = 'MO1'")
        .get() as { status: string };
      expect(wBazie.status).toBe("aktywny"); // kolumna nietknięta — status jest liczony

      const linie = log.mock.calls.map((c) => String(c[0])).join("\n");
      expect(linie).toContain("[scheduler] zaplanowano 0 dostawców z URL polling");
      expect(linie).toContain("status wstrzymany PRZELICZONY");
      expect(linie).toContain("ostatni plik sprzed 40 dni");
    });
  });

  describe("GATE — ponowne wywołanie nie mnoży timerów", () => {
    it("trzykrotne `uruchom()` zostawia tyle samo timerów co jedno", () => {
      zasiej({ kod: "MO2", url: "http://przyklad/1.csv" });
      zasiej({ kod: "MO3", url: "http://przyklad/2.csv" });
      const scheduler = stworz();

      scheduler.uruchom();
      scheduler.uruchom();
      scheduler.uruchom();

      expect(scheduler.liczbaTimerow()).toBe(2);
    });

    it("stary interwał jest GASZONY, nie tylko nadpisywany w mapie", async () => {
      const serwer = await zapamietajSerwer();
      zasiej({ url: serwer.url(), czestotliwoscMinuty: SZYBKI_INTERWAL_MIN });
      const scheduler = stworz();

      scheduler.uruchom();
      await poczekajNa(() => serwer.trafienia() >= 1);

      // Przeplanowanie na interwał godzinny: gdyby stary timer został, trafienia dalej
      // by rosły. Po `clearInterval` mają stanąć.
      srodowisko.db.update(suppliers).set({ czestotliwoscMinuty: 60 }).run();
      scheduler.przeplanuj();
      const poPrzeplanowaniu = serwer.trafienia();
      await new Promise((gotowe) => setTimeout(gotowe, 400));

      expect(serwer.trafienia()).toBe(poPrzeplanowaniu);
      expect(scheduler.liczbaTimerow()).toBe(1);
    });
  });

  describe("GATE — interwał faktycznie odpala pobranie", () => {
    it("po dwóch interwałach serwer dostawcy ma dwa trafienia, a staging pozycje", async () => {
      const serwer = await zapamietajSerwer();
      zasiej({ url: serwer.url(), czestotliwoscMinuty: SZYBKI_INTERWAL_MIN });

      stworz().uruchom();
      await poczekajNa(() => serwer.trafienia() >= 2);

      // Pobranie przeszło CAŁĄ ścieżkę importu, nie tylko HTTP.
      await poczekajNa(() => {
        const c = srodowisko.sqlite
          .prepare("SELECT count(*) AS c FROM staging_items")
          .get() as { c: number };
        return c.c > 0;
      });
      const dostawca = srodowisko.sqlite
        .prepare("SELECT ostatnia_sync, ostatni_plik, status FROM suppliers WHERE kod = 'MO1'")
        .get() as Record<string, unknown>;
      expect(dostawca.ostatnia_sync).toBeTruthy();
      expect(dostawca.ostatni_plik).toBeTruthy();
      expect(dostawca.status).toBe("aktywny");
    });

    it("awaria dostawcy nie wywraca pętli — kolejny interwał i tak przychodzi", async () => {
      // URL nie do połączenia: `fetch` odrzuca, `synchronizujDostawce` zapisuje alert,
      // a scheduler ma to przyjąć `.catch()`em i chodzić dalej (`:48127`).
      zasiej({ url: "http://127.0.0.1:1/brak.csv", czestotliwoscMinuty: SZYBKI_INTERWAL_MIN });
      vi.spyOn(console, "error").mockImplementation(() => {});

      const scheduler = stworz();
      scheduler.uruchom();
      await poczekajNa(() => {
        const c = srodowisko.sqlite.prepare("SELECT count(*) AS c FROM alerts").get() as { c: number };
        return c.c >= 2;
      });

      const typy = srodowisko.sqlite.prepare("SELECT DISTINCT typ FROM alerts").all() as {
        typ: string;
      }[];
      expect(typy.map((t) => t.typ)).toEqual(["Błąd pobierania"]);
      expect(scheduler.liczbaTimerow()).toBe(1);
    });
  });

  describe("GATE — `status: wstrzymany` wyklucza z automatu, ręcznie przechodzi", () => {
    it("automat NIE pobiera wstrzymanego, a `synchronizuj-teraz` pobiera go mimo to", async () => {
      // ⚠ ODTWORZENIE 1:1 RZECZY MYLĄCEJ. Blokada trzyma się DRUGIEJ bramki, nie doboru:
      // `D4()` filtruje po statusie PRZELICZANYM (`listSuppliers`, `:45026`), a ten przy
      // świeżym `ostatniPlik` w ogóle nie patrzy na kolumnę — więc wstrzymany dostawca
      // DOSTAJE timer. Pobrania nie ma dopiero dlatego, że `L4()` sprawdza status
      // z SUROWEGO wiersza (`getSupplierByKod`, `:48039`) i kończy na „Wstrzymany".
      // Skutek dla Ani jest ten sam (zero pobrań), ale mechanizm inny, niż sugeruje kod.
      const serwer = await zapamietajSerwer();
      zasiej({ url: serwer.url(), czestotliwoscMinuty: SZYBKI_INTERWAL_MIN, status: "wstrzymany" });

      const scheduler = stworz();
      expect(scheduler.uruchom()).toBe(1); // timer JEST — bramka jest w `L4()`, nie w `D4()`
      await new Promise((gotowe) => setTimeout(gotowe, 600));
      expect(serwer.trafienia()).toBe(0); // ale ani jednego pobrania

      const odp = await request(srodowisko.app)
        .post("/api/dostawcy/MO1/synchronizuj-teraz")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(odp.status).toBe(200);
      expect((odp.body as { ok: boolean }).ok).toBe(true);
      expect(serwer.trafienia()).toBe(1);
    });

    it("wstrzymany BEZ `ostatniPlik` i z produktami nie dostaje nawet timera", async () => {
      const serwer = await zapamietajSerwer();
      zasiej({
        url: serwer.url(),
        czestotliwoscMinuty: SZYBKI_INTERWAL_MIN,
        status: "wstrzymany",
        ostatniPlik: null,
      });
      zasiejProdukt("MO1");

      const scheduler = stworz();
      expect(scheduler.uruchom()).toBe(0);
      await new Promise((gotowe) => setTimeout(gotowe, 400));
      expect(serwer.trafienia()).toBe(0);
    });

    it("scheduler woła synchronizację BEZ flagi `recznie` — blokada ma działać", async () => {
      // Kontrola wprost na podstawionej funkcji: gdyby scheduler podawał `{recznie:true}`,
      // wstrzymany dostawca byłby pobierany automatem, czego oryginał nie robi (`L4(n.kod)`).
      zasiej({ url: "http://przyklad/1.csv", czestotliwoscMinuty: SZYBKI_INTERWAL_MIN });
      const wywolania: unknown[][] = [];
      const scheduler = stworzScheduler({
        db: srodowisko.db,
        synchronizuj: async (...argumenty) => {
          wywolania.push(argumenty);
          return { ok: false, error: "atrapa" };
        },
      });
      schedulery.push(scheduler);

      scheduler.uruchom();
      await poczekajNa(() => wywolania.length >= 1);

      expect(wywolania[0]).toEqual(["MO1"]);
    });
  });

  describe("GATE — przebieg startowy (odstępstwo za osobnym przełącznikiem)", () => {
    it("domyślnie NIE odpala niczego przed pierwszym interwałem", async () => {
      const serwer = await zapamietajSerwer();
      zasiej({ url: serwer.url(), czestotliwoscMinuty: 60 }); // godzinny interwał

      stworz().uruchom();
      await new Promise((gotowe) => setTimeout(gotowe, 400));

      expect(serwer.trafienia()).toBe(0);
    });

    it("z `pierwszyPrzebieg` pobiera od razu, nie czekając interwału", async () => {
      const serwer = await zapamietajSerwer();
      zasiej({ url: serwer.url(), czestotliwoscMinuty: 60 });

      stworz({ pierwszyPrzebieg: true }).uruchom();
      await poczekajNa(() => serwer.trafienia() >= 1);

      expect(serwer.trafienia()).toBe(1);
    });

    it("rozrzuca przebiegi startowe w czasie, żeby pięciu dostawców nie ruszyło naraz", async () => {
      zasiej({ kod: "MO2", url: "http://przyklad/1.csv" });
      zasiej({ kod: "MO3", url: "http://przyklad/2.csv" });
      zasiej({ kod: "MO4", url: "http://przyklad/3.csv" });
      const znaczniki: number[] = [];
      const scheduler = stworzScheduler({
        db: srodowisko.db,
        synchronizuj: async () => {
          znaczniki.push(Date.now());
          return { ok: false, error: "atrapa" };
        },
        pierwszyPrzebieg: true,
        odstepPierwszegoPrzebieguMs: 120,
      });
      schedulery.push(scheduler);

      scheduler.uruchom();
      await poczekajNa(() => znaczniki.length === 3);

      expect(znaczniki[2]! - znaczniki[0]!).toBeGreaterThanOrEqual(200);
    });
  });

  describe("GATE — PATCH przeplanowuje automat (odstępstwo 2026-09-01)", () => {
    it("zmiana `czestotliwoscMinuty` z panelu wchodzi w życie BEZ restartu procesu", async () => {
      const serwer = await zapamietajSerwer();
      zasiej({ url: serwer.url(), czestotliwoscMinuty: 60 });
      const scheduler = stworz();
      scheduler.uruchom();

      // Godzinny interwał — nic się nie dzieje…
      await new Promise((gotowe) => setTimeout(gotowe, 200));
      expect(serwer.trafienia()).toBe(0);

      const id = (
        srodowisko.sqlite.prepare("SELECT id FROM suppliers WHERE kod = 'MO1'").get() as {
          id: number;
        }
      ).id;
      // …aż do PATCH-a. Trasa dostaje ten sam scheduler, co `server.ts` w produkcji.
      const app = (
        await import("../src/app.js")
      ).stworzApp({
        env: srodowisko.env,
        db: srodowisko.db,
        przeplanujScheduler: () => scheduler.przeplanuj(),
      });
      const odp = await request(app)
        .patch(`/api/dostawcy/${id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ czestotliwoscMinuty: SZYBKI_INTERWAL_MIN });

      expect(odp.status).toBe(200);
      await poczekajNa(() => serwer.trafienia() >= 1);
    });

    it("przeplanowanie NIE odpala przebiegu startowego, nawet gdy jest włączony", async () => {
      const serwer = await zapamietajSerwer();
      zasiej({ url: serwer.url(), czestotliwoscMinuty: 60 });
      const scheduler = stworz({ pierwszyPrzebieg: true });

      scheduler.uruchom();
      await poczekajNa(() => serwer.trafienia() >= 1);

      // Każdy zapis w panelu waliłby inaczej w pięć serwerów dostawców naraz.
      scheduler.przeplanuj();
      scheduler.przeplanuj();
      await new Promise((gotowe) => setTimeout(gotowe, 300));

      expect(serwer.trafienia()).toBe(1);
    });

    it("gdy automat NIE działa, przeplanowanie jest nie-operacją", () => {
      zasiej({ url: "http://przyklad/1.csv" });
      const scheduler = stworz();

      expect(scheduler.przeplanuj()).toBe(0);
      expect(scheduler.liczbaTimerow()).toBe(0);
      expect(scheduler.czyDziala()).toBe(false);
    });
  });

  describe("GATE — po zatrzymaniu nic nie wisi", () => {
    it("`zatrzymaj()` gasi interwały i oczekujące przebiegi startowe", async () => {
      const serwer = await zapamietajSerwer();
      zasiej({ url: serwer.url(), czestotliwoscMinuty: SZYBKI_INTERWAL_MIN });
      const scheduler = stworz({ pierwszyPrzebieg: true });

      scheduler.uruchom();
      expect(scheduler.liczbaTimerow()).toBe(1);

      scheduler.zatrzymaj();
      const poZatrzymaniu = serwer.trafienia();
      await new Promise((gotowe) => setTimeout(gotowe, 500));

      expect(scheduler.liczbaTimerow()).toBe(0);
      expect(scheduler.czyDziala()).toBe(false);
      expect(serwer.trafienia()).toBe(poZatrzymaniu);
    });

    it("interwały są `unref`owane — nie trzymają pętli zdarzeń", () => {
      zasiej({ url: "http://przyklad/1.csv" });
      const przed = process.getActiveResourcesInfo().filter((r) => r === "Timeout").length;

      const scheduler = stworz();
      scheduler.uruchom();

      // `unref()` zdejmuje timer z listy zasobów trzymających proces przy życiu.
      expect(process.getActiveResourcesInfo().filter((r) => r === "Timeout").length).toBe(przed);
      expect(scheduler.liczbaTimerow()).toBe(1);
    });
  });
});
