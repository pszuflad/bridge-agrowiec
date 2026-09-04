/**
 * `GET /api/audit-log` — SUROWY dziennik audytu, port `deminified/backend-index.cjs:48735`.
 *
 * Ta trasa istnieje po to, żeby pokazać wiersze, których `/api/history/{meta,paged}` NIE
 * pokazuje (tamte odsiewają pięć rozpoznawanych akcji). Dlatego cały ciężar testów leży na
 * wierszach „nietypowych": `szczegoly_json = NULL`, zepsuty JSON, `encja_id` niezłączalny
 * z `suppliers`. Dane są wstawiane wprost do bazy — dokładnie tak, jak zapisuje je produkcja.
 */
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { auditLog } from "../src/db/schema.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";

/**
 * Wiersze odwzorowujące realnych pisarzy audytu, łącznie z trzema kłopotliwymi:
 *  • `synchronizacja_reczna` — `szczegoly_json` NULL (`:48240`, audyt bez czwartego
 *    argumentu) i `encja_id` = kod dostawcy, którego NIE MA w `suppliers` (audyt zapisuje
 *    zamiar, zanim ktokolwiek sprawdzi, czy dostawca istnieje);
 *  • `edycja_konfiguracji` i `edycja_spedycji` — nowe akcje z Iteracji 11;
 *  • wiersz z tekstem, który nie jest poprawnym JSON-em.
 */
const WIERSZE = [
  {
    uzytkownikId: 0,
    uzytkownikImie: "SYSTEM-AUTOPULL",
    akcja: "auto_pull",
    encjaTyp: "dostawca",
    encjaId: "MO3",
    szczegolyJson: '{"source":"scheduler","wczytanych":590}',
    kiedy: "2026-08-17T15:49:19.820Z",
  },
  {
    uzytkownikId: 1,
    uzytkownikImie: "Marta Bieguniak",
    akcja: "synchronizacja_reczna",
    encjaTyp: "dostawca",
    encjaId: "MO99",
    szczegolyJson: null,
    kiedy: "2026-08-18T08:00:00.000Z",
  },
  {
    uzytkownikId: 1,
    uzytkownikImie: "Marta Bieguniak",
    akcja: "edycja_konfiguracji",
    encjaTyp: "config",
    encjaId: "ai_fallback.klucz_api",
    szczegolyJson: '{"wartosc":"***"}',
    kiedy: "2026-08-19T08:00:00.000Z",
  },
  {
    uzytkownikId: 1,
    uzytkownikImie: "Marta Bieguniak",
    akcja: "edycja_spedycji",
    encjaTyp: "spedycja",
    encjaId: "MO77",
    szczegolyJson: '{"kod":"MO77","kosztDostawy":33.5}',
    kiedy: "2026-08-20T08:00:00.000Z",
  },
  {
    uzytkownikId: 1,
    uzytkownikImie: "Marta Bieguniak",
    akcja: "czyszczenie_katalogu",
    encjaTyp: "produkt",
    encjaId: "wszystkie",
    szczegolyJson: "to nie jest JSON {{{",
    kiedy: "2026-08-21T08:00:00.000Z",
  },
];

describe("GET /api/audit-log", () => {
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
    srodowisko.sqlite.prepare("DELETE FROM audit_log").run();
  });

  const pobierz = () =>
    request(srodowisko.app).get("/api/audit-log").set("Authorization", `Bearer ${token}`);

  /** ODSTĘPSTWO D2 — oryginał ma tę trasę publiczną, my wymagamy tokenu. */
  it("wymaga tokenu (odstępstwo D2 wobec publicznej trasy oryginału)", async () => {
    const odp = await request(srodowisko.app).get("/api/audit-log");

    expect(odp.status).toBe(401);
    expect(odp.body).toEqual({ error: "Nieautoryzowany" });
  });

  it("pusty audyt daje pustą tablicę, nie kopertę", async () => {
    const odp = await pobierz();

    expect(odp.status).toBe(200);
    expect(odp.body).toEqual([]);
  });

  /**
   * ⚠ NAJWAŻNIEJSZY TEST TEJ TRASY. Wiersz `synchronizacja_reczna` ma NULL w `szczegoly_json`
   * i `encja_id` = "MO99", którego nie ma w `suppliers`. Trasa nie parsuje i nie łączy się
   * z niczym, więc oba przypadki muszą przejść bez wyjątku i BEZ podmiany wartości.
   */
  it("znosi NULL w szczegolyJson i encjaId niezłączalny z suppliers", async () => {
    srodowisko.db.insert(auditLog).values(WIERSZE).run();
    expect(srodowisko.sqlite.prepare("SELECT COUNT(*) c FROM suppliers").get()).toEqual({ c: 0 });

    const odp = await pobierz();

    expect(odp.status).toBe(200);
    const wiersze = odp.body as Record<string, unknown>[];
    const reczna = wiersze.find((w) => w.akcja === "synchronizacja_reczna")!;
    expect(reczna.szczegolyJson).toBeNull();
    expect(reczna.encjaId).toBe("MO99");
  });

  /** Zepsuty JSON też jest tylko tekstem — trasa go nie tyka. */
  it("oddaje niepoprawny JSON w postaci surowej, bez wyjątku", async () => {
    srodowisko.db.insert(auditLog).values(WIERSZE).run();

    const wiersze = (await pobierz()).body as Record<string, unknown>[];
    const zepsuty = wiersze.find((w) => w.akcja === "czyszczenie_katalogu")!;
    expect(zepsuty.szczegolyJson).toBe("to nie jest JSON {{{");
  });

  /**
   * ⚠ `szczegolyJson` MUSI zostać STRINGIEM. `contract/fixtures/GET_audit-log.json` zamraża
   * właśnie string; sparsowanie go tutaj (np. przez `parsujSzczegoly`) złamałoby kontrakt.
   * Parsowanie należy do konsumenta — widoku „Dziennik" we froncie.
   */
  it("nie parsuje szczegolyJson — wartość zostaje stringiem", async () => {
    srodowisko.db.insert(auditLog).values(WIERSZE).run();

    const wiersze = (await pobierz()).body as Record<string, unknown>[];
    const auto = wiersze.find((w) => w.akcja === "auto_pull")!;
    expect(typeof auto.szczegolyJson).toBe("string");
    expect(auto.szczegolyJson).toBe('{"source":"scheduler","wczytanych":590}');
  });

  it("pokazuje akcje spoza pięciu typów rozpoznawanych przez /api/history", async () => {
    srodowisko.db.insert(auditLog).values(WIERSZE).run();

    const akcje = ((await pobierz()).body as { akcja: string }[]).map((w) => w.akcja);
    expect(akcje).toEqual(
      expect.arrayContaining([
        "synchronizacja_reczna",
        "edycja_konfiguracji",
        "edycja_spedycji",
        "czyszczenie_katalogu",
      ]),
    );

    // Kontrola negatywna: `/api/history/paged` te same wiersze odsiewa.
    const historia = await request(srodowisko.app)
      .get("/api/history/paged")
      .set("Authorization", `Bearer ${token}`);
    expect((historia.body as { items: unknown[]; total: number }).items).toEqual([]);
    expect((historia.body as { total: number }).total).toBe(0);
  });

  it("sortuje malejąco po kiedy", async () => {
    srodowisko.db.insert(auditLog).values(WIERSZE).run();

    const kiedy = ((await pobierz()).body as { kiedy: string }[]).map((w) => w.kiedy);
    expect(kiedy).toEqual([...kiedy].sort().reverse());
  });

  /** `U.listAudit(500)` — limit jest w trasie, nie w zapytaniu klienta. */
  it("oddaje najwyżej 500 najświeższych wpisów", async () => {
    const duzo = Array.from({ length: 520 }, (_, i) => ({
      uzytkownikId: 1,
      uzytkownikImie: "Marta Bieguniak",
      akcja: "auto_pull",
      encjaTyp: "dostawca",
      encjaId: "MO1",
      szczegolyJson: null,
      // Rosnące znaczniki: wiersz 519 jest najświeższy i MUSI się znaleźć w odpowiedzi.
      kiedy: new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString(),
    }));
    srodowisko.db.insert(auditLog).values(duzo).run();

    const wiersze = (await pobierz()).body as { kiedy: string }[];
    expect(wiersze).toHaveLength(500);
    expect(wiersze[0]!.kiedy).toBe(duzo[519]!.kiedy);
  });

  it("oddaje komplet kluczy wiersza audytu", async () => {
    srodowisko.db.insert(auditLog).values(WIERSZE).run();

    const wiersze = (await pobierz()).body as Record<string, unknown>[];
    for (const wiersz of wiersze) {
      expect(Object.keys(wiersz).sort()).toEqual([
        "akcja",
        "encjaId",
        "encjaTyp",
        "id",
        "kiedy",
        "szczegolyJson",
        "uzytkownikId",
        "uzytkownikImie",
      ]);
    }
  });
});
