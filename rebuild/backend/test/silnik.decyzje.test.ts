/**
 * TESTY DECYZJI SILNIKA — Iteracja 3d-1.
 *
 * Czym różnią się od `silnik.charakteryzacja.test.ts`: tamten dowodzi, że nasz port zachowuje
 * się jak uruchomiony oryginał — jest wierny, ale milczy o tym, CO właściwie odtwarza.
 * Ten plik zapisuje reguły biznesowe wprost, po polsku, tak żeby dało się je przeczytać bez
 * bundla produkcji obok. Jeśli kiedyś ktoś zmieni zachowanie świadomie, charakteryzacja powie
 * „rozjazd", a te testy powiedzą „co dokładnie przestało obowiązywać".
 *
 * Trzy reguły, które są tu stawką:
 *   1. Import ZATWIERDZA SAM tylko to, co nie rusza tożsamości opony (cena/marża/stan/magazyn).
 *   2. Brak w KOMPLETNEJ ofercie wstrzymuje produkt NATYCHMIAST (#104), a osobna ścieżka
 *      dowodowa wystawia „wycofana" dopiero po trzech różnych kompletnych ofertach
 *      oddalonych o co najmniej 24 h (#103).
 *   3. Ręczna poprawka Marty WYGRYWA z plikiem dostawcy. Zawsze — ale od Staging v2 robi to
 *      po cichu, bez meldowania konfliktu.
 *
 * ⚠ AKTUALIZACJA I15.4b (ticket 130). Reguła 2 wyglądała wcześniej inaczej: stary `tk()`
 * liczył „trzy nieobecności POD RZĄD" w kolumnie `nieobecnosc_pod_rzad` i dopiero wtedy
 * wystawiał wiersz `wycofana`. `staging_policy` rozdziela to na DWA niezależne mechanizmy —
 * natychmiastowe wstrzymanie i powolne dowodzenie nieobecności — bo licznik przebiegów dawał
 * fałszywe wycofania, gdy dostawca przysłał ten sam plik kilka razy (backlog #103).
 */
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Baza } from "../src/db/index.js";
import { historiaCen, manualOverrides, products, stagingItems } from "../src/db/schema.js";
import { PustyImportBlad, silnikStagingu } from "../src/import/tk.js";
import type { RekordSurowy } from "../src/import/typy.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";

const DOSTAWCA = "MO5";
const EAN = "5901234123457";

/** Opona w postaci, w jakiej przychodzi z adaptera — wspólna baza dla rekordów cennika. */
const OPONA = {
  nazwa: "Opona 480/70R28 BKT AGRIMAX RT 765",
  rozmiar: "480/70R28",
  marka: "BKT",
  model: "AGRIMAX RT 765",
  kategoria: "Opony rolnicze",
  ean: EAN,
};

/** Wiersz `products` z wartościami domyślnymi — nadpisujemy tylko to, co bada dany test. */
function zasiejProdukt(db: Baza, pola: Record<string, unknown>): number {
  const wiersz = {
    kod: "P1",
    nazwa: OPONA.nazwa,
    marka: "BKT",
    model: "AGRIMAX RT 765",
    kategoria: "Opony rolnicze",
    dostawca: DOSTAWCA,
    magazyn: "PL",
    stan: 4,
    cenaZakupu: 1000,
    cenaSprzedazy: 1300,
    marzaPct: 30,
    vat: 23,
    status: "aktywny",
    rozmiar: "480/70R28",
    ean: EAN,
    eanIsValid: 1,
    nieobecnoscPodRzad: 0,
    dataAktualizacji: "2026-01-01T00:00:00.000Z",
    ...pola,
  };
  db.insert(products)
    .values(wiersz as unknown as typeof products.$inferInsert)
    .run();
  return (db.select().from(products).where(eq(products.kod, String(wiersz.kod))).get() as { id: number })
    .id;
}

/**
 * Rekord cennika po adapterze. `magazyn` jest tu JAWNIE, bo bez niego normalizacja daje
 * "—" i pozycja wygląda na zmienioną względem produktu z magazynem "PL" — czyli test
 * "bez zmian" badałby coś innego, niż zapowiada.
 */
const rekord = (pola: Record<string, unknown>): RekordSurowy =>
  ({ kod: "P1", ...OPONA, stan: 4, magazyn: "PL", cenaZakupu: 1000, ...pola }) as unknown as RekordSurowy;

describe("Silnik importu — decyzje", () => {
  let baza: TestowaBaza;
  let uruchom: ReturnType<typeof silnikStagingu>;

  beforeEach(() => {
    baza = stworzTestowaBaze();
    uruchom = silnikStagingu(baza.db);
  });
  afterEach(() => baza.posprzataj());

  const staging = () => baza.db.select().from(stagingItems).all();
  const produkt = (id: number) => baza.db.select().from(products).where(eq(products.id, id)).get()!;

  describe("1. Co import zatwierdza SAM, a co oddaje człowiekowi", () => {
    it("sama zmiana ceny zakupu → auto-zatwierdzenie, katalog zaktualizowany, staging pusty", () => {
      const id = zasiejProdukt(baza.db, { cenaZakupu: 1000 });

      const statystyki = uruchom(DOSTAWCA, [rekord({ cenaZakupu: 1234.5 })]);

      expect(statystyki.autoZatwierdzone).toBe(1);
      expect(statystyki.zmienione).toBe(0);
      expect(staging()).toHaveLength(0);
      expect(produkt(id).cenaZakupu).toBe(1234.5);
    });

    it("sama zmiana stanu i magazynu → auto-zatwierdzenie", () => {
      const id = zasiejProdukt(baza.db, { stan: 4, magazyn: "PL" });

      const statystyki = uruchom(DOSTAWCA, [rekord({ stan: 19, magazyn: "DE" })]);

      expect(statystyki.autoZatwierdzone).toBe(1);
      expect(produkt(id).stan).toBe(19);
      expect(produkt(id).magazyn).toBe("DE");
    });

    it("zmiana pola TOŻSAMOŚCI opony (model) NIE jest auto-zatwierdzana — idzie do człowieka", () => {
      const id = zasiejProdukt(baza.db, { cenaZakupu: 1000 });

      const statystyki = uruchom(DOSTAWCA, [
        rekord({ cenaZakupu: 1234.5, model: "AGRIMAX RT 855" }),
      ]);

      expect(statystyki.autoZatwierdzone).toBe(0);
      expect(statystyki.zmienione).toBe(1);
      expect(staging()[0]!.typZmiany).toBe("zmiana_kluczowa");
      // Kluczowe: cena NIE weszła do katalogu, mimo że sama w sobie byłaby auto-zatwierdzalna.
      expect(produkt(id).cenaZakupu).toBe(1000);
    });

    it("brak jakiejkolwiek zmiany → bezZmian, katalog i staging nietknięte", () => {
      const id = zasiejProdukt(baza.db, {});

      const statystyki = uruchom(DOSTAWCA, [rekord({})]);

      expect(statystyki.bezZmian).toBe(1);
      expect(statystyki.autoZatwierdzone).toBe(0);
      expect(staging()).toHaveLength(0);
      expect(produkt(id).dataAktualizacji).toBe("2026-01-01T00:00:00.000Z");
    });

    it("auto-zatwierdzenie zostawia ślad w historia_cen — z cenami PO zmianie", () => {
      const id = zasiejProdukt(baza.db, { cenaZakupu: 1000, stan: 4 });

      uruchom(DOSTAWCA, [rekord({ cenaZakupu: 1234.5, stan: 9 })]);

      const historia = baza.db.select().from(historiaCen).all();
      expect(historia).toHaveLength(1);
      expect(historia[0]!.produktId).toBe(id);
      expect(historia[0]!.kod).toBe("P1");
      expect(historia[0]!.dostawca).toBe(DOSTAWCA);
      expect(historia[0]!.cenaZakupu).toBe(1234.5);
      expect(historia[0]!.stan).toBe(9);
      // Tożsamość opony pochodzi z produktu SPRZED zmiany.
      expect(historia[0]!.rozmiar).toBe("480/70R28");
    });

    it("auto-zatwierdzenie dolicza wymiary paczki przez bridge_ext.applyDims", () => {
      const id = zasiejProdukt(baza.db, { cenaZakupu: 1000, rozmiar: "480/70R30" });

      uruchom(DOSTAWCA, [rekord({ cenaZakupu: 1234.5, rozmiar: "480/70R30" })]);

      // 480/70R30 → wysokość 144 cm, przesyłka +15. Gdyby port `bridge_ext` przestał się
      // ładować, moduł połknąłby błąd i te pola zostałyby NULL-em — patrz `bridge-ext.test.ts`.
      expect(produkt(id).wysokosc).toBe(144);
      expect(produkt(id).wysokoscPrzesylki).toBe(159);
    });
  });

  describe("2. Nieobecność: natychmiastowe wstrzymanie (#104) i dowody wycofania (#103)", () => {
    /** Kompletna oferta dostawcy, w której NIE MA naszego produktu. */
    const meta = (rawCount = 1) => ({
      complete: true,
      parserErrors: 0,
      source: "supplier file",
      rawCount,
      excludedCodes: [] as string[],
    });
    const obcaPozycja = (stan = 3) =>
      rekord({ kod: "INNY", ean: "", nazwa: "Opona 420/85R30 BKT AGRIMAX RT 855", model: "AGRIMAX RT 855", rozmiar: "420/85R30", stan });

    const importBezProduktu = (opcje: Record<string, unknown> = {}, stan = 3) =>
      uruchom(DOSTAWCA, [obcaPozycja(stan)], { meta: meta(), ...opcje });

    it("brak w KOMPLETNEJ ofercie wstrzymuje produkt natychmiast i zeruje stan", () => {
      const id = zasiejProdukt(baza.db, { nieobecnoscPodRzad: 0 });

      importBezProduktu();

      const p = produkt(id);
      expect(p.status, "produkt znika z oferty → nikt nie może go kupić").toBe("wstrzymany");
      expect(p.stan).toBe(0);
      // ⚠ To NIE jest licznik przebiegów — wstrzymanie następuje przy PIERWSZYM braku.
      expect(p.nieobecnoscPodRzad).toBe(0);
    });

    it("oferta NIEKOMPLETNA nie rusza produktu i mówi wprost dlaczego", () => {
      const id = zasiejProdukt(baza.db, { nieobecnoscPodRzad: 0 });

      const statystyki = uruchom(DOSTAWCA, [obcaPozycja()], {});

      expect(produkt(id).status, "bez potwierdzonej kompletności nie wolno wstrzymywać").toBe(
        "aktywny",
      );
      expect(produkt(id).stan).toBe(4);
      expect(statystyki.pominieteWycofania).toBe(
        "Niepotwierdzona kompletność źródła; braków nie zliczono",
      );
    });

    it("wstrzymanie NIE kasuje produktu — decyzję podejmuje człowiek", () => {
      const id = zasiejProdukt(baza.db, {});

      importBezProduktu();

      expect(produkt(id), "produkt ma zostać w katalogu").toBeDefined();
    });

    it("ta sama oferta drugi raz nie liczy się jako kolejne potwierdzenie", () => {
      zasiejProdukt(baza.db, {});

      importBezProduktu({}, 3);
      importBezProduktu({}, 3); // identyczny plik → ten sam odcisk

      const wersje = baza.sqlite
        .prepare("SELECT COUNT(*) AS n FROM supplier_feed_versions")
        .get() as { n: number };
      expect(wersje.n, "powtórka tego samego pliku to JEDNA wersja oferty").toBe(1);
    });

    /**
     * ⚠ ŚCIEŻKA DOWODOWA CHODZI TYLKO W PRZEBIEGU WERYFIKACYJNYM.
     *
     * W zwykłym imporcie `importer()` wychodzi z pętli nieobecnych wcześniej
     * (`if (complete && !reconcileOnly) continue;`, `staging_policy.cjs:597`) — bo produkt
     * został już WSTRZYMANY i nie ma po co go dodatkowo „wycofywać". Dowody zbiera dopiero
     * przebieg z `reconcileOnly` + `verifyAbsence`, czyli kontrola, która nie rusza katalogu.
     *
     * Dlatego `wycofana` nie pojawia się w zwykłym imporcie — i dlatego nie ma go też
     * we wzorcach charakteryzacji.
     */
    it("trzy RÓŻNE kompletne oferty w odstępie doby → dopiero wtedy wiersz `wycofana`", () => {
      // ⚠ `kodDostawcy` jest tu KONIECZNY. Karta, której kod nie zaczyna się od prefiksu
      // dostawcy ANI nie ma kodu dostawcy, trafia wcześniej w gałąź „stara karta z dawnego
      // importu" (`staging_policy.cjs:586`) — silnik nie potrafi orzec jej braku po samym
      // oznaczeniu i oddaje sprawę człowiekowi, zamiast zbierać dowody. W produkcji kody są
      // prefiksowane (`MO5_…`), więc ta gałąź dotyczy tylko kart sprzed ujednolicenia.
      zasiejProdukt(baza.db, { kodDostawcy: "P1-DOST" });
      const przesunZegarOferty = () =>
        baza.sqlite
          .prepare("UPDATE supplier_feed_state SET last_counted_at = ? WHERE supplier = ?")
          .run(new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(), DOSTAWCA);

      const dowody = () =>
        JSON.parse(
          (
            (baza.sqlite
              .prepare("SELECT checks_json FROM product_absence_checks WHERE product_code = 'P1'")
              .get() as { checks_json?: string } | undefined)?.checks_json
          ) ?? "[]",
        ) as unknown[];
      const wycofania = () => staging().filter((w) => w.typZmiany === "wycofana");

      const pierwszy = importBezProduktu({ reconcileOnly: true, verifyAbsence: true }, 3);
      expect(pierwszy.wycofane, "jedna oferta to za mało").toBe(0);
      expect(dowody()).toHaveLength(1);
      expect(wycofania()).toHaveLength(0);
      przesunZegarOferty();

      const drugi = importBezProduktu({ reconcileOnly: true, verifyAbsence: true }, 4);
      expect(drugi.wycofane, "dwie oferty to nadal za mało — to jest granica").toBe(0);
      expect(dowody()).toHaveLength(2);
      expect(wycofania()).toHaveLength(0);
      przesunZegarOferty();

      const trzeci = importBezProduktu({ reconcileOnly: true, verifyAbsence: true }, 5);
      expect(trzeci.wycofane, "dopiero TRZECIA różna kompletna oferta wycofuje").toBe(1);
      expect(dowody()).toHaveLength(3);

      const wycofane = wycofania();
      expect(wycofane).toHaveLength(1);
      expect(wycofane[0]!.kod).toBe("P1");
      expect(wycofane[0]!.powod).toBe(
        "Brak w trzech różnych, kompletnych cennikach — sprawdź przed wstrzymaniem",
      );
      expect(wycofane[0]!.stanNowy).toBe(0);
      expect(wycofane[0]!.cenaZakupuNowa).toBeNull();
      // Dowody jadą w snapshocie, żeby człowiek widział, NA CZYM oparto wycofanie.
      const snap = JSON.parse(String(wycofane[0]!.snapshotJson)) as {
        _withdrawal: boolean;
        _absenceEvidence: unknown[];
      };
      expect(snap._withdrawal).toBe(true);
      expect(snap._absenceEvidence).toHaveLength(3);
    });

    it("przebieg weryfikacyjny NIE rusza katalogu", () => {
      const id = zasiejProdukt(baza.db, {});

      importBezProduktu({ reconcileOnly: true, verifyAbsence: true });

      const p = produkt(id);
      expect(p.status, "kontrola nie wstrzymuje — od tego jest zwykły import").toBe("aktywny");
      expect(p.stan).toBe(4);
    });
  });

  describe("3. Precedencja poprawek Marty — import NIE nadpisuje ręcznej wartości", () => {
    const dodajPoprawke = (pola: Record<string, unknown>) =>
      baza.db
        .insert(manualOverrides)
        .values({
          supplierKod: DOSTAWCA,
          supplierProductId: "P1",
          fieldName: "model",
          overrideValue: "MODEL OD MARTY",
          createdAt: "2026-01-01T00:00:00.000Z",
          ...pola,
        } as typeof manualOverrides.$inferInsert)
        .run();

    /**
     * ⚠⚠ ZMIANA ZACHOWANIA I15.4b — najważniejsza w tym pliku.
     *
     * Stary `tk()` meldował konflikt: wiersz szedł do stagingu jako `blad` z ostrzeżeniem
     * „plik nadpisuje poprawke Marty: model" i z wartością z pliku w `snapshotJson._srcConflict`.
     *
     * `staging_policy` nakłada poprawki CICHO — `protect()` (`staging_policy.cjs:158-162`) to
     * trzy linijki, które podmieniają pole i nic nie raportują. Skutek: plik dostawcy sprzeczny
     * z ręczną decyzją Marty NIE jest już nigdzie sygnalizowany. Sama reguła nadrzędna zostaje
     * — wartość Marty wygrywa — ale człowiek nie dowie się, że dostawca chciał czegoś innego.
     *
     * To jest ODSTĘPSTWO PRODUKCJI, nie nasze: odtwarzamy je wiernie i zgłaszamy
     * w „Do koordynatora" karty I15.4b jako rzecz do decyzji Ani.
     */
    it("plik przynosi inny model → wygrywa Marta, ale konflikt NIE jest już zgłaszany", () => {
      const id = zasiejProdukt(baza.db, { model: "MODEL OD MARTY" });
      dodajPoprawke({});

      const statystyki = uruchom(DOSTAWCA, [rekord({ model: "MODEL Z PLIKU" })]);

      // ⭐ SEDNO REGUŁY, NIETKNIĘTE: wartość w katalogu się NIE zmieniła.
      expect(produkt(id).model).toBe("MODEL OD MARTY");

      // ⚠ …ale pozycja nie trafia już do człowieka. Po nałożeniu poprawki pozycja jest
      // IDENTYCZNA z kartą, więc silnik widzi „brak zmian" i nie ma o czym meldować.
      expect(statystyki.bezZmian, "pozycja wygląda jak niezmieniona").toBe(1);
      expect(staging(), "żadnego zgłoszenia — konflikt przepada po cichu").toHaveLength(0);
    });

    it("konflikt już potwierdzony (acknowledgedSourceValue) NIE alarmuje ponownie", () => {
      const id = zasiejProdukt(baza.db, { model: "MODEL OD MARTY", cenaZakupu: 1000 });
      dodajPoprawke({ acknowledgedSourceValue: "MODEL Z PLIKU" });

      const statystyki = uruchom(DOSTAWCA, [
        rekord({ model: "MODEL Z PLIKU", cenaZakupu: 1234.5 }),
      ]);

      // Brak alarmu → zmiana ceny znów może przejść bez pytania…
      expect(statystyki.autoZatwierdzone).toBe(1);
      expect(staging()).toHaveLength(0);
      expect(produkt(id).cenaZakupu).toBe(1234.5);
      // …ale poprawka Marty NADAL wygrywa z plikiem.
      expect(produkt(id).model).toBe("MODEL OD MARTY");
    });

    /**
     * ⚠ ZMIANA ZACHOWANIA I15.4b — bezpośrednia konsekwencja cichego `protect()`.
     *
     * Stary `tk()` traktował naruszenie poprawki jako otwarty konflikt i BLOKOWAŁ
     * auto-zatwierdzenie, nawet gdy jedyną realną zmianą była cena. `staging_policy` nie widzi
     * już żadnego konfliktu, więc cena wchodzi bez pytania — a model dalej broni się sam.
     */
    it("naruszenie poprawki NIE blokuje już auto-zatwierdzenia zmiany ceny", () => {
      const id = zasiejProdukt(baza.db, { model: "MODEL OD MARTY", cenaZakupu: 1000 });
      dodajPoprawke({});

      const statystyki = uruchom(DOSTAWCA, [
        rekord({ model: "MODEL Z PLIKU", cenaZakupu: 1234.5 }),
      ]);

      expect(statystyki.autoZatwierdzone).toBe(1);
      expect(produkt(id).cenaZakupu, "cena wchodzi bez pytania").toBe(1234.5);
      expect(produkt(id).model, "poprawka Marty dalej wygrywa z plikiem").toBe("MODEL OD MARTY");
      expect(staging()).toHaveLength(0);
    });

    it("poprawka bez konfliktu nakłada się bezgłośnie", () => {
      zasiejProdukt(baza.db, { model: "MODEL OD MARTY" });
      dodajPoprawke({});

      const statystyki = uruchom(DOSTAWCA, [rekord({ model: "MODEL OD MARTY" })]);

      expect(statystyki.bezZmian).toBe(1);
      expect(staging()).toHaveLength(0);
    });
  });

  describe("4. Bezpiecznik pustego wejścia (odstępstwo D7)", () => {
    /**
     * Produkcja puszcza pusty wsad prosto do `tk()`, co po trzech przebiegach wycofuje CAŁY
     * katalog dostawcy (backlog #8). Do 3d-1 ten bezpiecznik był teoretyczny — dopiero ta
     * sesja uruchamia pętlę wycofań, więc dopiero teraz da się pokazać, przed czym chroni.
     */
    it("pusta tablica: wyjątek, zero wierszy stagingu i licznik nieobecności NIETKNIĘTY", () => {
      const id = zasiejProdukt(baza.db, { nieobecnoscPodRzad: 2 });

      expect(() => uruchom(DOSTAWCA, [])).toThrow(PustyImportBlad);

      expect(staging(), "pusty import nie może dotknąć stagingu").toHaveLength(0);
      expect(
        produkt(id).nieobecnoscPodRzad,
        "gdyby nie bezpiecznik, ten produkt zostałby TERAZ wycofany",
      ).toBe(2);
      expect(baza.db.select().from(historiaCen).all()).toHaveLength(0);
    });
  });
});
