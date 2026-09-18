/**
 * Wygaszacz statusu promocji — karta 14f, backlog #19.
 *
 * ⚠ DLACZEGO TEN PLIK JEST WARUNKIEM, A NIE DODATKIEM. Wariant (b) („zmieniamy dane, nie
 * silnik") jest tani właśnie dlatego, że charakteryzacja importu go NIE WIDZI — a to znaczy,
 * że najmocniejsza siatka w tym projekcie nie powie ani słowa, gdy wygaszacz się zepsuje.
 * Ta jawna słabość wariantu była wyceniona w 14e i przyjęta pod warunkiem własnych testów.
 * Stąd tutaj: granice `statusZDat`, OBA kierunki zamiatania, idempotencja i guard na to,
 * żeby timer nie wszedł do fabryki aplikacji.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { promotions } from "../src/db/schema.js";
import {
  DOMYSLNY_INTERWAL_MINUT,
  statusZDat,
  stworzWygaszacz,
  zamiecStatusyPromocji,
} from "../src/promocje/wygaszacz.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";

const DZIEN_MS = 86_400_000;
const dzienISO = (przesuniecieDni: number): string =>
  new Date(Date.now() + przesuniecieDni * DZIEN_MS).toISOString().slice(0, 10);

describe("Wygaszacz statusu promocji (14f)", () => {
  let baza: TestowaBaza;

  beforeEach(() => {
    baza = stworzTestowaBaze();
  });

  afterEach(() => baza.posprzataj());

  /** Wstawia promocję i oddaje jej `id`. */
  function zasiejPromocje(dane: { start: string; koniec: string; status: string }): number {
    const wiersz = baza.db
      .insert(promotions)
      .values({
        nazwa: "Testowa",
        rabatPct: 10,
        zasieg: "BKT",
        warunki: null,
        priorytet: 50,
        ...dane,
      })
      .returning()
      .get();
    return wiersz.id;
  }

  const statusPoId = (id: number) =>
    baza.db.select().from(promotions).all().find((p) => p.id === id)!.status;

  describe("1. `statusZDat` — port 1:1 z frontendu", () => {
    it("przed startem ⇒ `zaplanowana`", () => {
      expect(statusZDat("2026-06-01", "2026-06-30", Date.parse("2026-05-31T12:00:00Z"))).toBe(
        "zaplanowana",
      );
    });

    it("między datami ⇒ `aktywna`", () => {
      expect(statusZDat("2026-06-01", "2026-06-30", Date.parse("2026-06-15T12:00:00Z"))).toBe(
        "aktywna",
      );
    });

    it("po końcu ⇒ `zakonczona`", () => {
      expect(statusZDat("2026-06-01", "2026-06-30", Date.parse("2026-07-01T12:00:00Z"))).toBe(
        "zakonczona",
      );
    });

    /**
     * ⚠ NAPISY BEZ POLSKICH ZNAKÓW — to wartości kolumny `status`, nie etykiety. Gdyby ktoś
     * „poprawił" je na `zakończona`, silnik cen przestałby rozpoznawać stan, a lista
     * pokazywałaby coś innego niż baza. Asercja jest dosłowna właśnie po to.
     */
    it("⚠ zwraca napisy BEZ ogonków: `zaplanowana` / `zakonczona`", () => {
      expect(statusZDat("2099-01-01", "2099-12-31", Date.now())).toBe("zaplanowana");
      expect(statusZDat("2020-01-01", "2020-12-31", Date.now())).toBe("zakonczona");
    });

    /**
     * ⚠ DZIWACTWO PARSOWANIA ODTWARZANE 1:1: `new Date("2026-06-30")` to północ UTC, więc
     * dzień końca jest „już po końcu" od swojej własnej północy, a nie od 23:59. Tak liczy
     * front (`pages/narzuty/status.ts`) i tak musi liczyć backend — inaczej etykieta na liście
     * i kolumna `status` znów by się rozjechały, czyli wrócił defekt, który ta karta usuwa.
     */
    it("⚠ granica jest północą UTC, nie końcem dnia lokalnego", () => {
      expect(statusZDat("2026-06-01", "2026-06-30", Date.parse("2026-06-30T00:00:00Z"))).toBe(
        "aktywna",
      );
      expect(statusZDat("2026-06-01", "2026-06-30", Date.parse("2026-06-30T00:00:01Z"))).toBe(
        "zakonczona",
      );
    });

    it("dokładnie w chwili startu ⇒ już `aktywna`, nie `zaplanowana`", () => {
      expect(statusZDat("2026-06-01", "2026-06-30", Date.parse("2026-06-01T00:00:00Z"))).toBe(
        "aktywna",
      );
    });

    /** Data nieparsowalna daje `NaN`; oba porównania są fałszywe, więc wynik to `aktywna`. */
    it("data nieparsowalna ⇒ `aktywna` (zachowanie frontu)", () => {
      expect(statusZDat("", "", Date.now())).toBe("aktywna");
    });

    it("zgadza się z portem frontendu znak w znak", () => {
      // Ten sam plik, ta sama reguła — gdyby któraś strona odjechała, to się tu zapali.
      const zrodloFE = readFileSync(
        join(import.meta.dirname, "..", "..", "frontend", "src", "pages", "narzuty", "status.ts"),
        "utf8",
      );
      expect(zrodloFE).toContain('return "zaplanowana"');
      expect(zrodloFE).toContain('return "zakonczona"');
    });
  });

  describe("2. Zamiatanie działa w OBIE strony", () => {
    it("wygasła `aktywna` ⇒ `zakonczona` (defekt #19)", () => {
      const id = zasiejPromocje({ start: dzienISO(-30), koniec: dzienISO(-1), status: "aktywna" });

      expect(zamiecStatusyPromocji(baza.db)).toBe(1);
      expect(statusPoId(id)).toBe("zakonczona");
    });

    /**
     * ⚠ DRUGI KIERUNEK — defekt ODWROTNY, znaleziony w 14e i nigdzie wcześniej nieopisany.
     * Skoro do 14f nic nie przeliczało statusu, promocja „zaplanowana" zostawała zaplanowana
     * NA ZAWSZE. Bez tej asercji karta naprawiłaby wygaszanie i zostawiła martwe planowanie.
     */
    it("⚠ `zaplanowana` z nadeszłym startem ⇒ `aktywna`", () => {
      const id = zasiejPromocje({
        start: dzienISO(-1),
        koniec: dzienISO(30),
        status: "zaplanowana",
      });

      expect(zamiecStatusyPromocji(baza.db)).toBe(1);
      expect(statusPoId(id)).toBe("aktywna");
    });

    it("promocja jeszcze nierozpoczęta ⇒ `zaplanowana`", () => {
      const id = zasiejPromocje({ start: dzienISO(7), koniec: dzienISO(14), status: "aktywna" });

      expect(zamiecStatusyPromocji(baza.db)).toBe(1);
      expect(statusPoId(id)).toBe("zaplanowana");
    });

    it("przestawia kilka promocji w jednym przebiegu, każdą wg WŁASNYCH dat", () => {
      const wygasla = zasiejPromocje({
        start: dzienISO(-30),
        koniec: dzienISO(-1),
        status: "aktywna",
      });
      const trwajaca = zasiejPromocje({
        start: dzienISO(-1),
        koniec: dzienISO(1),
        status: "zaplanowana",
      });
      const przyszla = zasiejPromocje({
        start: dzienISO(10),
        koniec: dzienISO(20),
        status: "aktywna",
      });

      expect(zamiecStatusyPromocji(baza.db)).toBe(3);
      expect(statusPoId(wygasla)).toBe("zakonczona");
      expect(statusPoId(trwajaca)).toBe("aktywna");
      expect(statusPoId(przyszla)).toBe("zaplanowana");
    });

    it("przyjmuje `teraz` z zewnątrz — ta sama promocja, trzy chwile", () => {
      const id = zasiejPromocje({ start: "2026-06-01", koniec: "2026-06-30", status: "aktywna" });

      zamiecStatusyPromocji(baza.db, Date.parse("2026-05-01T12:00:00Z"));
      expect(statusPoId(id)).toBe("zaplanowana");

      zamiecStatusyPromocji(baza.db, Date.parse("2026-06-15T12:00:00Z"));
      expect(statusPoId(id)).toBe("aktywna");

      zamiecStatusyPromocji(baza.db, Date.parse("2026-07-15T12:00:00Z"));
      expect(statusPoId(id)).toBe("zakonczona");
    });
  });

  describe("3. Idempotencja i brak zbędnych zapisów", () => {
    it("drugi przebieg nie zmienia już nic", () => {
      zasiejPromocje({ start: dzienISO(-30), koniec: dzienISO(-1), status: "aktywna" });

      expect(zamiecStatusyPromocji(baza.db)).toBe(1);
      expect(zamiecStatusyPromocji(baza.db)).toBe(0);
    });

    it("promocja o statusie zgodnym z datami zostaje NIETKNIĘTA", () => {
      const id = zasiejPromocje({ start: dzienISO(-1), koniec: dzienISO(1), status: "aktywna" });

      expect(zamiecStatusyPromocji(baza.db)).toBe(0);
      expect(statusPoId(id)).toBe("aktywna");
    });

    it("pusta tabela promocji ⇒ 0 zmian, bez wyjątku", () => {
      expect(zamiecStatusyPromocji(baza.db)).toBe(0);
    });

    it("nie rusza innych kolumn promocji", () => {
      const id = zasiejPromocje({ start: dzienISO(-30), koniec: dzienISO(-1), status: "aktywna" });
      const przed = baza.db.select().from(promotions).all().find((p) => p.id === id)!;

      zamiecStatusyPromocji(baza.db);
      const po = baza.db.select().from(promotions).all().find((p) => p.id === id)!;

      expect({ ...po, status: przed.status }).toEqual(przed);
    });
  });

  describe("4. Automat — kształt 1:1 ze schedulerem", () => {
    it("sam obiekt jest BEZCZYNNY, dopóki nikt nie zawoła `uruchom()`", () => {
      const id = zasiejPromocje({ start: dzienISO(-30), koniec: dzienISO(-1), status: "aktywna" });
      const wygaszacz = stworzWygaszacz({ db: baza.db, interwalMs: 60_000 });

      expect(wygaszacz.czyDziala()).toBe(false);
      // Nic nie zamiecione — to jest gwarancja, na której stoi niewidzialność dla testów.
      expect(statusPoId(id)).toBe("aktywna");

      wygaszacz.zatrzymaj();
    });

    it("`uruchom()` zamiata NATYCHMIAST (postój procesu) i stawia cykl", () => {
      const id = zasiejPromocje({ start: dzienISO(-30), koniec: dzienISO(-1), status: "aktywna" });
      const wygaszacz = stworzWygaszacz({ db: baza.db, interwalMs: 60_000 });

      expect(wygaszacz.uruchom()).toBe(1);
      expect(statusPoId(id)).toBe("zakonczona");
      expect(wygaszacz.czyDziala()).toBe(true);

      wygaszacz.zatrzymaj();
      expect(wygaszacz.czyDziala()).toBe(false);
    });

    it("`interwalMs = 0` ⇒ zamiata raz, ale NIE stawia timera", () => {
      const id = zasiejPromocje({ start: dzienISO(-30), koniec: dzienISO(-1), status: "aktywna" });
      const wygaszacz = stworzWygaszacz({ db: baza.db, interwalMs: 0 });

      expect(wygaszacz.uruchom()).toBe(1);
      expect(statusPoId(id)).toBe("zakonczona");
      expect(wygaszacz.czyDziala()).toBe(false);
    });

    it("cykl faktycznie zamiata po upływie interwału", async () => {
      const wygaszacz = stworzWygaszacz({ db: baza.db, interwalMs: 10 });
      wygaszacz.uruchom();

      // Promocja wygasła DOPIERO PO starcie automatu — łapie ją wyłącznie cykl.
      const id = zasiejPromocje({ start: dzienISO(-30), koniec: dzienISO(-1), status: "aktywna" });
      expect(statusPoId(id)).toBe("aktywna");

      await new Promise((r) => setTimeout(r, 60));
      expect(statusPoId(id)).toBe("zakonczona");

      wygaszacz.zatrzymaj();
    });

    it("`zatrzymaj()` naprawdę gasi cykl", async () => {
      const wygaszacz = stworzWygaszacz({ db: baza.db, interwalMs: 10 });
      wygaszacz.uruchom();
      wygaszacz.zatrzymaj();

      const id = zasiejPromocje({ start: dzienISO(-30), koniec: dzienISO(-1), status: "aktywna" });
      await new Promise((r) => setTimeout(r, 60));

      expect(statusPoId(id)).toBe("aktywna");
    });

    it("domyślny interwał to 5 minut — krócej niż 60-minutowy odstęp importów", () => {
      // Kryterium karty 14f: okno, w którym wygasła promocja jeszcze obniża cenę przy
      // imporcie, musi być KRÓTSZE niż odstęp między importami (produkcja: co 60 min).
      expect(DOMYSLNY_INTERWAL_MINUT).toBeLessThan(60);
      expect(DOMYSLNY_INTERWAL_MINUT).toBe(5);
    });
  });

  describe("5. GATE — wygaszacz NIE wchodzi tam, gdzie zepsułby charakteryzację", () => {
    const zrodlo = (...czesci: string[]) =>
      readFileSync(join(import.meta.dirname, "..", "src", ...czesci), "utf8");

    /**
     * ⚠ TO JEST NAJWAŻNIEJSZY TEST W TYM PLIKU. Cała oszczędność wariantu (b) stoi na tym, że
     * timery mieszkają w `server.ts`, a cała suita — w tym harness charakteryzacji — buduje
     * aplikację przez `stworzApp`. Timer w fabryce aplikacji wszedłby do KAŻDEGO scenariusza.
     * Istniejący `scheduler.test.ts` sprawdza już brak `setInterval` w `app.ts`; tutaj
     * dokładamy asercję na nazwę, żeby intencja była jawna, a nie przypadkowa.
     */
    it("`app.ts` nie uruchamia wygaszacza — timery zostają w `server.ts`", () => {
      const app = zrodlo("app.ts");
      expect(app).not.toContain("stworzWygaszacz");
      expect(app).not.toContain("setInterval");
    });

    it("`server.ts` uruchamia wygaszacz i sprząta go przy zamknięciu", () => {
      const server = zrodlo("server.ts");
      expect(server).toContain("stworzWygaszacz");
      expect(server).toContain("wygaszacz.uruchom()");
      expect(server).toContain("wygaszacz.zatrzymaj()");
    });

    /**
     * ⚠ ŚCIEŻKA IMPORTU MUSI ZOSTAĆ CZYSTA. `zastosujRegulyCenowe` leży w `acceptStaging`
     * i `addProductsBulk`, czyli dokładnie tam, gdzie porównuje nas charakteryzacja.
     * Zamiatanie w tej funkcji rozjechałoby DWIE tabele naraz (`products` i `promotions`) —
     * drożej niż odrzucony wariant (a). Zamiatamy WYŁĄCZNIE w `przeliczCenyZRegul`.
     */
    it("⚠ zamiatanie jest w `przeliczCenyZRegul`, a NIE w `zastosujRegulyCenowe`", () => {
      const ceny = zrodlo("repos", "ceny.ts");

      const odPrzelicz = ceny.indexOf("export function przeliczCenyZRegul");
      const odZastosuj = ceny.indexOf("export function zastosujRegulyCenowe");
      expect(odPrzelicz).toBeGreaterThan(-1);
      expect(odZastosuj).toBeGreaterThan(-1);

      // Ciało `zastosujRegulyCenowe` kończy się tam, gdzie zaczyna się następna deklaracja.
      const koniecZastosuj = ceny.indexOf("export type WynikPrzeliczenia", odZastosuj);
      const cialoZastosuj = ceny.slice(odZastosuj, koniecZastosuj);
      expect(cialoZastosuj).not.toContain("zamiecStatusyPromocji");

      const cialoPrzelicz = ceny.slice(odPrzelicz);
      expect(cialoPrzelicz).toContain("zamiecStatusyPromocji");
    });

    /**
     * Silnik ma dalej NIE czytać dat — o tym decyduje wariant (b). Gdyby ktoś dołożył warunek
     * na `start`/`koniec` do `promocjaPasuje`, byłby to odrzucony wariant (a) i wyrocznia
     * charakteryzacji wymagałaby wyjątku.
     */
    it("⚠ `promocjaPasuje` nadal nie czyta dat (wariant (a) pozostaje odrzucony)", () => {
      const ceny = zrodlo("repos", "ceny.ts");
      const od = ceny.indexOf("export function promocjaPasuje");
      const cialo = ceny.slice(od, ceny.indexOf("export function wybierzNarzut", od));

      expect(cialo).not.toContain("promocja.start");
      expect(cialo).not.toContain("promocja.koniec");
    });
  });
});
