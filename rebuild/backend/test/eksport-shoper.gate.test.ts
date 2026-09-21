/**
 * GATE ODBUDOWY — Iteracja 8, blok 8a: dwie trasy eksportu do Shopera.
 *
 * Ścieżki kontraktu w zakresie: `/api/export-shoper` (`contract/openapi.yaml:611-617`)
 * i `/api/export/shoper` (`:619-626`). Fixtures w zakresie: BRAK.
 *
 * ⚠ CZEGO TA SIATKA NIE DOWODZI — i dlaczego to nie jest obejście gate'a.
 *
 * 1. FIXTURE'A NIE MA I NIE MOŻE BYĆ. Nagrywarka zapisywała wyłącznie odpowiedzi JSON
 *    (`contract/README.md`), a te trasy oddają `text/csv` i `application/zip`. Format pliku
 *    niesie `eksport-shoper.format.test.ts`, tu sprawdzamy kontrakt, nagłówki i autoryzację.
 * 2. KONTRAKT NIE DEKLARUJE DLA NICH ŻADNEGO `content` — tylko `security` i `responses`.
 *    Dlatego `sprawdzZgodnoscZKontraktemNieJson` (ścieżka + status), a `content-type`
 *    sprawdzamy osobno i wprost. Wariant podstawowy wymaga `application/json` dla KAŻDEJ
 *    odpowiedzi (`gate/kontrakt.ts:81`) i dla CSV-a zapalałby się zawsze.
 *
 * ⚠ ODSTĘPSTWO ŚWIADOME (§3, plan.md D1) — TU JEST JEGO DOWÓD. Kontrakt opisuje obie trasy
 * jako PUBLICZNE (`security: []`), bo takie są w produkcji. My zakładamy na nie `requireAuth`.
 * Test „401 bez tokenu" sprawdza więc NASZE odstępstwo, nie zgodność z kontraktem — i to jest
 * jedyne miejsce w tym pliku, gdzie celowo rozjeżdżamy się z `openapi.yaml`.
 *
 * ⚠ DRUGIE ODSTĘPSTWO, TYM RAZEM OD PRODUKCJI, NIE OD KONTRAKTU (backlog #93, karta P5.2).
 * Wariant ZIP (`/api/export-shoper` bez `?dostawca=` i z `dostawca=wszyscy`) w produkcji zawsze
 * oddaje 500 przez wersję `archiver`, nie przez kod. My zostajemy przy działającym ZIP-ie —
 * szczegóły przy `sprawdzArchiwum` niżej.
 *
 * ⚠ DRUGA POŁOWA TEGO PLIKU TO DOWÓD AUTORYZACJI PRZEZ COOKIE. Eksport jest NAWIGACJĄ
 * przeglądarki (`window.location.href`), nie `fetch`-em — nie niesie nagłówka `Authorization`
 * i działa wyłącznie na cookie sesji. To jest ta rzecz, która „działa u mnie" i pada u Ani.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listaDostawcow } from "../src/repos/suppliers.js";
import { NAGLOWEK_EXPORT_SHOPER } from "../src/selly/csv-shoper.js";
import { czytajZip, doBufora } from "./gate/czytnik-zip.js";
import {
  sprawdzZgodnoscZKontraktemNieJson,
  stworzSrodowiskoTestowe,
  zasiejDostawcow,
  zasiejProdukty,
  type SrodowiskoTestowe,
} from "./gate/index.js";

/** BOM — pierwszy znak każdego pliku CSV eksportu. */
const BOM = "\uFEFF";

describe("GATE — eksport do Shopera, dwie trasy (blok 8a)", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;
  let cookie: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    zasiejProdukty(srodowisko.db);
    zasiejDostawcow(srodowisko.db);

    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;

    const ustawione = odp.headers["set-cookie"] as unknown as string[] | undefined;
    cookie = (ustawione ?? []).find((c) => c.startsWith("bridge_session=")) ?? "";
  });

  afterAll(() => srodowisko.posprzataj());

  const zAuth = (sciezka: string) =>
    request(srodowisko.app).get(sciezka).set("Authorization", `Bearer ${token}`);

  describe("GET /api/export-shoper", () => {
    it("ścieżka istnieje w kontrakcie, a 200 jest tam zadeklarowane", async () => {
      const odp = await zAuth("/api/export-shoper?dostawca=MO9");

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktemNieJson({
        metoda: "GET",
        sciezka: "/api/export-shoper",
        odpowiedz: odp,
      });
    });

    it("z `?dostawca` oddaje CSV nazwany po dostawcy i dacie", async () => {
      const odp = await zAuth("/api/export-shoper?dostawca=MO9");

      expect(odp.headers["content-type"]).toContain("text/csv");
      const data = new Date().toISOString().slice(0, 10);
      expect(odp.headers["content-disposition"]).toBe(
        `attachment; filename="shoper_MO9_${data}.csv"`,
      );
    });

    /**
     * ⚠⚠ ŚWIADOMY ROZJAZD Z PRODUKCJĄ — TE DWA TESTY NIE SĄ WIERNYM ODTWORZENIEM.
     *
     * W PRODUKCJI ta gałąź ZAWSZE oddaje HTTP 500. Kod oryginału (`:48786-48800`) jest ten sam
     * co nasz, ale `rV()` (`deminified/backend-index.cjs:48139`) czyta `ZipArchive` z pakietu
     * `archiver`, a lockfile produkcji przypina `archiver@5.3.2`, który tego eksportu NIE MA.
     * Log produkcji: „zip pipeline failed TypeError: oh is not a constructor". My mamy
     * `archiver@^8.0.0`, więc u nas ZIP wychodzi — i ma wychodzić: decyzja użytkownika
     * 2026-09-18 (karta `62-DOCS-decyzje-po-i14j`, D1), backlog #93, karta P5.2
     * (`70-CHORE-eksport-zip-odstepstwo`). Wersji zależności pilnuje
     * `test/zaleznosci.archiver.test.ts`.
     *
     * Nie „naprawiaj" tych testów na 500 w imię wierności — odstępstwo jest zatwierdzone.
     *
     * Sprawdzamy ZAWARTOŚĆ, nie tylko nagłówki: nagłówki idą przed pierwszym bajtem archiwum,
     * więc uszkodzony albo pusty ZIP miałby te same 200 i ten sam `content-type`.
     * Bajtową równość każdego wpisu z pojedynczym eksportem niesie `eksport-shoper.format.test.ts`.
     */
    async function sprawdzArchiwum(sciezka: string): Promise<void> {
      const odp = await zAuth(sciezka).buffer(true).parse(doBufora);

      expect(odp.status).toBe(200);
      expect(odp.headers["content-type"]).toContain("application/zip");
      const data = new Date().toISOString().slice(0, 10);
      expect(odp.headers["content-disposition"]).toBe(
        `attachment; filename="shoper_wszyscy_${data}.zip"`,
      );

      // `czytajZip` rzuca przy każdym uszkodzeniu (EOCD, sygnatury, rozmiary, CRC-32).
      const wpisy = czytajZip(odp.body as Buffer);

      // DOKŁADNIE jeden plik na dostawcę z `listaDostawcow` — ani brakującego, ani nadmiarowego,
      // w kolejności listy. Dostawcy, nie `DISTINCT products.dostawca` (komentarz przy trasie).
      const oczekiwane = listaDostawcow(srodowisko.db).map((d) => `shoper_${d.kod}_${data}.csv`);
      expect(oczekiwane.length).toBeGreaterThan(0);
      expect(wpisy.map((w) => w.nazwa)).toEqual(oczekiwane);

      for (const { nazwa, tresc } of wpisy) {
        const tekst = tresc.toString("utf8");
        expect(tekst.startsWith(BOM), `${nazwa}: brak BOM`).toBe(true);
        const naglowek = tekst.slice(BOM.length).split("\r\n")[0];
        expect(naglowek, nazwa).toBe(NAGLOWEK_EXPORT_SHOPER);
        expect(naglowek?.split(";"), nazwa).toHaveLength(7);
      }
    }

    it("bez parametru oddaje ZIP `shoper_wszyscy_{data}.zip` z plikiem per dostawca (ODSTĘPSTWO #93)", async () => {
      await sprawdzArchiwum("/api/export-shoper");
    });

    /** ⚠ To samo odstępstwo co wyżej: w produkcji również 500 (backlog #93). */
    it("`dostawca=wszyscy` zachowuje się jak brak parametru (ODSTĘPSTWO #93)", async () => {
      await sprawdzArchiwum("/api/export-shoper?dostawca=wszyscy");
    });
  });

  describe("GET /api/export/shoper", () => {
    it("ścieżka istnieje w kontrakcie, a 200 jest tam zadeklarowane", async () => {
      const odp = await zAuth("/api/export/shoper");

      expect(odp.status).toBe(200);
      sprawdzZgodnoscZKontraktemNieJson({
        metoda: "GET",
        sciezka: "/api/export/shoper",
        odpowiedz: odp,
      });
    });

    it("bez filtra oddaje jeden CSV `shoper_wszyscy_{data}.csv`, nigdy ZIP", async () => {
      const odp = await zAuth("/api/export/shoper");

      expect(odp.headers["content-type"]).toContain("text/csv");
      const data = new Date().toISOString().slice(0, 10);
      expect(odp.headers["content-disposition"]).toBe(
        `attachment; filename="shoper_wszyscy_${data}.csv"`,
      );
    });

    /**
     * ⚠ Parametr nazywa się `?supplier=`, a NIE `?dostawca=` jak w trasie obok. Rozjazd
     * nazewnictwa jest w oryginale (`:48855`) i zostaje — 8b musi użyć właściwej nazwy
     * dla właściwej trasy.
     */
    it("filtruje po `?supplier=`, a `?dostawca=` jest tu ignorowane", async () => {
      const data = new Date().toISOString().slice(0, 10);

      const zSupplier = await zAuth("/api/export/shoper?supplier=MO9");
      expect(zSupplier.headers["content-disposition"]).toBe(
        `attachment; filename="shoper_MO9_${data}.csv"`,
      );

      const zDostawca = await zAuth("/api/export/shoper?dostawca=MO9");
      expect(zDostawca.headers["content-disposition"]).toBe(
        `attachment; filename="shoper_wszyscy_${data}.csv"`,
      );
    });
  });

  describe("autoryzacja", () => {
    /**
     * ODSTĘPSTWO ŚWIADOME §3: kontrakt mówi `security: []`, my wymagamy sesji. Publiczny
     * eksport oddaje komplet katalogu razem z cenami zakupu (kolumna `cena_zakupu` jest
     * w słowniku kolumn `/api/export/shoper`).
     */
    it("obie trasy oddają 401 bez tokenu — mimo `security: []` w kontrakcie", async () => {
      for (const sciezka of ["/api/export-shoper", "/api/export/shoper"]) {
        const odp = await request(srodowisko.app).get(sciezka);
        expect(odp.status, sciezka).toBe(401);
        expect(odp.body).toEqual({ error: "Nieautoryzowany" });
      }
    });

    /**
     * ⚠ TEN TEST PILNUJE RZECZY, KTÓREJ NIE WIDAĆ W KODZIE TRASY. Przycisk eksportu
     * w panelu robi `window.location.href = "/api/export-shoper?..."`, czyli zwykłą nawigację
     * przeglądarki. Nawigacja NIE niesie nagłówka `Authorization` — niesie tylko cookie.
     * Gdyby `requireAuth` czytał wyłącznie Bearer, testy z tokenem byłyby zielone, a Ania
     * dostawałaby 401 przy każdym kliknięciu.
     */
    it("obie trasy działają na samo cookie, bez nagłówka Authorization", async () => {
      for (const sciezka of ["/api/export-shoper?dostawca=MO9", "/api/export/shoper"]) {
        const odp = await request(srodowisko.app).get(sciezka).set("Cookie", cookie);
        expect(odp.status, sciezka).toBe(200);
        expect(odp.headers["content-type"]).toContain("text/csv");
      }
    });
  });
});

/**
 * ŚCIEŻKA BŁĘDU ZIP-a (karta P5.2, zadanie 4; decyzja D2 karty 70).
 *
 * ZIP jest strumieniowany: `archiwum.pipe(res)` stoi PRZED dopisaniem wpisów i zapisem audytu,
 * a nagłówki 200 wychodzą z pierwszym bajtem archiwum. Jeśli potem cokolwiek padnie, odpowiedzi
 * nie da się już zamienić na 500. Przed poprawką trasa wtedy NIE ROBIŁA NIC — klient dostawał
 * nagłówki i czekał bez końca (w przeglądarce: pobieranie „w toku" na zawsze).
 *
 * Usterkę wywołujemy BEZ ATRAP: usuwamy z bazy tabelę `audit_log`, więc `zapiszAudyt` rzuca
 * dokładnie tak, jak rzuciłby przy zablokowanej albo pełnej bazie. Test wymaga, żeby klient
 * dostał ZAKOŃCZENIE odpowiedzi — 500 albo zerwane połączenie (przeglądarka pokaże nieudane
 * pobieranie) — a nie wiszenie. Sprawdzone: na kodzie sprzed poprawki ten test pada na limicie.
 *
 * Produkcja tej ścieżki nie zna: pada wcześniej, na `new ZipArchive` (backlog #93).
 */
describe("GATE — eksport ZIP: błąd w trakcie strumienia kończy odpowiedź (P5.2)", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    zasiejProdukty(srodowisko.db);
    zasiejDostawcow(srodowisko.db);

    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  it("padnięty zapis audytu: klient dostaje 500 albo zerwane połączenie, nie wiszenie", async () => {
    srodowisko.sqlite.exec("DROP TABLE audit_log");

    const wynik = await request(srodowisko.app)
      .get("/api/export-shoper")
      .set("Authorization", `Bearer ${token}`)
      .timeout(5000)
      .buffer(true)
      .parse(doBufora)
      .then(
        (odp) => ({ status: odp.status, blad: undefined }),
        (blad: Error & { code?: string; timeout?: number; status?: number }) => ({
          status: blad.status,
          blad,
        }),
      );

    expect(
      wynik.blad?.timeout,
      "klient zawisł — odpowiedź nigdy się nie zakończyła",
    ).toBeUndefined();
    if (wynik.blad && wynik.status === undefined) {
      // Zerwane połączenie: przeglądarka oznaczy pobieranie jako nieudane.
      expect(["ECONNRESET", "ECONNABORTED"]).toContain(wynik.blad.code);
    } else {
      expect(wynik.status).toBe(500);
    }
  }, 15000);
});
