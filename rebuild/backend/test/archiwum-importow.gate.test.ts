/**
 * GATE ODBUDOWY — archiwum importów, trzy trasy odczytu (ticket 91, karta PR.1).
 *
 * Ścieżki kontraktu: GET /api/import-archive, GET /api/import-archive/stats,
 * GET /api/import-archive/file/{month}/{name}.
 * Fixtures: GET_import-archive{,_dostawca,_miesiac,_status,_401,_stats,_file,_file_400,_file_404}.json.
 *
 * Archiwum zapełniamy DOKŁADNIE tak, jak nagrywarka zapełniła archiwum oryginału
 * (`tools/record-write-fixtures.cjs`, `odegrajArchiwum`): te same trzy pliki wgrane przez
 * `POST /api/import/parse-file`, w tej samej kolejności. Dzięki temu porównujemy nie tylko
 * kształt, ale i wartości (`rekordy`, `status`, `blad`, `sha256`, `rozmiar`…) — poza `id`
 * i `data`, które niosą zegar.
 *
 * Rozbieżność z fixture'em/kontraktem = STOP (nie poprawiamy fixture'a).
 */
import { mkdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RETENCJA_DNI } from "../src/import/archiwum.js";
import {
  sprawdzZgodnoscZFixture,
  sprawdzZgodnoscZKontraktem,
  sprawdzZgodnoscZKontraktemNieJson,
  stworzSrodowiskoTestowe,
  wczytajFixture,
  type SrodowiskoTestowe,
} from "./gate/index.js";

const KATALOG_PROBEK = join(import.meta.dirname, "charakteryzacja", "probki");
const probka = (nazwa: string) => readFileSync(join(KATALOG_PROBEK, nazwa));

/** Ten sam plik, który w nagraniu wywrócił parser MO7 („Quote Not Closed") → status `blad`. */
const ZEPSUTY_MO7 = Buffer.from('MODEL;PRODUCENT\n"niedomkniety;NOKIAN\n');

type Pozycja = {
  id: string;
  dostawca: string;
  zrodlo: string | null;
  uzytkownik: string | null;
  data: string;
  oryginalnaNazwa: string;
  rozmiar: number;
  status: string;
  blad: string | null;
  rekordy: number | null;
  sha256: string | null;
};
type Lista = { ok: boolean; total: number; items: Pozycja[] };

/** Pola pozycji wolne od zegara — te porównujemy z nagraniem wartość w wartość. */
const bezZegara = ({ id: _id, data: _data, ...reszta }: Pozycja) => reszta;

describe("GATE — kontrakt i fixtures dla archiwum importów", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;
  let pozycjaMo6: Pozycja;

  const zAuth = (sciezka: string) =>
    request(srodowisko.app).get(sciezka).set("Authorization", `Bearer ${token}`);

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    const logowanie = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (logowanie.body as { token: string }).token;

    const wgraj = (kod: string, nazwa: string, bufor: Buffer) =>
      request(srodowisko.app)
        .post(`/api/import/parse-file?dostawcaKod=${kod}&nazwa=${encodeURIComponent(nazwa)}`)
        .set("Authorization", `Bearer ${token}`)
        .set("Content-Type", "application/octet-stream")
        .send(bufor);

    const wyniki = [
      await wgraj("MO1", "MO1.csv", probka("MO1.csv")),
      await wgraj("MO7", "cennik MO7.csv", ZEPSUTY_MO7),
      await wgraj("MO6", "MO6.csv", probka("MO6.csv")),
    ];
    expect(wyniki.map((w) => w.status)).toEqual([200, 500, 200]);

    // Kolejność listy to `mtime`. Trzy uploady mieszczą się w tej samej milisekundzie, więc
    // ustawiamy znaczniki jawnie — w kolejności wgrania, jak w nagraniu (odstęp ~1 s).
    const lista = (await zAuth("/api/import-archive")).body as Lista;
    const teraz = Date.now() / 1000;
    for (const [i, kod] of ["MO1", "MO7", "MO6"].entries()) {
      const pozycja = lista.items.find((p) => p.dostawca === kod);
      if (!pozycja) throw new Error(`Upload ${kod} nie trafił do archiwum`);
      const t = teraz - 10 + i;
      utimesSync(join(srodowisko.katalogArchiwum, pozycja.id), t, t);
    }
    pozycjaMo6 = lista.items.find((p) => p.dostawca === "MO6") as Pozycja;
  });

  afterAll(() => srodowisko.posprzataj());

  describe("GET /api/import-archive", () => {
    it("bez filtrów — kształt i wartości 1:1 z GET_import-archive.json, najnowsze pierwsze", async () => {
      const odp = await zAuth("/api/import-archive");

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/import-archive", odpowiedz: odp });
      sprawdzZgodnoscZFixture("GET_import-archive.json", odp.body);

      const nagranie = wczytajFixture("GET_import-archive.json").body as Lista;
      const cialo = odp.body as Lista;
      expect(cialo.total).toBe(nagranie.total);
      expect(cialo.items.map(bezZegara)).toEqual(nagranie.items.map(bezZegara));
    });

    it("id ma postać RRRR-MM/<KOD>__<stempel>__<nazwa> jak w nagraniu", async () => {
      const cialo = (await zAuth("/api/import-archive")).body as Lista;
      const wzorzec = /^\d{4}-\d{2}\/MO\d+__\d{8}__\d{5}__[A-Za-z0-9._-]+$/;
      const nagranie = wczytajFixture("GET_import-archive.json").body as Lista;
      for (const p of [...cialo.items, ...nagranie.items]) expect(p.id).toMatch(wzorzec);
    });

    it("filtr dostawcy małymi literami — oryginał robi toUpperCase() (GET_import-archive_dostawca.json)", async () => {
      const odp = await zAuth("/api/import-archive?dostawca=mo6");

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/import-archive", odpowiedz: odp });
      sprawdzZgodnoscZFixture("GET_import-archive_dostawca.json", odp.body);
      const nagranie = wczytajFixture("GET_import-archive_dostawca.json").body as Lista;
      expect((odp.body as Lista).items.map(bezZegara)).toEqual(nagranie.items.map(bezZegara));
    });

    it("filtr statusu `blad` (GET_import-archive_status.json)", async () => {
      const odp = await zAuth("/api/import-archive?status=blad");

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZFixture("GET_import-archive_status.json", odp.body);
      const nagranie = wczytajFixture("GET_import-archive_status.json").body as Lista;
      expect((odp.body as Lista).items.map(bezZegara)).toEqual(nagranie.items.map(bezZegara));
      expect((odp.body as Lista).items[0]?.blad).toMatch(/^Quote Not Closed/);
    });

    describe("filtr miesiąca i plik bez .meta.json", () => {
      const INNY_MIESIAC = "2025-12";
      const NAZWA_BEZ_META = "MO3__20251201__12000__stary.csv";

      beforeAll(() => {
        // Plik bez meta w innym katalogu miesiąca: pokrywa filtr `miesiac` (porównanie z NAZWĄ
        // katalogu) i wartości zastępcze oryginału (:182-192). `mtime` świeży, żeby rotacja
        // (7 dni, liczona z mtime) nie uznała go za stary.
        const katalog = join(srodowisko.katalogArchiwum, INNY_MIESIAC);
        mkdirSync(katalog, { recursive: true });
        writeFileSync(join(katalog, NAZWA_BEZ_META), "a;b\n1;2\n");
      });

      it("?miesiac=<miesiąc uploadów> zwraca tylko pliki z tego katalogu (GET_import-archive_miesiac.json)", async () => {
        const miesiac = pozycjaMo6.id.slice(0, 7);
        const odp = await zAuth(`/api/import-archive?miesiac=${miesiac}`);

        expect(odp.status).toBe(200);
        sprawdzZgodnoscZFixture("GET_import-archive_miesiac.json", odp.body);
        const nagranie = wczytajFixture("GET_import-archive_miesiac.json").body as Lista;
        expect((odp.body as Lista).items.map(bezZegara)).toEqual(nagranie.items.map(bezZegara));
      });

      it("?miesiac=2025-12 zwraca plik bez meta z wartościami zastępczymi", async () => {
        const cialo = (await zAuth(`/api/import-archive?miesiac=${INNY_MIESIAC}`)).body as Lista;

        expect(cialo.total).toBe(1);
        expect(cialo.items[0]).toMatchObject({
          id: `${INNY_MIESIAC}/${NAZWA_BEZ_META}`,
          dostawca: "MO3",
          zrodlo: null,
          uzytkownik: null,
          oryginalnaNazwa: NAZWA_BEZ_META,
          rozmiar: 8,
          status: "ok",
          blad: null,
          rekordy: null,
          sha256: null,
        });
      });

      it("plik bez meta NIE przechodzi filtrów dostawcy ani statusu (porównanie z meta, jak oryginał)", async () => {
        const poDostawcy = (await zAuth("/api/import-archive?dostawca=MO3")).body as Lista;
        const poStatusie = (await zAuth("/api/import-archive?status=ok")).body as Lista;

        expect(poDostawcy.total).toBe(0);
        expect(poStatusie.items.map((p) => p.dostawca)).toEqual(["MO6", "MO1"]);
      });
    });

    it("bez tokenu → 401 (GET_import-archive_401.json)", async () => {
      const odp = await request(srodowisko.app).get("/api/import-archive");

      expect(odp.status).toBe(401);
      sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/import-archive", odpowiedz: odp });
      expect(odp.body).toEqual(wczytajFixture("GET_import-archive_401.json").body);
    });
  });

  describe("GET /api/import-archive/stats", () => {
    it("kształt 1:1 z GET_import-archive_stats.json, limit 5 GB i retencja 7 dni", async () => {
      // Plik bez meta z bloku wyżej też się liczy — stats nie czytają meta.
      const odp = await zAuth("/api/import-archive/stats");

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: "/api/import-archive/stats", odpowiedz: odp });
      sprawdzZgodnoscZFixture("GET_import-archive_stats.json", odp.body, [
        {
          sciezka: /^\$\.perMiesiac\.\d{4}-\d{2}$/,
          powod:
            "Klucze `perMiesiac` to nazwy katalogów miesięcy (RRRR-MM) — zależą od zegara biegu, " +
            "a test dokłada katalog 2025-12. Kształt wartości (liczba bajtów) sprawdzany niżej.",
          domyka: "nigdy — mapa o kluczach z danych, nie pole kontraktu",
        },
      ]);

      const nagranie = wczytajFixture("GET_import-archive_stats.json").body as Record<string, unknown>;
      const cialo = odp.body as { plikow: number; bajtow: number; perMiesiac: Record<string, number> };
      expect(odp.body).toMatchObject({
        ok: true,
        limitBajtow: nagranie.limitBajtow,
        retencjaDni: nagranie.retencjaDni,
      });
      expect(RETENCJA_DNI).toBe(nagranie.retencjaDni);
      expect(cialo.plikow).toBe(4);
      expect(cialo.bajtow).toBe((nagranie.bajtow as number) + 8);
      expect(Object.values(cialo.perMiesiac).reduce((a, b) => a + b, 0)).toBe(cialo.bajtow);
    });

    it("bez tokenu → 401", async () => {
      const odp = await request(srodowisko.app).get("/api/import-archive/stats");
      expect(odp.status).toBe(401);
      expect(odp.body).toEqual({ error: "Nieautoryzowany" });
    });
  });

  describe("GET /api/import-archive/file/{month}/{name}", () => {
    const SCIEZKA = "/api/import-archive/file/{month}/{name}";
    const adres = (id: string) => {
      const [miesiac, nazwa] = id.split("/") as [string, string];
      return `/api/import-archive/file/${encodeURIComponent(miesiac)}/${encodeURIComponent(nazwa)}`;
    };

    it("oddaje plik bajt w bajt, z nagłówkami jak w GET_import-archive_file.json", async () => {
      const odp = await zAuth(adres(pozycjaMo6.id)).buffer(true).parse((res, zwrot) => {
        const kawalki: Buffer[] = [];
        res.on("data", (k: Buffer) => kawalki.push(k));
        res.on("end", () => zwrot(null, Buffer.concat(kawalki)));
      });

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktemNieJson({ metoda: "GET", sciezka: SCIEZKA, odpowiedz: odp });
      expect(Buffer.compare(odp.body as Buffer, probka("MO6.csv"))).toBe(0);

      const nagranie = wczytajFixture("GET_import-archive_file.json") as unknown as {
        body: string;
        _naglowki: Record<string, string>;
      };
      // Nagranie niesie tę samą treść — dowód, że oryginał oddał dokładnie wgrane bajty.
      // Nagrywarka czyta ciało przez `fetch().text()`, a dekoder UTF-8 zdejmuje BOM, który
      // próbka MO6 ma na początku — stąd porównanie bez niego. Bajty potwierdza
      // `content-length` (237, z BOM-em) poniżej i `sha256` na liście.
      expect(nagranie.body).toBe(probka("MO6.csv").toString("utf8").replace(/^\uFEFF/, ""));

      const nazwaWArchiwum = pozycjaMo6.id.split("/")[1];
      const nazwaWNagraniu = /filename="([^"]+)"/.exec(nagranie._naglowki["content-disposition"] ?? "")?.[1];
      expect(nazwaWNagraniu).toMatch(/^MO6__\d{8}__\d{5}__MO6\.csv$/);
      expect(odp.headers["content-disposition"]).toBe(`attachment; filename="${nazwaWArchiwum}"`);
      expect(odp.headers["content-length"]).toBe(nagranie._naglowki["content-length"]);
      // Wielkość liter w `charset` się różni: oryginał ma w bundlu Express z `mime-types`
      // (`utf-8`), odbudowa — Express 4 z `mime` 1.x (`UTF-8`). Parametr charset jest
      // nieczuły na wielkość liter (RFC 9110 §8.3.2), więc porównujemy bez niej.
      expect(String(odp.headers["content-type"]).toLowerCase()).toBe(
        nagranie._naglowki["content-type"]?.toLowerCase(),
      );
    });

    it("nieistniejący plik → 404 z ciałem jak w GET_import-archive_file_404.json", async () => {
      const miesiac = pozycjaMo6.id.slice(0, 7);
      const odp = await zAuth(`/api/import-archive/file/${miesiac}/NIE_MA__takiego.csv`);

      expect(odp.status).toBe(404);
      sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: SCIEZKA, odpowiedz: odp });
      expect(odp.body).toEqual(wczytajFixture("GET_import-archive_file_404.json").body);
    });

    it("próba wyjścia przez zakodowany ukośnik → 400 jak w GET_import-archive_file_400.json", async () => {
      const miesiac = pozycjaMo6.id.slice(0, 7);
      const odp = await zAuth(`/api/import-archive/file/${miesiac}/..%2F..%2Fdata.db`);

      expect(odp.status).toBe(400);
      sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: SCIEZKA, odpowiedz: odp });
      expect(odp.body).toEqual(wczytajFixture("GET_import-archive_file_400.json").body);
    });

    /**
     * Żądanie wysłane BEZ normalizacji ścieżki. Klient oparty na WHATWG URL (supertest,
     * przeglądarka) sam zwija segmenty `%2E%2E` i żądanie nigdy nie dochodzi do trasy —
     * atakujący z `curl --path-as-is` takiego ograniczenia nie ma, więc testujemy serwer wprost.
     */
    const surowe = (sciezka: string) =>
      new Promise<{ status: number; body: unknown }>((resolve, reject) => {
        const serwer = srodowisko.app.listen(0, "127.0.0.1", () => {
          const adresSerwera = serwer.address();
          const port = typeof adresSerwera === "object" && adresSerwera ? adresSerwera.port : 0;
          const zadanie = httpRequest(
            { host: "127.0.0.1", port, path: sciezka, headers: { Authorization: `Bearer ${token}` } },
            (odp) => {
              let tresc = "";
              odp.setEncoding("utf8");
              odp.on("data", (k: string) => (tresc += k));
              odp.on("end", () => {
                serwer.close();
                resolve({ status: odp.statusCode ?? 0, body: JSON.parse(tresc) as unknown });
              });
            },
          );
          zadanie.on("error", (e) => {
            serwer.close();
            reject(e);
          });
          zadanie.end();
        });
      });

    it.each([
      ["zakodowane kropki i ukośnik w nazwie", "2026-09/%2E%2E%2F%2E%2E%2Fdata.db"],
      ["same kropki jako nazwa", "2026-09/%2E%2E"],
      ["kropki jako miesiąc", "%2E%2E/data.db"],
      ["miesiąc spoza RRRR-MM", "2026-9/plik.csv"],
      ["ukośnik wsteczny i kropki", "2026-09/..%5C..%5Cdata.db"],
      ["nazwa z dwiema kropkami obok siebie (dziwactwo oryginału)", "2026-09/a..csv"],
    ])("%s → 400 Nieprawidłowe id", async (_opis, reszta) => {
      const odp = await surowe(`/api/import-archive/file/${reszta}`);

      expect(odp.status).toBe(400);
      expect(odp.body).toEqual({ ok: false, error: "Nieprawidłowe id" });
    });

    it("surowe `..` w ścieżce nie trafia w trasę pobrania i nie oddaje pliku spoza archiwum", async () => {
      const odp = await zAuth("/api/import-archive/file/2026-09/../../data.db");

      expect(odp.status).toBe(404);
      expect(odp.headers["content-disposition"]).toBeUndefined();
    });

    it("bez tokenu → 401", async () => {
      const odp = await request(srodowisko.app).get(adres(pozycjaMo6.id));

      expect(odp.status).toBe(401);
      sprawdzZgodnoscZKontraktem({ metoda: "GET", sciezka: SCIEZKA, odpowiedz: odp });
      expect(odp.body).toEqual({ error: "Nieautoryzowany" });
    });

    it("cookie sesji też wystarcza (auth jak w całym backendzie)", async () => {
      const odp = await request(srodowisko.app)
        .get(adres(pozycjaMo6.id))
        .set("Cookie", `bridge_session=${encodeURIComponent(token)}`);

      expect(odp.status).toBe(200);
    });
  });
});
