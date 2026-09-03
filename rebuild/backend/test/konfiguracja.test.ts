/**
 * Zachowanie tras `/api/config` i `/api/spedycja` poza samym kształtem odpowiedzi
 * (ten pilnuje `konfiguracja.gate.test.ts`).
 *
 * Bez mocków: prawdziwa baza SQLite w katalogu tymczasowym i prawdziwy Express przez
 * supertest — jak reszta testów backendu. Mockowanie bazy w tym miejscu nie miałoby sensu,
 * bo sprawdzamy właśnie to, CO NAPRAWDĘ wylądowało w tabelach `config`, `spedycja_limity`
 * i `audit_log`.
 *
 * Zakres: whitelista kluczy (D4) i pól spedycji (D5), maskowanie sekretu w audycie 1:1
 * z oryginałem, UPSERT po `dostawcaKod`, bramka `requireAuth` na wszystkich czterech
 * trasach (D1).
 */
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { listaAudytu } from "../src/repos/audit.js";
import { odczytajCalaKonfiguracje } from "../src/repos/config.js";
import { listaSpedycji } from "../src/repos/spedycja.js";
import { stworzSrodowiskoTestowe, zasiejKonfiguracjeStartowa, type SrodowiskoTestowe } from "./gate/index.js";

let srodowisko: SrodowiskoTestowe;
let token: string;

beforeEach(async () => {
  srodowisko = await stworzSrodowiskoTestowe();
  zasiejKonfiguracjeStartowa(srodowisko.db);
  const odp = await request(srodowisko.app)
    .post("/api/login")
    .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
  token = (odp.body as { token: string }).token;
});

afterEach(() => srodowisko.posprzataj());

const post = (sciezka: string, cialo: object) =>
  request(srodowisko.app).post(sciezka).set("Authorization", `Bearer ${token}`).send(cialo);

describe("POST /api/config — whitelista kluczy (D4)", () => {
  it("zapisuje klucz z listy", async () => {
    const odp = await post("/api/config", { klucz: "shoper.separator", wartosc: "," });

    expect(odp.status).toBe(200);
    expect(odczytajCalaKonfiguracje(srodowisko.db)["shoper.separator"]).toBe(",");
  });

  it("odrzuca klucz spoza listy i NIE zakłada wiersza", async () => {
    // Literówka w nazwie klucza: w oryginale wpadłaby do bazy jako nowy, martwy wiersz
    // i cicho przestała działać (`U.setConfig` bez walidacji, `:48745`).
    const odp = await post("/api/config", { klucz: "shoper.separaator", wartosc: "," });

    expect(odp.status).toBe(400);
    expect(odczytajCalaKonfiguracje(srodowisko.db)).not.toHaveProperty("shoper.separaator");
  });

  it("odrzuca wartość, która nie jest tekstem", async () => {
    // Kolumna `wartosc` jest NOT NULL i cała konfiguracja to stringi — liczba w ciele
    // to błąd wołającego, nie wartość do cichego rzutowania.
    const odp = await post("/api/config", { klucz: "waga_gab.szer_paleta", wartosc: 80 });

    expect(odp.status).toBe(400);
    expect(odczytajCalaKonfiguracje(srodowisko.db)["waga_gab.szer_paleta"]).toBe("80");
  });

  it("zapisuje `shoper.kolumny` i `shoper.separator`, których nie ma w seedzie produkcji", async () => {
    // Te dwa klucze zapisuje zakładka Shoper (`GK`, frontend-index.js:26251-26256), ale
    // w fixture ich nie ma — nikt ich w produkcji jeszcze nie zapisał. Whitelista musi je
    // znać mimo to, inaczej zakładka nie miałaby czego zapisać.
    expect((await post("/api/config", { klucz: "shoper.kolumny", wartosc: "ean:EAN" })).status).toBe(200);

    const konfiguracja = odczytajCalaKonfiguracje(srodowisko.db);
    expect(konfiguracja["shoper.kolumny"]).toBe("ean:EAN");
  });
});

describe("POST /api/config — audyt", () => {
  it("maskuje wartość klucza API w dzienniku, ale zapisuje ją w bazie prawdziwą", async () => {
    await post("/api/config", { klucz: "ai_fallback.klucz_api", wartosc: "sk-proj-tajne" });

    expect(odczytajCalaKonfiguracje(srodowisko.db)["ai_fallback.klucz_api"]).toBe("sk-proj-tajne");

    const wpis = listaAudytu(srodowisko.db).find((w) => w.akcja === "edycja_konfiguracji");
    expect(wpis?.encjaTyp).toBe("config");
    expect(wpis?.encjaId).toBe("ai_fallback.klucz_api");
    expect(JSON.parse(wpis?.szczegolyJson ?? "{}")).toEqual({ wartosc: "***" });
  });

  it("NIE maskuje klucza, którego nazwa nie zawiera `klucz_api`", async () => {
    // Granica warunku 1:1 z oryginałem (`:48746`): maska patrzy na NAZWĘ klucza, nie na
    // listę sekretów — dlatego `shoper.token_api` trafia do dziennika jawnie. Test pilnuje,
    // żeby nikt „przy okazji" nie poszerzył maski, bo to byłaby zmiana zachowania.
    await post("/api/config", { klucz: "ai_fallback.model", wartosc: "gpt-4o" });
    await post("/api/config", { klucz: "shoper.token_api", wartosc: "token-jawny" });

    const wpisy = listaAudytu(srodowisko.db).filter((w) => w.akcja === "edycja_konfiguracji");
    const szczegoly = Object.fromEntries(
      wpisy.map((w) => [w.encjaId, JSON.parse(w.szczegolyJson ?? "{}") as { wartosc: string }]),
    );

    expect(szczegoly["ai_fallback.model"]?.wartosc).toBe("gpt-4o");
    expect(szczegoly["shoper.token_api"]?.wartosc).toBe("token-jawny");
  });
});

describe("POST /api/spedycja — upsert i filtr pól", () => {
  it("dwa zapisy tego samego dostawcy dają JEDEN wiersz z wartościami z drugiego", async () => {
    await post("/api/spedycja", { dostawcaKod: "MO1", progNetto: 1500, kosztPonizej: 99 });
    await post("/api/spedycja", { dostawcaKod: "MO1", progNetto: 2000, kosztPonizej: 79 });

    const mo1 = listaSpedycji(srodowisko.db).filter((w) => w.dostawcaKod === "MO1");
    expect(mo1).toHaveLength(1);
    expect(mo1[0]).toMatchObject({ progNetto: 2000, kosztPonizej: 79 });
  });

  it("zapis nieznanego dostawcy DOKŁADA wiersz — trasa nie sprawdza `suppliers`", async () => {
    // Oryginał nie waliduje istnienia dostawcy (`upsertSpedycja` patrzy tylko na własną
    // tabelę), tak samo jak audyt `synchronizacja_reczna` z I3 powstaje dla kodu spoza
    // `suppliers`. Odtworzone dosłownie.
    await post("/api/spedycja", { dostawcaKod: "MOX", progNetto: 500, kosztPonizej: 10 });

    expect(listaSpedycji(srodowisko.db)).toHaveLength(11);
  });

  it("częściowy zapis NIE zeruje pozostałych kolumn", async () => {
    // `X.update(gn).set(t)` w oryginale ustawia wyłącznie pola obecne w ciele (`:45079`).
    await post("/api/spedycja", { dostawcaKod: "MO2", progNetto: 7000 });

    const mo2 = listaSpedycji(srodowisko.db).find((w) => w.dostawcaKod === "MO2");
    expect(mo2?.progNetto).toBe(7000);
    expect(mo2?.kosztPonizej).toBe(119);
    expect(mo2?.dodatkoweReguly).toContain("JMK");
  });

  it("pole spoza listy nie trafia do bazy, reszta ciała zapisuje się normalnie", async () => {
    await post("/api/spedycja", { dostawcaKod: "MO4", progNetto: 300, id: 999 });

    const mo4 = listaSpedycji(srodowisko.db).find((w) => w.dostawcaKod === "MO4");
    expect(mo4?.progNetto).toBe(300);
    // `id` to tożsamość wiersza — przepuszczenie go pozwoliłoby przestawić wiersz.
    expect(mo4?.id).not.toBe(999);
  });

  it("odrzuca ciało bez `dostawcaKod`", async () => {
    const odp = await post("/api/spedycja", { progNetto: 100 });

    expect(odp.status).toBe(400);
    expect(listaSpedycji(srodowisko.db)).toHaveLength(10);
  });

  it("zapisuje audyt `edycja_spedycji` z kodem dostawcy jako encją", async () => {
    await post("/api/spedycja", { dostawcaKod: "MO3", kosztPonizej: 149 });

    const wpis = listaAudytu(srodowisko.db).find((w) => w.akcja === "edycja_spedycji");
    expect(wpis?.encjaTyp).toBe("spedycja");
    expect(wpis?.encjaId).toBe("MO3");
  });
});

describe("requireAuth na wszystkich czterech trasach (D1)", () => {
  // W produkcji oba GET-y są PUBLICZNE (`security: []` w kontrakcie, brak `we` w oryginale)
  // — `docs/spec-backend.md:41-49` wymienia `/api/config` wśród najgroźniejszych takich tras.
  // Odbudowa odwraca to od I1a; ten test pilnuje, żeby odwrócenie nie wyparowało.
  it.each([
    ["get", "/api/config"],
    ["post", "/api/config"],
    ["get", "/api/spedycja"],
    ["post", "/api/spedycja"],
  ] as const)("%s %s bez tokenu → 401", async (metoda, sciezka) => {
    const odp = await request(srodowisko.app)[metoda](sciezka).send({});

    expect(odp.status).toBe(401);
  });
});
