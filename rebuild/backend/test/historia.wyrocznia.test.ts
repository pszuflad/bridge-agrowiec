/**
 * WYROCZNIA HISTORII — porównanie z ŻYWYM oryginałem, zamrożone w bramkach.
 *
 * Ten plik zastępuje ręczny test §9 instrukcji I5 („Porównanie ze starym Bridge"), którego
 * Ania nie wykonała. Karta `59-CHORE-i14j` postawiła oryginał (`mirror/backend/index.cjs`)
 * i odbudowę obok siebie na kopiach tego samego `db/snapshot.db` i porównała trzy trasy
 * historii na 59 przypadkach — wynik: **0 rozjazdów na 49 813 porównanych wpisach**.
 *
 * Pomiar jest jednorazowy (wymaga żywego oryginału i `npm ci` jego zależności), więc jego
 * wynik został ZAPISANY do `test/historia.wyrocznia.json` i ten test odtwarza go bez
 * oryginału: zasiewa te same surowe wiersze `audit_log`/`history` ze snapshotu i sprawdza,
 * czy odbudowa oddaje DOKŁADNIE to, co oddał oryginał.
 *
 * ⚠ RÓŻNICA WOBEC `historia.gate.test.ts`: tamten porównuje się z `contract/fixtures/`, czyli
 * z nagraniem KSZTAŁTU odpowiedzi (wartości zsanityzowane, ciała przycięte). Ten porównuje
 * się z PEŁNĄ odpowiedzią oryginału na konkretnych danych — łącznie z kolejnością wierszy,
 * treścią pól i licznikami. Oba są potrzebne i żaden nie zastępuje drugiego.
 *
 * ⚠ `historia.wyrocznia.json` NIE JEST NASZYM OCZEKIWANIEM — to zapis tego, co robi produkcja.
 * Gdy ten test zaświeci, domyślna odpowiedź brzmi „zepsuliśmy odbudowę", a nie „trzeba
 * poprawić plik". Zmiana pliku wymaga ponownego nagrania:
 *   node docs/tickets/59-CHORE-i14j-oracle-diff-historii/oracle-diff-historii.cjs
 *
 * Skrypt pomiarowy: `docs/tickets/59-CHORE-i14j-oracle-diff-historii/oracle-diff-historii.cjs`.
 * Raport: `docs/tickets/59-CHORE-i14j-oracle-diff-historii/raport.md`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

/** Surowy wiersz `audit_log` ze snapshotu — nazwy KOLUMN, nie pól modelu. */
type WierszAudytuSurowy = {
  id: number;
  uzytkownik_id: number | null;
  uzytkownik_imie: string | null;
  akcja: string;
  encja_typ: string | null;
  encja_id: string | null;
  szczegoly_json: string | null;
  kiedy: string;
};

/** Surowy wiersz `history` ze snapshotu — jw. */
type WierszDziennikaSurowy = {
  id: number;
  data: string;
  kod_produktu: string | null;
  nazwa: string | null;
  pole: string | null;
  stara_wartosc: string | null;
  nowa_wartosc: string | null;
  zrodlo: string | null;
  kto: string | null;
  wykonal_uzytkownik_id: number | null;
};

type Wyrocznia = {
  _nagrane: string;
  _ticket: string;
  kontrolaLimitu: { wierszyAuditLog: number; limitAudytu: number; limitNieGryzie: boolean };
  dziennikBezRemisow: boolean;
  zasiewAudytu: WierszAudytuSurowy[];
  zasiewDziennika: WierszDziennikaSurowy[];
  dziennikPierwszeWiersze: Record<string, unknown>[];
  odpowiedzi: Record<string, { sciezka: string; cialo: unknown }>;
};

const KATALOG = dirname(fileURLToPath(import.meta.url));
const wyrocznia = JSON.parse(
  readFileSync(join(KATALOG, "historia.wyrocznia.json"), "utf8"),
) as Wyrocznia;

describe("WYROCZNIA — historia zgodna z żywym oryginałem", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeAll(async () => {
    srodowisko = await stworzSrodowiskoTestowe();

    // Zasiew idzie SUROWYM SQL-em, nie przez Drizzle, i to jest celowe: wiersze pochodzą
    // wprost ze snapshotu produkcji (nazwy kolumn `snake_case`), więc wkładamy je do bazy
    // dokładnie takimi, jakie dostał oryginał. Przejście przez model dołożyłoby po drodze
    // naszą interpretację typów — a to właśnie ona jest tu przedmiotem badania.
    const wstawAudyt = srodowisko.sqlite.prepare(
      `INSERT INTO audit_log (id, uzytkownik_id, uzytkownik_imie, akcja, encja_typ, encja_id,
                              szczegoly_json, kiedy)
       VALUES (@id, @uzytkownik_id, @uzytkownik_imie, @akcja, @encja_typ, @encja_id,
               @szczegoly_json, @kiedy)`,
    );
    for (const wiersz of wyrocznia.zasiewAudytu) wstawAudyt.run(wiersz);

    const wstawDziennik = srodowisko.sqlite.prepare(
      `INSERT INTO history (id, data, kod_produktu, nazwa, pole, stara_wartosc, nowa_wartosc,
                            zrodlo, kto, wykonal_uzytkownik_id)
       VALUES (@id, @data, @kod_produktu, @nazwa, @pole, @stara_wartosc, @nowa_wartosc,
               @zrodlo, @kto, @wykonal_uzytkownik_id)`,
    );
    for (const wiersz of wyrocznia.zasiewDziennika) wstawDziennik.run(wiersz);

    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterAll(() => srodowisko.posprzataj());

  /**
   * Warunek ważności całej wyroczni.
   *
   * Zasiewamy WYŁĄCZNIE wiersze `audit_log` z pięciu rozpoznawanych akcji, bo reszta i tak
   * odpada przed filtrowaniem i paginacją — więc na wynik nie wpływa. Jedyne, co mogłoby ten
   * skrót unieważnić, to `listAudit(5e3)` ORYGINAŁU: gdyby w bazie, z której nagrano wyrocznię,
   * było ≥ 5000 wierszy, oryginał odciąłby część JESZCZE PRZED odsiewem i jego odpowiedź
   * przestałaby być odpowiedzią „na całość". Odbudowa od ticketu 69 limitu nie ma (backlog
   * #87, wariant c), więc wyrocznia jest wzorcem tylko PONIŻEJ progu — reżim powyżej, gdzie
   * obie strony świadomie się różnią, pilnuje `historia.powyzej-progu.test.ts`.
   *
   * ⚠ Z tego samego powodu ta wyrocznia NIE WIDZI, czy odsiew akcji dzieje się w SQL, czy
   * w pamięci — zasiew nie ma akcji spoza słownika. Zgodność kolejności SQL (`kiedy DESC`)
   * z sortowaniem JS (`new Date(kiedy)`) wynika z pomiaru danych (jeden format ISO, 0 remisów,
   * `docs/tickets/69-FEATURE-historia-bez-limitu/raport.md`), nie z tego testu.
   */
  it("wyrocznia jest ważna: w bazie nagrania limit 5000 nie obcinał audytu", () => {
    expect(wyrocznia.kontrolaLimitu.limitNieGryzie).toBe(true);
    expect(wyrocznia.kontrolaLimitu.wierszyAuditLog).toBeLessThan(
      wyrocznia.kontrolaLimitu.limitAudytu,
    );
  });

  /**
   * Drugi warunek ważności, tym razem dla `GET /api/history`.
   *
   * Ta trasa sortuje wyłącznie `ORDER BY data DESC`, bez tiebreakera, więc przy remisie
   * czasowym kolejność zależy od planu zapytania SQLite — a ten może być inny na tabeli
   * oryginału (46 916 wierszy) niż na 20-wierszowej tabeli testowej. Wyrocznia bierze więc
   * wyłącznie wiersze o PARAMI RÓŻNYCH `data`; gdyby ktoś nagrał ją inaczej, asercja na
   * kolejność stałaby się krucha i test zaświeciłby kiedyś bez żadnej zmiany w kodzie.
   */
  it("wyrocznia jest ważna: wiersze dziennika mają parami różne `data`", () => {
    expect(wyrocznia.dziennikBezRemisow).toBe(true);
    const daty = wyrocznia.dziennikPierwszeWiersze.map((w) => w["data"]);
    expect(new Set(daty).size).toBe(daty.length);
  });

  /**
   * `GET /api/history` to gołe `SELECT * FROM history ORDER BY data DESC` — i w oryginale,
   * i u nas przez Drizzle. Klucze muszą być `camelCase` (nazwy PÓL modelu), bo oryginał też
   * jest na Drizzle; gdyby ktoś kiedyś przepisał tę trasę na surowy SQL, wyszłyby
   * `snake_case` i ten test to złapie (CLAUDE.md, pułapka `GET /api/selly/log`).
   */
  it("GET /api/history — te same wiersze, ta sama kolejność, te same klucze co u oryginału", async () => {
    const odp = await request(srodowisko.app)
      .get("/api/history")
      .set("Authorization", `Bearer ${token}`);

    expect(odp.status).toBe(200);
    expect(odp.body).toEqual(wyrocznia.dziennikPierwszeWiersze);
  });

  it("GET /api/history — zestaw kluczy wpisu jest dokładnie taki jak u oryginału", () => {
    const wzorzec = wyrocznia.dziennikPierwszeWiersze[0];
    expect(wzorzec).toBeDefined();
    expect(Object.keys(wzorzec ?? {}).sort()).toEqual([
      "data",
      "id",
      "kodProduktu",
      "kto",
      "nazwa",
      "nowaWartosc",
      "pole",
      "staraWartosc",
      "wykonalUzytkownikId",
      "zrodlo",
    ]);
  });

  /**
   * Osiem przypadków `/meta` i `/paged` — filtry, paginacja i skrajne wartości, każdy
   * porównywany z PEŁNĄ odpowiedzią oryginału (`toEqual`, nie `toMatchObject`), więc test
   * łapie też pole nadmiarowe i zmianę kolejności wierszy.
   */
  for (const [nazwa, przypadek] of Object.entries(wyrocznia.odpowiedzi)) {
    it(`${przypadek.sciezka} — odpowiedź identyczna z oryginałem (${nazwa})`, async () => {
      const odp = await request(srodowisko.app)
        .get(przypadek.sciezka)
        .set("Authorization", `Bearer ${token}`);

      expect(odp.status).toBe(200);
      expect(odp.body).toEqual(przypadek.cialo);
    });
  }

  /**
   * Kontrola samej wyroczni, nie odbudowy: gdyby ktoś przyciął plik do pustych odpowiedzi,
   * wszystkie testy wyżej przeszłyby na `[]` vs `[]` i nic by nie znaczyły. „0 różnic" ma
   * prawo paść wyłącznie razem z liczbą porównanych wpisów.
   */
  it("wyrocznia niesie realny materiał, a nie puste odpowiedzi", () => {
    expect(wyrocznia.zasiewAudytu.length).toBeGreaterThan(200);
    expect(wyrocznia.zasiewDziennika.length).toBeGreaterThan(0);
    expect(wyrocznia.dziennikPierwszeWiersze.length).toBeGreaterThan(0);

    const paged = wyrocznia.odpowiedzi["paged-domyslne"]?.cialo as { items: unknown[] };
    expect(paged.items.length).toBeGreaterThan(0);

    const meta = wyrocznia.odpowiedzi["meta"]?.cialo as { dostawcy: string[] };
    expect(meta.dostawcy.length).toBeGreaterThan(0);
  });
});
