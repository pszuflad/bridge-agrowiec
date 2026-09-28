/**
 * Cztery trasy polityki stagingu (Staging v2) — przez HTTP.
 *
 * Charakteryzacja (`polityka.charakteryzacja.test.ts`) dowodzi, że LOGIKA zgadza się
 * z uruchomionym oryginałem. Ten plik sprawdza to, czego tamta nie widzi: kształt
 * odpowiedzi HTTP, kody statusu, wpisy audytu i wymóg uwierzytelnienia.
 *
 * ⚠ KLUCZ BŁĘDU TO `message`, NIE `error`. Reszta tras stagingu (`staging-mutacje.ts`)
 * odpowiada `{error}`, bo w produkcji to inny moduł. Ta niespójność jest ODTWARZANA
 * świadomie — patrz `routes/staging-polityka.ts`.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { auditLog, products, stagingItems } from "../src/db/schema.js";
import { version } from "../src/import/polityka/helpery.js";
import { stworzSrodowiskoTestowe, type SrodowiskoTestowe } from "./gate/index.js";
import { pozycja, produkt } from "./charakteryzacja/akceptacja/scenariusze.mjs";

type Wiersz = Record<string, unknown>;

const EAN_KARTY = "5901234123457";

/** Kompletna pozycja Staging v2 — przechodzi wszystkie siedem blokad `checkAcceptance`. */
function pozycjaV2(pola: Record<string, unknown> = {}) {
  const wlasny = (pola.snapshot ?? {}) as Record<string, unknown>;
  return pozycja({
    ...pola,
    snapshot: { _policyVersion: 2, _catalogVersion: null, ...wlasny },
  }) as Wiersz;
}

describe("Trasy polityki stagingu — przez HTTP", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeEach(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });
  afterEach(() => srodowisko.posprzataj());

  const post = (sciezka: string, cialo: object = {}) =>
    request(srodowisko.app).post(sciezka).set("Authorization", `Bearer ${token}`).send(cialo);
  const get = (sciezka: string) =>
    request(srodowisko.app).get(sciezka).set("Authorization", `Bearer ${token}`);

  const zasiejStaging = (...wiersze: Wiersz[]) => {
    srodowisko.db.insert(stagingItems).values(wiersze as never).run();
    return srodowisko.db.select().from(stagingItems).all() as unknown as { id: number }[];
  };
  const zasiejKatalog = (...wiersze: Wiersz[]) =>
    srodowisko.db.insert(products).values(wiersze as never).run();
  const audyt = () =>
    srodowisko.db.select().from(auditLog).all() as unknown as Record<string, unknown>[];

  describe("GET /api/staging/:id/review", () => {
    it("404 z `message`, gdy zgłoszenia już nie ma", async () => {
      const odp = await get("/api/staging/9999/review");

      expect(odp.status).toBe(404);
      expect(odp.body).toEqual({ message: "Zgłoszenie zostało zastąpione. Odśwież staging." });
    });

    it("oddaje komplet pól przeglądu", async () => {
      const [a] = zasiejStaging(
        pozycjaV2({ powod: "Nowa pozycja", snapshot: { _matchIssue: "ambiguous", dot: "1223" } }),
      );

      const odp = await get(`/api/staging/${a!.id}/review`);

      expect(odp.status).toBe(200);
      expect(odp.body).toMatchObject({
        id: a!.id,
        kod: "P1",
        powod: "Nowa pozycja",
        matchIssue: "ambiguous",
        absenceReview: false,
        absenceEvidence: [],
        duplicateSource: false,
        sourceConflict: null,
        eanIssue: null,
      });
      expect(odp.body.incoming).toMatchObject({ marka: "BKT", rozmiar: "480/70R28", dot: "1223" });
      expect(odp.body.candidates).toEqual([]);
    });

    it("`incoming.stan` i `status` pochodzą z KATALOGU, nie ze snapshotu", async () => {
      // To jest realna pułapka przy czytaniu `:630` — snapshot niesie `stan` z cennika,
      // a trasa pokazuje obok niego stan karty, która stoi dziś w katalogu.
      zasiejKatalog(produkt({ kod: "P1", stan: 99, status: "wstrzymany" }) as Wiersz);
      const [a] = zasiejStaging(pozycjaV2({ stanNowy: 4 }));

      const odp = await get(`/api/staging/${a!.id}/review`);

      expect(odp.body.incoming.stan).toBe(99);
      expect(odp.body.incoming.status).toBe("wstrzymany");
    });

    it("kandydat dostaje stan żywej karty i trójstronną zgodność DOT", async () => {
      zasiejKatalog(
        produkt({ id: 1, kod: "P1", dot: "1223", stan: 0, status: "wstrzymany" }) as Wiersz,
        produkt({ id: 2, kod: "P2", dot: "1223", stan: 5, status: "aktywny" }) as Wiersz,
      );
      const [a] = zasiejStaging(
        pozycjaV2({
          snapshot: {
            dot: "1223",
            _candidates: [{ kod: "P2", ean: null, dot: "1223", rozmiar: "480/70R28" }],
          },
        }),
      );

      const odp = await get(`/api/staging/${a!.id}/review`);
      const kandydat = odp.body.candidates[0];

      expect(kandydat.catalogStan).toBe(5);
      expect(kandydat.status, "status kandydata to status jego ŻYWEJ karty").toBe("aktywny");
      expect(kandydat.catalogDot).toBe("1223");
      expect(kandydat.selectable).toBe(true);
      expect(kandydat.sameDot, "`sameDot` niesie tę samą wartość co `selectable`").toBe(true);
      expect(typeof kandydat.catalogVersion).toBe("string");
    });

    it("kandydat z INNYM DOT nie jest wybieralny", async () => {
      zasiejKatalog(
        produkt({ id: 1, kod: "P1", dot: "1223" }) as Wiersz,
        produkt({ id: 2, kod: "P2", dot: "0124" }) as Wiersz,
      );
      const [a] = zasiejStaging(
        pozycjaV2({
          snapshot: {
            dot: "1223",
            _candidates: [{ kod: "P2", ean: null, dot: "0124", rozmiar: "480/70R28" }],
          },
        }),
      );

      const odp = await get(`/api/staging/${a!.id}/review`);

      expect(odp.body.candidates[0].selectable).toBe(false);
    });

    it("bez tokenu — 401", async () => {
      const odp = await request(srodowisko.app).get("/api/staging/1/review");
      expect(odp.status).toBe(401);
    });
  });

  describe("POST /api/staging/:id/resolve", () => {
    it("`new` oddaje NOWE id i pisze audyt", async () => {
      const [a] = zasiejStaging(pozycjaV2({ snapshot: { _matchIssue: "ambiguous" } }));

      const odp = await post(`/api/staging/${a!.id}/resolve`, { action: "new" });

      expect(odp.status).toBe(200);
      expect(odp.body.ok).toBe(true);
      expect(odp.body.kod).toBe("P1");
      expect(odp.body.id, "rozstrzygnięcie zakłada nowe zgłoszenie").not.toBe(a!.id);

      const wpis = audyt().find((w) => w.akcja === "rozstrzygniecie_stagingu");
      expect(wpis).toBeDefined();
      expect(JSON.parse(String(wpis!.szczegolyJson))).toMatchObject({ action: "new", kod: "P1" });
    });

    it("nieprawidłowa decyzja — 409 z `message`", async () => {
      const [a] = zasiejStaging(pozycjaV2({ snapshot: { _matchIssue: "ambiguous" } }));

      const odp = await post(`/api/staging/${a!.id}/resolve`, { action: "cokolwiek" });

      expect(odp.status).toBe(409);
      expect(odp.body).toEqual({ message: "Nieprawidłowa decyzja." });
      expect(audyt().find((w) => w.akcja === "rozstrzygniecie_stagingu")).toBeUndefined();
    });
  });

  describe("POST /api/staging/:id/close-absence-review", () => {
    it("zamyka sprawę i pisze audyt z decyzją", async () => {
      const stara = produkt({
        id: 1,
        kod: "P1",
        status: "wstrzymany",
        stan: 0,
        model: "AGRIMAX RT 765",
        ean: EAN_KARTY,
      }) as Wiersz;
      zasiejKatalog(stara);
      const [a] = zasiejStaging(
        pozycjaV2({ snapshot: { _absenceReview: true, _catalogVersion: version(stara) } }),
      );

      const odp = await post(`/api/staging/${a!.id}/close-absence-review`);

      expect(odp.status).toBe(200);
      expect(odp.body).toEqual({ ok: true, kod: "P1" });

      const wpis = audyt().find((w) => w.akcja === "zamkniecie_sprawdzenia_starej_karty");
      expect(wpis).toBeDefined();
      expect(JSON.parse(String(wpis!.szczegolyJson))).toMatchObject({
        kod: "P1",
        decyzja: "pozostaw_wstrzymana_bez_scalania",
      });
    });

    it("zgłoszenie, które nie jest sprawą starej karty — 409", async () => {
      const [a] = zasiejStaging(pozycjaV2({}));

      const odp = await post(`/api/staging/${a!.id}/close-absence-review`);

      expect(odp.status).toBe(409);
      expect(odp.body).toEqual({ message: "To nie jest sprawa starej karty." });
    });
  });

  describe("POST /api/staging/:id/choose-absence-card", () => {
    const zasiejSprawe = () => {
      const stara = produkt({
        id: 1,
        kod: "P1",
        status: "wstrzymany",
        stan: 0,
        dot: "1223",
        model: "AGRIMAX RT 765",
        ean: EAN_KARTY,
      }) as Wiersz;
      const kandydat = produkt({ id: 2, kod: "P2", dot: "1223", status: "aktywny" }) as Wiersz;
      zasiejKatalog(stara, kandydat);
      const [a] = zasiejStaging(
        pozycjaV2({
          snapshot: {
            _absenceReview: true,
            _catalogVersion: version(stara),
            dot: "1223",
            _candidates: [{ kod: "P2", ean: null, dot: "1223", rozmiar: "480/70R28" }],
          },
        }),
      );
      return { id: a!.id, kandydat };
    };

    it("wybór kandydata — 200, audyt i wybrany kod", async () => {
      const { id, kandydat } = zasiejSprawe();

      const odp = await post(`/api/staging/${id}/choose-absence-card`, {
        selectedCode: "P2",
        candidateVersion: version(kandydat),
      });

      expect(odp.status).toBe(200);
      expect(odp.body).toEqual({ ok: true, kod: "P2" });

      const wpis = audyt().find((w) => w.akcja === "wybor_karty_z_biezacej_oferty");
      expect(wpis).toBeDefined();
      expect(JSON.parse(String(wpis!.szczegolyJson))).toMatchObject({ wybranyKod: "P2" });
    });

    it("nieaktualny odcisk karty — 409 z `message`", async () => {
      const { id } = zasiejSprawe();

      const odp = await post(`/api/staging/${id}/choose-absence-card`, {
        selectedCode: "P2",
        candidateVersion: "odcisk-sprzed-zmiany",
      });

      expect(odp.status).toBe(409);
      expect(odp.body).toEqual({
        message: "Karta z bieżącej oferty została zmieniona. Odśwież cennik.",
      });
      expect(audyt().find((w) => w.akcja === "wybor_karty_z_biezacej_oferty")).toBeUndefined();
    });
  });

  describe("POST /api/staging/accept — kształt odpowiedzi przy blokadzie polityki", () => {
    it("zablokowana pozycja daje 409 z `message` i NIE zapisuje audytu", async () => {
      // Pozycja bez `_policyVersion` — czyli ze starego importu.
      const [a] = zasiejStaging(pozycja({}) as Wiersz);

      const odp = await post("/api/staging/accept", { ids: [a!.id] });

      expect(odp.status).toBe(409);
      expect(odp.body).toEqual({
        message: "To zgłoszenie pochodzi ze starego importu. Odśwież cennik przed akceptacją.",
      });
      expect(audyt().find((w) => w.akcja === "akceptacja_stagingu")).toBeUndefined();
    });

    it("blokada w ŚRODKU partii — wcześniejsze pozycje zostają zatwierdzone", async () => {
      // ⚠ To NIE jest defekt, tylko wierne odtworzenie `:48544` — pętla bez `try`/`catch`
      // i bez zbiorczej transakcji. Test istnieje po to, żeby nikt tego „nie naprawił".
      const [a, b] = zasiejStaging(
        pozycjaV2({ kod: "P1", snapshot: { kod: "P1" } }),
        pozycja({ kod: "P2", snapshot: { kod: "P2" } }) as Wiersz,
      );

      const odp = await post("/api/staging/accept", { ids: [a!.id, b!.id] });

      expect(odp.status).toBe(409);
      const katalog = srodowisko.db.select().from(products).all() as unknown as Wiersz[];
      expect(katalog.map((p) => p.kod), "pierwsza pozycja przeszła przed blokadą").toEqual(["P1"]);
    });
  });
});
