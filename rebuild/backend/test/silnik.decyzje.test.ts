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
 *   2. Produkt wycofuje się po TRZECIEJ nieobecności pod rząd — nie drugiej, nie czwartej.
 *   3. Ręczna poprawka Marty WYGRYWA z plikiem dostawcy. Zawsze.
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

  describe("2. Wycofanie — po TRZECIEJ nieobecności, nie wcześniej i nie później", () => {
    /** Import cennika, w którym nie ma naszego produktu. */
    const importBezProduktu = () => uruchom(DOSTAWCA, [rekord({ kod: "INNY", ean: "" })]);

    it("trzy kolejne przebiegi: licznik 1 → 2 → wycofanie, i dopiero wtedy wiersz `wycofana`", () => {
      const id = zasiejProdukt(baza.db, { nieobecnoscPodRzad: 0 });

      const pierwszy = importBezProduktu();
      expect(pierwszy.wycofane, "po PIERWSZEJ nieobecności nic się nie wycofuje").toBe(0);
      expect(produkt(id).nieobecnoscPodRzad).toBe(1);
      expect(staging().filter((w) => w.typZmiany === "wycofana")).toHaveLength(0);

      const drugi = importBezProduktu();
      expect(drugi.wycofane, "po DRUGIEJ nieobecności nadal nic — to jest granica").toBe(0);
      expect(produkt(id).nieobecnoscPodRzad).toBe(2);
      expect(staging().filter((w) => w.typZmiany === "wycofana")).toHaveLength(0);

      const trzeci = importBezProduktu();
      expect(trzeci.wycofane, "dopiero TRZECIA nieobecność wycofuje").toBe(1);
      const wycofane = staging().filter((w) => w.typZmiany === "wycofana");
      expect(wycofane).toHaveLength(1);
      expect(wycofane[0]!.kod).toBe("P1");
      expect(wycofane[0]!.powod).toBe("Brak w cenniku — pozycja wycofana");
      expect(wycofane[0]!.stanNowy).toBe(0);
      expect(wycofane[0]!.cenaZakupuNowa).toBeNull();
      expect(wycofane[0]!.snapshotJson).toBeNull();
    });

    it("po wycofaniu licznik wraca do ZERA — cykl liczy się od nowa", () => {
      const id = zasiejProdukt(baza.db, { nieobecnoscPodRzad: 2 });

      importBezProduktu();

      expect(produkt(id).nieobecnoscPodRzad).toBe(0);
    });

    it("wycofanie NIE kasuje produktu — decyzję podejmuje człowiek na stagingu", () => {
      const id = zasiejProdukt(baza.db, { nieobecnoscPodRzad: 2 });

      importBezProduktu();

      expect(produkt(id), "produkt ma zostać w katalogu").toBeDefined();
      expect(produkt(id).status).toBe("aktywny");
    });

    it("liczą się nieobecności POD RZĄD — dopasowanie w międzyczasie zeruje licznik", () => {
      const id = zasiejProdukt(baza.db, { nieobecnoscPodRzad: 2 });

      // Produkt JEST w tym cenniku → licznik zeruje się w pętli głównej.
      uruchom(DOSTAWCA, [rekord({})]);
      expect(produkt(id).nieobecnoscPodRzad).toBe(0);

      // …więc kolejna nieobecność zaczyna liczenie od jedynki, a nie od trzeciej.
      const statystyki = importBezProduktu();
      expect(statystyki.wycofane).toBe(0);
      expect(produkt(id).nieobecnoscPodRzad).toBe(1);
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

    it("plik przynosi inny model → wygrywa Marta, a konflikt jest zgłoszony", () => {
      const id = zasiejProdukt(baza.db, { model: "MODEL OD MARTY" });
      dodajPoprawke({});

      const statystyki = uruchom(DOSTAWCA, [rekord({ model: "MODEL Z PLIKU" })]);

      // Pozycja idzie do człowieka jako `blad` — nie wolno jej przepuścić po cichu.
      expect(statystyki.autoZatwierdzone).toBe(0);
      const wiersz = staging()[0]!;
      expect(wiersz.typZmiany).toBe("blad");
      expect(wiersz.ostrzezenie).toContain("plik nadpisuje poprawke Marty: model");
      expect(wiersz.powod).toContain("ZOSTANIE ZACHOWANA wartosc Marty");

      // ⭐ SEDNO REGUŁY: wartość w katalogu się NIE zmieniła.
      expect(produkt(id).model).toBe("MODEL OD MARTY");

      // Wartość z pliku jest zachowana w snapshocie — to z niej 3d-2 zrobi `acknowledged`.
      const snapshot = JSON.parse(String(wiersz.snapshotJson)) as {
        model: string;
        _srcConflict: Record<string, string>;
      };
      expect(snapshot.model, "snapshot niesie wartość MARTY, nie z pliku").toBe("MODEL OD MARTY");
      expect(snapshot._srcConflict).toEqual({ model: "MODEL Z PLIKU" });
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

    it("naruszenie poprawki BLOKUJE auto-zatwierdzenie nawet czystej zmiany ceny", () => {
      const id = zasiejProdukt(baza.db, { model: "MODEL OD MARTY", cenaZakupu: 1000 });
      dodajPoprawke({});

      const statystyki = uruchom(DOSTAWCA, [
        rekord({ model: "MODEL Z PLIKU", cenaZakupu: 1234.5 }),
      ]);

      expect(statystyki.autoZatwierdzone).toBe(0);
      expect(produkt(id).cenaZakupu, "cena nie może wejść po cichu przy otwartym konflikcie").toBe(
        1000,
      );
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
