/**
 * Lista pól edytowalnych dla narzutów i promocji — Iteracja 4a, `rebuild-backlog.md` #14.
 *
 * CO TU JEST DOWODZONE. Oryginał wrzuca ciało żądania wprost do `SET`
 * (`updateMarkup`/`updatePromotion`, `:44975`/`:44998`), więc każdy zalogowany użytkownik mógł
 * ustawić dowolną kolumnę. Stawka jest wyższa niż przy dostawcach: obie metody wołają po
 * zapisie `recalcPricesFromRules()`, czyli pole wpuszczone przez pomyłkę PRZELICZA CENY
 * CAŁEGO KATALOGU. Odbudowa zamyka to listą pól (decyzja użytkownika, plan.md D3) — ten plik
 * pilnuje, że lista faktycznie działa i że nikt jej po cichu nie rozszerzy.
 *
 * Wzorzec pliku: `dostawcy.patch.test.ts` (blok 3f-2).
 */
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { auditLog, markups, products, promotions } from "../src/db/schema.js";
import {
  PROMOCJA_TESTOWA,
  stworzSrodowiskoTestowe,
  zasiejNarzutyZFixtures,
  zasiejPromocjeTestowa,
  type SrodowiskoTestowe,
} from "./gate/index.js";

/** `id` reguły z `contract/fixtures/GET_markups.json`. */
const ID_NARZUTU = 10;
const ID_PROMOCJI = PROMOCJA_TESTOWA.id;

describe("Narzuty i promocje — lista pól edytowalnych i audyt", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;

  beforeEach(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    zasiejNarzutyZFixtures(srodowisko.db);
    zasiejPromocjeTestowa(srodowisko.db);
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;
  });

  afterEach(() => srodowisko.posprzataj());

  const patch = (sciezka: string, cialo: object) =>
    request(srodowisko.app).patch(sciezka).set("Authorization", `Bearer ${token}`).send(cialo);
  const post = (sciezka: string, cialo: object) =>
    request(srodowisko.app).post(sciezka).set("Authorization", `Bearer ${token}`).send(cialo);
  const del = (sciezka: string) =>
    request(srodowisko.app).delete(sciezka).set("Authorization", `Bearer ${token}`);

  const narzutZBazy = () =>
    srodowisko.db.select().from(markups).all().find((m) => m.id === ID_NARZUTU)!;
  const wpisyAudytu = (akcja: string) =>
    srodowisko.db.select().from(auditLog).all().filter((w) => w.akcja === akcja);

  describe("1. PATCH narzutu", () => {
    it("zapisuje pola z listy", async () => {
      const odp = await patch(`/api/markups/${ID_NARZUTU}`, { wartosc: 12, status: "wylaczony" });

      expect(odp.status).toBe(200);
      const po = narzutZBazy();
      expect(po.wartosc).toBe(12);
      expect(po.status).toBe("wylaczony");
    });

    it("NIE pozwala podmienić tożsamości wiersza (`id`)", async () => {
      await patch(`/api/markups/${ID_NARZUTU}`, { id: 999, wartosc: 12 });

      const wszystkie = srodowisko.db.select().from(markups).all();
      expect(wszystkie).toHaveLength(1);
      expect(wszystkie[0]!.id).toBe(ID_NARZUTU);
      expect(wszystkie[0]!.wartosc).toBe(12);
    });

    /**
     * ⚠ TO JEST SEDNO: `zmienilUzytkownikId` i `zmienionoData` ustawia SERWER z sesji
     * i zegara. Gdyby weszły na listę, dałoby się podpisać zmianę cudzym identyfikatorem.
     */
    it("podpis zmiany ustawia SERWER, nie użytkownik", async () => {
      const przed = narzutZBazy().zmienionoData;

      await patch(`/api/markups/${ID_NARZUTU}`, {
        wartosc: 12,
        zmienilUzytkownikId: 4242,
        zmienionoData: "1999-01-01T00:00:00.000Z",
      });

      const po = narzutZBazy();
      expect(po.zmienilUzytkownikId).toBe(srodowisko.uzytkownik.id);
      expect(po.zmienilUzytkownikId).not.toBe(4242);
      expect(po.zmienionoData).not.toBe("1999-01-01T00:00:00.000Z");
      expect(po.zmienionoData).not.toBe(przed);
    });

    it("pole spoza schematu nie wywraca żądania ani nie trafia do bazy", async () => {
      const odp = await patch(`/api/markups/${ID_NARZUTU}`, {
        wartosc: 12,
        nieistniejaceZupelnie: "śmieć",
      });

      expect(odp.status).toBe(200);
      expect(narzutZBazy().wartosc).toBe(12);
      expect(Object.keys(narzutZBazy())).not.toContain("nieistniejaceZupelnie");
    });

    /**
     * ⚠ ŚWIADOMY ROZJAZD ZAPISU I AUDYTU (plan.md D2, decyzja użytkownika). Zapis idzie przez
     * filtr, ale audyt loguje SUROWE `c.body` — port 1:1 z oryginałem (`:48709`). Dzięki temu
     * próba wysłania pola spoza listy ZOSTAJE w dzienniku jako sygnał, zamiast zniknąć bez
     * śladu. Cena: `szczegoly_json` opisuje ZAMIAR, nie stan bazy.
     */
    it("audyt loguje surowe ciało — łącznie z polem, które NIE zostało zapisane", async () => {
      await patch(`/api/markups/${ID_NARZUTU}`, { wartosc: 12, zmienilUzytkownikId: 4242 });

      const wpisy = wpisyAudytu("edycja_narzutu");
      expect(wpisy).toHaveLength(1);
      expect(wpisy[0]!.encjaTyp).toBe("narzut");
      expect(wpisy[0]!.encjaId).toBe(String(ID_NARZUTU));

      const szczegoly = JSON.parse(wpisy[0]!.szczegolyJson!) as Record<string, unknown>;
      expect(szczegoly.wartosc).toBe(12);
      expect(szczegoly.zmienilUzytkownikId, "odrzucone pole ma zostać w audycie").toBe(4242);
      expect(narzutZBazy().zmienilUzytkownikId, "ale NIE w bazie").not.toBe(4242);
    });

    it("nieistniejąca reguła ⇒ 404", async () => {
      const odp = await patch("/api/markups/9999", { wartosc: 12 });
      expect(odp.status).toBe(404);
    });
  });

  describe("2. PATCH promocji", () => {
    it("zapisuje pola z listy, w tym daty (choć silnik ich nie czyta)", async () => {
      const odp = await patch(`/api/promotions/${ID_PROMOCJI}`, {
        rabatPct: 25,
        koniec: "2026-12-31",
      });

      expect(odp.status).toBe(200);
      const po = srodowisko.db.select().from(promotions).all()[0]!;
      expect(po.rabatPct).toBe(25);
      expect(po.koniec).toBe("2026-12-31");
    });

    it("podpis zmiany ustawia SERWER, nie użytkownik", async () => {
      await patch(`/api/promotions/${ID_PROMOCJI}`, { rabatPct: 25, zmienilUzytkownikId: 4242 });

      const po = srodowisko.db.select().from(promotions).all()[0]!;
      expect(po.zmienilUzytkownikId).toBe(srodowisko.uzytkownik.id);
    });

    /**
     * ⚠ ASYMETRIA ODTWARZANA 1:1 (plan.md D5): bliźniacza trasa narzutu ma jawne 404
     * (`:48709`), a ta go NIE MA (`:48722-48731`) — oryginał oddaje 200 z pustym ciałem.
     * Sesja 4b nie może więc zakładać, że w odpowiedzi zawsze jest obiekt. Ten test istnieje
     * po to, żeby „oczywista poprawka" nie przeszła przypadkiem.
     */
    it("⚠ nieistniejąca promocja ⇒ 200 z pustym ciałem, NIE 404", async () => {
      const odp = await patch("/api/promotions/9999", { rabatPct: 25 });

      expect(odp.status).toBe(200);
      // Express przy `res.json(undefined)` wysyła PUSTE ciało, nie `{}` ani `null`.
      expect(odp.text).toBe("");
    });

    it("audyt promocji powstaje TAKŻE dla nieistniejącego id — zapisuje zamiar", async () => {
      await patch("/api/promotions/9999", { rabatPct: 25 });

      const wpisy = wpisyAudytu("edycja_promocji");
      expect(wpisy).toHaveLength(1);
      expect(wpisy[0]!.encjaId).toBe("9999");
    });
  });

  describe("3. POST — ten sam filtr co PATCH", () => {
    it("tworzy regułę z pól z listy i ignoruje resztę", async () => {
      const odp = await post("/api/markups", {
        typ: "dostawca",
        zakres: "MO9",
        wartosc: 15,
        jednostka: "procent",
        priorytet: 70,
        status: "aktywny",
        nazwa: "MO9",
        id: 777,
        zmienilUzytkownikId: 4242,
      });

      expect(odp.status).toBe(200);
      const nowa = srodowisko.db.select().from(markups).all().find((m) => m.zakres === "MO9")!;
      expect(nowa.wartosc).toBe(15);
      expect(nowa.id, "podane `id` ma zostać zignorowane").not.toBe(777);
      expect(nowa.zmienilUzytkownikId).toBe(srodowisko.uzytkownik.id);
    });

    it("audyt tworzenia też loguje surowe ciało", async () => {
      await post("/api/promotions", {
        nazwa: "Lato",
        rabatPct: 5,
        zasieg: "BKT",
        start: "2026-06-01",
        koniec: "2026-08-31",
        status: "aktywna",
        cosSpozaListy: true,
      });

      const wpisy = wpisyAudytu("dodanie_promocji");
      expect(wpisy).toHaveLength(1);
      const szczegoly = JSON.parse(wpisy[0]!.szczegolyJson!) as Record<string, unknown>;
      expect(szczegoly.cosSpozaListy).toBe(true);
    });
  });

  describe("4. DELETE", () => {
    it("kasuje regułę i zwraca {ok:true} z wpisem audytu", async () => {
      const odp = await del(`/api/markups/${ID_NARZUTU}`);

      expect(odp.status).toBe(200);
      expect(odp.body).toEqual({ ok: true });
      expect(srodowisko.db.select().from(markups).all()).toHaveLength(0);
      expect(wpisyAudytu("usuniecie_narzutu")).toHaveLength(1);
    });

    /** Bez 404 — oryginał kasuje w próżnię i mimo to potwierdza. Audyt zapisuje ZAMIAR. */
    it("nieistniejące id też daje {ok:true} i wpis audytu", async () => {
      const odp = await del("/api/markups/9999");

      expect(odp.status).toBe(200);
      expect(odp.body).toEqual({ ok: true });
      expect(wpisyAudytu("usuniecie_narzutu")).toHaveLength(1);
    });

    it("usunięcie reguły zapisuje NULL w szczegółach audytu (brak 4. argumentu w oryginale)", async () => {
      await del(`/api/markups/${ID_NARZUTU}`);
      expect(wpisyAudytu("usuniecie_narzutu")[0]!.szczegolyJson).toBeNull();
    });
  });

  describe("5. Mutacja reguły przelicza ceny katalogu", () => {
    /**
     * To jest powód, dla którego lista pól ma tu wyższą stawkę niż przy dostawcach:
     * KAŻDA mutacja narzutu lub promocji przelicza CAŁY katalog. Test dowodzi, że
     * `przeliczCenyZRegul` jest realnie wołane z trasy, a nie tylko istnieje w repozytorium.
     */
    function zasiejProdukt() {
      // Kasujemy promocję zasianą w `beforeEach`, żeby każdy test tej sekcji mierzył
      // JEDNĄ regułę. Ich składanie sprawdza `ceny.silnik.test.ts`.
      srodowisko.db.delete(promotions).run();
      srodowisko.db
        .insert(products)
        .values({
          kod: "P1",
          nazwa: "Opona",
          marka: "BKT",
          kategoria: "Rolnicze",
          dostawca: "MO5",
          magazyn: "PL",
          stan: 4,
          cenaZakupu: 1000,
          cenaSprzedazy: 1250,
          marzaPct: 25,
          vat: 23,
          status: "aktywny",
          dataAktualizacji: "2026-01-01T00:00:00.000Z",
        })
        .run();
    }
    const cena = () => srodowisko.db.select().from(products).all()[0]!.cenaSprzedazy;

    it("PATCH narzutu przelicza cenę produktu w katalogu", async () => {
      zasiejProdukt();
      // Fixture ma regułę globalną 6% — po zmianie na 20% cena musi pójść za nią.
      await patch(`/api/markups/${ID_NARZUTU}`, { wartosc: 20 });
      expect(cena()).toBe(1476);
    });

    it("DELETE narzutu też przelicza — zostaje sam VAT", async () => {
      zasiejProdukt();
      await del(`/api/markups/${ID_NARZUTU}`);
      expect(cena()).toBe(1230);
    });

    it("POST promocji obniża ceny natychmiast, bez czekania na import", async () => {
      zasiejProdukt();
      await post("/api/promotions", {
        nazwa: "Lato",
        rabatPct: 50,
        zasieg: "BKT",
        start: "2026-06-01",
        koniec: "2026-08-31",
        status: "aktywna",
      });
      // 1000 × 1,06 × 0,5 × 1,23 = 651,9 → 651
      expect(cena()).toBe(651);
    });
  });
});
