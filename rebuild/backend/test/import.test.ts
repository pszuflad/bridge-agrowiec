/**
 * Endpointy importu — testy end-to-end BEZ MOCKÓW warstwy danych.
 *
 * Parsujemy PRAWDZIWE cenniki dostawców (`test/charakteryzacja/probki/`, te same, na
 * których stoi gate charakteryzacji z 3a) i sprawdzamy, że rekordy fizycznie lądują
 * w `staging_items` w prawdziwym SQLite. Mockowane jest wyłącznie pobranie pliku po HTTP
 * w `from-url` — jedyna zależność, która wychodzi poza maszynę.
 *
 * Zakres: `POST /api/import/parse-file`, `POST /api/import/from-url`,
 * `POST /api/ai-fallback/parse` (mirror/backend/extensions.cjs:126-286,
 * deminified/backend-index.cjs:48864-48886).
 */
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { auditLog, config, stagingItems, suppliers } from "../src/db/schema.js";
import { optionalAuth } from "../src/middleware/auth.js";
import { MAX_ROZMIAR_UPLOADU, trasyImportu } from "../src/routes/import.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

const KATALOG_PROBEK = join(import.meta.dirname, "charakteryzacja", "probki");

function probka(nazwa: string): Buffer {
  return readFileSync(join(KATALOG_PROBEK, nazwa));
}

/**
 * Ile wierszy stagingu powinien zostawić import, którego statystyki widać w odpowiedzi.
 *
 * Do 3b ta liczba była po prostu równa liczbie rekordów z parsera, bo placeholder silnika
 * przepuszczał wszystko. Od 3c silnik realnie klasyfikuje: odsiewa nie-opony, śmieci MO2
 * i rekordy bez identyfikatora, więc równość trzeba wyprowadzić z liczników kontraktu,
 * a nie zakładać. Katalog w tych testach jest pusty, więc nie ma dopasowań — każda przyjęta
 * pozycja daje dokładnie jeden wiersz.
 */
function oczekiwanyStaging(cialo: Record<string, number | boolean>): number {
  return (
    Number(cialo.wczytanych) -
    Number(cialo.odrzuconeNieOpony) -
    Number(cialo.odrzuconeBrakDanych) -
    Number(cialo.odrzuconeSmieciMO2)
  );
}

function oczekiwaneRekordy(kodDostawcy: string): number {
  const wzorzec = JSON.parse(
    readFileSync(join(import.meta.dirname, "charakteryzacja", `${kodDostawcy}.expected.json`), "utf8"),
  ) as { rekordy: unknown[] };
  return wzorzec.rekordy.length;
}

describe("endpointy importu", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  beforeEach(() => {
    srodowisko.db.delete(stagingItems).run();
    srodowisko.db.delete(auditLog).run();
    srodowisko.db.delete(suppliers).run();
    srodowisko.db.delete(config).run();
    // Archiwum też jest stanem — bez tego pliki kumulują się między testami.
    rmSync(srodowisko.katalogArchiwum, { recursive: true, force: true });
  });

  const wyslijPlik = (kod: string, dane: Buffer, nazwa = "cennik.csv") =>
    request(srodowisko.app)
      .post(`/api/import/parse-file?dostawcaKod=${kod}&nazwa=${nazwa}`)
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/octet-stream")
      .send(dane);

  const policzStaging = () =>
    srodowisko.sqlite.prepare("SELECT count(*) AS c FROM staging_items").get() as { c: number };

  describe("POST /api/import/parse-file — ścieżka główna", () => {
    it("parsuje prawdziwy cennik MO1 i zapisuje wszystkie pozycje do stagingu", async () => {
      const oczekiwane = oczekiwaneRekordy("MO1");
      const odp = await wyslijPlik("MO1", probka("MO1.csv"));

      expect(odp.status).toBe(200);
      const ciało = odp.body as Record<string, number | boolean>;
      expect(ciało.ok).toBe(true);
      expect(ciało.wczytanych).toBe(oczekiwane);
      // MO1 nie ma w próbce ani nie-opon, ani śmieci, więc tu równość nadal zachodzi
      // wprost — ale liczymy ją tą samą regułą co u pozostałych dostawców.
      expect(oczekiwanyStaging(ciało)).toBe(oczekiwane);
      expect(ciało.doStagingu).toBe(oczekiwane);
      expect(ciało.nowe).toBe(oczekiwane);
      expect(policzStaging().c).toBe(oczekiwane);
    });

    /**
     * Zestaw kluczy odpowiedzi jest częścią kontraktu: oryginał rozsypuje statystyki
     * `tk()` wprost do ciała (`...tkResult`, extensions.cjs:271-277), więc pojawienie się
     * lub zniknięcie któregokolwiek licznika to zmiana widoczna dla frontendu.
     */
    it("odpowiedź ma dokładnie ten zestaw kluczy co w oryginale", async () => {
      const odp = await wyslijPlik("MO1", probka("MO1.csv"));

      expect(Object.keys(odp.body as object).sort()).toEqual(
        [
          "ok",
          "dostawcaKod",
          "wczytanych",
          "parserErrors",
          "odrzuconePrzezParser",
          "doStagingu",
          "odrzuconeNieOpony",
          "odrzuconeBrakDanych",
          "odrzuconeSmieciMO2",
          "nowe",
          "zmienione",
          "wycofane",
          "bezZmian",
          "autoZatwierdzone",
          "szczegolyOdrzuconych",
        ].sort(),
      );
    });

    it("pozycje w stagingu mają typZmiany „nowa” i dane z parsera", async () => {
      await wyslijPlik("MO1", probka("MO1.csv"));

      const pozycje = srodowisko.sqlite
        .prepare("SELECT * FROM staging_items LIMIT 3")
        .all() as Record<string, unknown>[];

      for (const p of pozycje) {
        expect(p.typ_zmiany).toBe("nowa");
        expect(p.dostawca).toBe("MO1");
        expect(p.stan_stary).toBeNull();
        expect(p.cena_zakupu_stara).toBeNull();
        expect(String(p.kod)).toMatch(/^MO1_/);
        expect(JSON.parse(String(p.snapshot_json))).toHaveProperty("kod", p.kod);
      }
    });

    /** Wszystkie pozycje jednego przebiegu dostają ten sam znacznik — jak `n` w `tk()`. */
    it("cały przebieg ma jeden znacznik `utworzono`", async () => {
      await wyslijPlik("MO1", probka("MO1.csv"));

      const znaczniki = srodowisko.sqlite
        .prepare("SELECT DISTINCT utworzono FROM staging_items")
        .all() as { utworzono: string }[];
      expect(znaczniki).toHaveLength(1);
    });

    it("aktualizuje dostawcę i zapisuje wpis do dziennika audytu", async () => {
      srodowisko.db
        .insert(suppliers)
        .values({
          kod: "MO1",
          nazwa: "Bohnenkamp",
          formatPliku: "csv",
          sposobDostarczania: "url",
          url: "https://przyklad.test/mo1.csv",
        })
        .run();

      const oczekiwane = oczekiwaneRekordy("MO1");
      await wyslijPlik("MO1", probka("MO1.csv"));

      const dostawca = srodowisko.sqlite
        .prepare("SELECT * FROM suppliers WHERE kod = 'MO1'")
        .get() as Record<string, unknown>;
      expect(dostawca.liczba_produktow).toBe(oczekiwane);
      expect(dostawca.ostatni_plik).toBeTruthy();
      expect(dostawca.status).toBe("aktywny");

      const wpis = srodowisko.sqlite
        .prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT 1")
        .get() as Record<string, string>;
      expect(wpis.akcja).toBe("import_pliku");
      expect(wpis.encja_id).toBe("MO1");
      expect(wpis.uzytkownik_imie).toBe(srodowisko.dane.imieNazwisko);
      expect(JSON.parse(String(wpis.szczegoly_json))).toMatchObject({
        source: "parse-file",
        wczytanych: oczekiwane,
      });
    });

    it("odrzuca żądanie bez dostawcaKod", async () => {
      const odp = await request(srodowisko.app)
        .post("/api/import/parse-file")
        .set("Authorization", `Bearer ${token}`)
        .set("Content-Type", "application/octet-stream")
        .send(probka("MO1.csv"));

      expect(odp.status).toBe(400);
      expect((odp.body as { error: string }).error).toBe("Brak dostawcaKod (query lub body)");
    });

    /**
     * Oryginał czyta dla tej trasy WYŁĄCZNIE `query.dostawcaKod || body.dostawcaKod`
     * (extensions.cjs:214) — bez aliasu `dostawca`, który ma tylko `from-url`. Trzymamy
     * tę różnicę, żeby nie poszerzać po cichu powierzchni API.
     */
    it("nie przyjmuje aliasu `dostawca` — to wejście ma tylko from-url", async () => {
      const odp = await request(srodowisko.app)
        .post("/api/import/parse-file")
        .set("Authorization", `Bearer ${token}`)
        .send({ dostawca: "MO1" });

      expect(odp.status).toBe(400);
      expect((odp.body as { error: string }).error).toBe("Brak dostawcaKod (query lub body)");
    });

    it("odrzuca nieznanego dostawcę", async () => {
      const odp = await wyslijPlik("MO99", probka("MO1.csv"));

      expect(odp.status).toBe(400);
      expect((odp.body as { error: string }).error).toBe("Nieznany dostawca: MO99");
    });

    it("odrzuca pusty plik", async () => {
      const odp = await wyslijPlik("MO1", Buffer.alloc(0));

      expect(odp.status).toBe(400);
      expect((odp.body as { error: string }).error).toBe("Pusty plik");
    });

    /**
     * Limit jest egzekwowany W TRAKCIE strumieniowania (plan.md D13), więc żądanie zostaje
     * przerwane, zanim całe ciało wyląduje w pamięci. Odpowiedź jest identyczna jak
     * w oryginale — to utwardzenie niewidoczne w kontrakcie.
     */
    it("odrzuca plik większy niż 25 MB", async () => {
      const odp = await wyslijPlik("MO1", Buffer.alloc(MAX_ROZMIAR_UPLOADU + 1));

      expect(odp.status).toBe(400);
      expect((odp.body as { error: string }).error).toBe("Plik większy niż 25 MB");
      expect(policzStaging().c).toBe(0);
    });

    it("wymaga zalogowania", async () => {
      const odp = await request(srodowisko.app)
        .post("/api/import/parse-file?dostawcaKod=MO1")
        .set("Content-Type", "application/octet-stream")
        .send(probka("MO1.csv"));

      expect(odp.status).toBe(401);
    });
  });

  /**
   * ODSTĘPSTWO ŚWIADOME (plan.md D4, backlog #8) — bezpiecznik na pusty wynik parsowania.
   *
   * Scenariusz jest prawdziwy i odtworzony tu dosłownie: parser MO8 dostaje plik CSV
   * zamiast skoroszytu XLSX i zwraca `{records: [], errors: []}` — zero pozycji i ZERO
   * błędów. W produkcji taki wynik przechodzi dalej do `tk()`, które nie ma zabezpieczenia
   * przed pustym wejściem, więc każda pozycja dostawcy dostaje +1 do `nieobecnosc_pod_rzad`;
   * po trzech takich przebiegach cały katalog dostawcy zostaje wycofany. MO8 (Trelleborg)
   * to import ręczny — plik przychodzi mailem — więc nie ma cyklicznego przebiegu, który
   * by to nadrobił, a plik CSV o tej samej treści krąży obok właściwego skoroszytu.
   */
  describe("bezpiecznik na pusty wynik parsowania (D4)", () => {
    it("MO8 z plikiem CSV zwraca 400 i NIE dotyka stagingu", async () => {
      const odp = await wyslijPlik("MO8", probka("MO1.csv"), "trelleborg.csv");

      expect(odp.status).toBe(400);
      expect((odp.body as { error: string }).error).toMatch(/ani jednej pozycji/);
      expect((odp.body as { dostawcaKod: string }).dostawcaKod).toBe("MO8");
      expect(policzStaging().c).toBe(0);
    });

    it("nie zapisuje wtedy wpisu audytu ani nie aktualizuje dostawcy", async () => {
      srodowisko.db
        .insert(suppliers)
        .values({
          kod: "MO8",
          nazwa: "Trelleborg",
          formatPliku: "xlsx",
          sposobDostarczania: "email",
          liczbaProduktow: 626,
        })
        .run();

      await wyslijPlik("MO8", probka("MO1.csv"), "trelleborg.csv");

      const dostawca = srodowisko.sqlite
        .prepare("SELECT * FROM suppliers WHERE kod = 'MO8'")
        .get() as Record<string, unknown>;
      expect(dostawca.liczba_produktow).toBe(626);
      expect(dostawca.ostatni_plik).toBeNull();

      const audyt = srodowisko.sqlite.prepare("SELECT count(*) AS c FROM audit_log").get() as {
        c: number;
      };
      expect(audyt.c).toBe(0);
    });

    /**
     * Bezpiecznik nie jest łatką na jednego dostawcę. MO10 (GRI) przy śmieciowej treści
     * też zwraca zero rekordów i ZERO błędów — cicho, tak samo jak MO8. Każda taka
     * ścieżka podbijałaby w produkcji licznik nieobecności całego katalogu dostawcy.
     */
    it("działa dla dowolnego dostawcy, nie tylko MO8", async () => {
      const odp = await wyslijPlik("MO10", Buffer.from("to nie jest skoroszyt"), "gri.csv");

      expect(odp.status).toBe(400);
      expect((odp.body as { error: string }).error).toMatch(/ani jednej pozycji/);
      expect(policzStaging().c).toBe(0);
    });

    it("prawidłowy skoroszyt MO8 przechodzi normalnie", async () => {
      const odp = await wyslijPlik("MO8", probka("MO8.xlsx"), "trelleborg.xlsx");

      expect(odp.status).toBe(200);
      const cialo = odp.body as Record<string, number | boolean>;
      expect(cialo.wczytanych).toBe(oczekiwaneRekordy("MO8"));
      // Silnik 3c odsiewa z tej próbki jedną pozycję jako nie-oponę — potwierdzone
      // uruchomieniem ORYGINALNEGO tk() (test/charakteryzacja/silnik/MO8.expected.json).
      expect(cialo.odrzuconeNieOpony).toBe(1);
      expect(policzStaging().c).toBe(oczekiwanyStaging(cialo));
    });
  });

  /**
   * ODSTĘPSTWO ŚWIADOME (plan.md D5, backlog #7) — MO6 Agrowiec wycofany z importu.
   *
   * Wpis `MO6` w mapie `URLS` dispatchera jest zapisem nieużywanym (MO6 nigdy nie miał
   * auto-pulla), więc sama obecność adresu nie może decydować o tym, czy import wolno
   * uruchomić. Decyduje kolumna `suppliers.import_wylaczony` z migracji 002.
   */
  describe("strażnik wyłączonego dostawcy (D5)", () => {
    beforeEach(() => {
      srodowisko.db
        .insert(suppliers)
        .values({
          kod: "MO6",
          nazwa: "Agrowiec / Uniglory",
          formatPliku: "csv",
          sposobDostarczania: "reczny",
          importWylaczony: 1,
        })
        .run();
    });

    it("odrzuca upload dla MO6 i nic nie zapisuje", async () => {
      const odp = await wyslijPlik("MO6", probka("MO6.csv"));

      expect(odp.status).toBe(400);
      expect((odp.body as { error: string }).error).toBe("Dostawca MO6 jest wyłączony z importu");
      expect(policzStaging().c).toBe(0);
    });

    it("odrzuca też pobranie z URL dla MO6", async () => {
      const odp = await request(srodowisko.app)
        .post("/api/import/from-url")
        .set("Authorization", `Bearer ${token}`)
        .send({ dostawcaKod: "MO6" });

      expect(odp.status).toBe(400);
      expect((odp.body as { error: string }).error).toBe("Dostawca MO6 jest wyłączony z importu");
    });

    it("dostawca bez flagi importuje normalnie", async () => {
      const odp = await wyslijPlik("MO2", probka("MO2.csv"));
      expect(odp.status).toBe(200);
      const cialo = odp.body as Record<string, number | boolean>;
      expect(cialo.wczytanych).toBe(oczekiwaneRekordy("MO2"));
      expect(cialo.doStagingu).toBe(oczekiwanyStaging(cialo));

      // ⚠ Wierszy jest MNIEJ niż `doStagingu` i tak ma być. Próbka MO2 zawiera dwa kody
      // powtórzone (`MO2_13760840000`, `MO2_13763530000`), a `U.addStaging`
      // (backend-index.cjs:44923) deduplikuje po (kod, typZmiany, powod). `doStagingu` liczy
      // BUFOR, nie zapisy (`:47850`), więc obie liczby rozjeżdżają się o liczbę duplikatów.
      // Potwierdzone uruchomieniem ORYGINAŁU na tej samej próbce: 200 w buforze, 198 zapisów.
      expect(policzStaging().c).toBe(Number(cialo.doStagingu) - 2);
    });

    it("ponowny import tego samego cennika nie dokłada wierszy (deduplikacja addStaging)", async () => {
      await wyslijPlik("MO2", probka("MO2.csv"));
      const poPierwszym = policzStaging().c;

      const odp = await wyslijPlik("MO2", probka("MO2.csv"));

      expect(odp.status).toBe(200);
      expect(poPierwszym).toBeGreaterThan(0);
      expect(policzStaging().c).toBe(poPierwszym);
    });
  });

  describe("archiwum importu (D3)", () => {
    const plikiArchiwum = (): { sciezka: string; nazwa: string }[] => {
      const korzen = srodowisko.katalogArchiwum;
      if (!existsSync(korzen)) return [];
      return readdirSync(korzen).flatMap((miesiac) =>
        readdirSync(join(korzen, miesiac))
          .filter((n) => !n.endsWith(".meta.json"))
          .map((nazwa) => ({ sciezka: join(korzen, miesiac, nazwa), nazwa })),
      );
    };

    it("odkłada surowy plik i .meta.json z kompletem 14 pól", async () => {
      const dane = probka("MO1.csv");
      await wyslijPlik("MO1", dane, "bohnenkamp.csv");

      const pliki = plikiArchiwum();
      expect(pliki).toHaveLength(1);
      const plik = pliki[0]!;

      // Zapisany bufor musi być bajt w bajt tym, co przyszło.
      expect(readFileSync(plik.sciezka).equals(dane)).toBe(true);
      // `\d{5}`, nie `\d{6}` — `slice(0, 15)` w oryginale ucina ostatnią cyfrę sekund
      // (szczegóły i skutki w `src/import/archiwum.ts`).
      expect(plik.nazwa).toMatch(/^MO1__\d{8}__\d{5}__bohnenkamp\.csv$/);

      const meta = JSON.parse(readFileSync(`${plik.sciezka}.meta.json`, "utf8")) as Record<
        string,
        unknown
      >;
      expect(Object.keys(meta).sort()).toEqual(
        [
          "id",
          "dostawca",
          "zrodlo",
          "url",
          "uzytkownik",
          "data",
          "oryginalnaNazwa",
          "rozmiar",
          "sha256",
          "status",
          "blad",
          "rekordy",
          "parserErrors",
          "odrzucone",
        ].sort(),
      );
      expect(meta.dostawca).toBe("MO1");
      expect(meta.zrodlo).toBe("upload");
      expect(meta.status).toBe("ok");
      expect(meta.rozmiar).toBe(dane.length);
      expect(meta.uzytkownik).toBe(srodowisko.dane.imieNazwisko);
      // Liczniki dopisywane PO parsowaniu — w chwili archiwizacji jeszcze ich nie ma.
      expect(meta.rekordy).toBe(oczekiwaneRekordy("MO1"));
      expect(meta.parserErrors).toBe(0);
    });

    /** Archiwum ma sens głównie wtedy, gdy import się NIE udał — wtedy plik jest dowodem. */
    it("zapisuje plik także wtedy, gdy import zostaje odrzucony jako pusty", async () => {
      await wyslijPlik("MO8", probka("MO1.csv"), "trelleborg.csv");

      const pliki = plikiArchiwum();
      expect(pliki).toHaveLength(1);
      const meta = JSON.parse(readFileSync(`${pliki[0]!.sciezka}.meta.json`, "utf8")) as Record<
        string,
        unknown
      >;
      expect(meta.status).toBe("blad");
      expect(String(meta.blad)).toMatch(/ani jednej pozycji/);
      expect(meta.rekordy).toBe(0);
    });
  });

  describe("POST /api/import/from-url", () => {
    /**
     * Podstawiamy WYŁĄCZNIE transport HTTP — parsowanie, zapis do stagingu, archiwum
     * i audyt idą prawdziwe, na tej samej bazie co reszta pliku. Aplikacja ma ten sam
     * łańcuch middleware co produkcyjna (`src/app.ts`), tyle że bez tras spoza importu.
     *
     * Samo pobieranie po HTTP jest sprawdzane osobno, na prawdziwym serwerze,
     * w `test/import.pobierz.test.ts`.
     */
    const zPobieraczem = (pobierz: (url: string) => Promise<Buffer>) => {
      const app = express();
      app.use(express.json({ limit: "50mb" }));
      app.use(optionalAuth(srodowisko.env.JWT_SECRET));
      app.use(
        trasyImportu({
          db: srodowisko.db,
          katalogArchiwum: srodowisko.katalogArchiwum,
          pobierz,
        }),
      );
      return app;
    };

    beforeEach(() => {
      srodowisko.db
        .insert(suppliers)
        .values({
          kod: "MO1",
          nazwa: "Bohnenkamp",
          formatPliku: "csv",
          sposobDostarczania: "url",
          url: "https://przyklad.test/cennik-mo1.csv",
        })
        .run();
    });

    it("pobiera plik, parsuje i zapisuje do stagingu", async () => {
      const app = zPobieraczem(async () => probka("MO1.csv"));
      const oczekiwane = oczekiwaneRekordy("MO1");

      const odp = await request(app)
        .post("/api/import/from-url")
        .set("Authorization", `Bearer ${token}`)
        .send({ dostawcaKod: "MO1" });

      expect(odp.status).toBe(200);
      const ciało = odp.body as Record<string, unknown>;
      expect(ciało.ok).toBe(true);
      expect(ciało.url).toBe("https://przyklad.test/cennik-mo1.csv");
      expect(ciało.wczytanych).toBe(oczekiwane);
      expect(ciało.archiwum).toMatch(/^\d{4}-\d{2}\/MO1__/);
      expect(policzStaging().c).toBe(oczekiwane);
    });

    it("zapisuje wpis audytu ze źródłem `from-url`", async () => {
      const app = zPobieraczem(async () => probka("MO1.csv"));
      await request(app)
        .post("/api/import/from-url")
        .set("Authorization", `Bearer ${token}`)
        .send({ dostawcaKod: "MO1" });

      const wpis = srodowisko.sqlite
        .prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT 1")
        .get() as Record<string, string>;
      expect(wpis.akcja).toBe("import_z_url");
      expect(JSON.parse(String(wpis.szczegoly_json))).toMatchObject({ source: "from-url" });
    });

    /**
     * Oryginał ma tu INNY komunikat niż `parse-file` dla tego samego warunku „brak URL":
     * `Brak URL dla dostawcy X` (extensions.cjs:129-130) zamiast `Nieznany dostawca: X`
     * (extensions.cjs:216-218). Różnica jest zastana i celowo zachowana.
     */
    it("nieznany dostawca daje komunikat o braku URL, inny niż w parse-file", async () => {
      const app = zPobieraczem(async () => probka("MO1.csv"));
      const odp = await request(app)
        .post("/api/import/from-url")
        .set("Authorization", `Bearer ${token}`)
        .send({ dostawcaKod: "MO99" });

      expect(odp.status).toBe(400);
      expect((odp.body as { error: string }).error).toBe("Brak URL dla dostawcy MO99");
    });

    it("nie czyta kodu dostawcy z query — oryginał bierze go tylko z ciała", async () => {
      const app = zPobieraczem(async () => probka("MO1.csv"));
      const odp = await request(app)
        .post("/api/import/from-url?dostawcaKod=MO1")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(odp.status).toBe(400);
      expect((odp.body as { error: string }).error).toBe("Brak dostawcaKod");
    });

    it("akceptuje `dostawca` jako alias `dostawcaKod`", async () => {
      const app = zPobieraczem(async () => probka("MO1.csv"));
      const odp = await request(app)
        .post("/api/import/from-url")
        .set("Authorization", `Bearer ${token}`)
        .send({ dostawca: "mo1" });

      expect(odp.status).toBe(200);
      expect((odp.body as { dostawcaKod: string }).dostawcaKod).toBe("MO1");
    });

    /**
     * ODSTĘPSTWO ŚWIADOME (plan.md D8) — naprawa błędu oryginału.
     *
     * W `extensions.cjs` zmienna `archOk` jest zadeklarowana `let` WEWNĄTRZ bloku `try`
     * (:140), a blok `catch` po nią sięga (:193). Wejście w obsługę błędu daje więc
     * `ReferenceError` w samej obsłudze błędu — odpowiedź nigdy nie wychodzi i żądanie
     * wisi do timeoutu klienta. Ten test pilnuje, że u nas błąd pobierania kończy się
     * odpowiedzią, a nie ciszą.
     */
    it("błąd pobierania kończy się odpowiedzią 500, a nie wiszącym żądaniem", async () => {
      const app = zPobieraczem(async () => {
        throw new Error("HTTP 503 dla https://przyklad.test/cennik-mo1.csv");
      });

      const odp = await request(app)
        .post("/api/import/from-url")
        .set("Authorization", `Bearer ${token}`)
        .send({ dostawcaKod: "MO1" });

      expect(odp.status).toBe(500);
      expect(odp.body).toMatchObject({
        error: "HTTP 503 dla https://przyklad.test/cennik-mo1.csv",
        dostawcaKod: "MO1",
        url: "https://przyklad.test/cennik-mo1.csv",
      });
      expect(policzStaging().c).toBe(0);
    });

    /**
     * Śmieciowa treść nie wywraca parsera MO1 — zgłasza on jeden błąd wiersza i zwraca
     * zero rekordów. Łapie to bezpiecznik D4, nie blok `catch`, więc odpowiedź to 400
     * z adresem w ciele (jak w pozostałych błędach `from-url`).
     */
    it("śmieciowa treść kończy się 400 z adresem w ciele, bez zapisu do stagingu", async () => {
      const app = zPobieraczem(async () => Buffer.from("to nie jest xlsx"));

      const odp = await request(app)
        .post("/api/import/from-url")
        .set("Authorization", `Bearer ${token}`)
        .send({ dostawcaKod: "MO1" });

      expect(odp.status).toBe(400);
      expect(odp.body).toMatchObject({
        dostawcaKod: "MO1",
        url: "https://przyklad.test/cennik-mo1.csv",
      });
      expect((odp.body as { error: string }).error).toMatch(/ani jednej pozycji/);
      expect(policzStaging().c).toBe(0);
    });
  });

  /**
   * `POST /api/ai-fallback/parse` — port 1:1 z backend-index.cjs:48864-48886.
   *
   * Uwaga: to NIE jest fallback z bloku `catch` i NIGDY nie łączy się z OpenAI.
   * Zmyślone pozycje w trybie symulacji nie są naszym stubem — tak zachowuje się produkcja.
   */
  describe("POST /api/ai-fallback/parse", () => {
    it("bez klucza API zwraca symulację z pięcioma zmyślonymi pozycjami", async () => {
      const odp = await request(srodowisko.app)
        .post("/api/ai-fallback/parse")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(odp.status).toBe(200);
      const ciało = odp.body as { tryb: string; komunikat: string; produkty: unknown[] };
      expect(ciało.tryb).toBe("symulacja");
      expect(ciało.komunikat).toBe(
        "Klucz API OpenAI nie jest skonfigurowany. To wynik symulacji.",
      );
      expect(ciało.produkty).toHaveLength(5);
      expect(ciało.produkty[0]).toEqual({
        kodProduktu: "AI_DETECT_0",
        producent: "Wykryto AI",
        nazwa: "Produkt rozpoznany przez AI (symulacja) #0",
        cenaNetto: 100,
        iloscMagazyn: 1,
      });
    });

    it("z kluczem API zwraca tryb aktywny i pustą listę", async () => {
      srodowisko.db
        .insert(config)
        .values({ klucz: "ai_fallback.klucz_api", wartosc: "sk-cokolwiek" })
        .run();

      const odp = await request(srodowisko.app)
        .post("/api/ai-fallback/parse")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(odp.body).toEqual({
        tryb: "aktywny",
        komunikat: "Tryb aktywny — wymaga połączenia z OpenAI",
        produkty: [],
      });
    });

    it("pusty klucz traktowany jest jak brak klucza", async () => {
      srodowisko.db
        .insert(config)
        .values({ klucz: "ai_fallback.klucz_api", wartosc: "   " })
        .run();

      const odp = await request(srodowisko.app)
        .post("/api/ai-fallback/parse")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect((odp.body as { tryb: string }).tryb).toBe("symulacja");
    });

    it("wymaga zalogowania", async () => {
      const odp = await request(srodowisko.app).post("/api/ai-fallback/parse").send({});
      expect(odp.status).toBe(401);
    });
  });
});
