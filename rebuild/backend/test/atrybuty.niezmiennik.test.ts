/**
 * NIEZMIENNIK KOLEJKI ATRYBUTÓW — „liczba w ostrzeżeniu = liczba realnie przepisanych produktów".
 *
 * Karta P7.3 (`docs/tickets/75-CHORE-niezmiennik-atrybutow/`). Dwie akcje kolejki — „Akceptuj
 * z edycją" i „Akceptuj jako alias" — jednym kliknięciem przepisują pole w setkach produktów,
 * bez audytu i bez cofania. Przed kliknięciem dialog pokazuje ostrzeżenie „przepisze pole X
 * w N produktach". Ten plik pilnuje, że N to prawda. Trzy liczby dla pozycji (rodzaj, wartosc):
 *
 *   A — `ile_wystapien` z SKANU (kolumna listy kolejki; fallback ostrzeżenia, zanim przyjdzie B),
 *   B — `count` z `GET /api/atrybuty/uzycie` (to, co ostrzeżenie pokazuje),
 *   C — `produktow_zaktualizowano` z akcji (`changes` z UPDATE).
 *
 * Każda asercja porównuje je z NIEZALEŻNYM przeliczeniem w SQL na tej samej bazie — ile wierszy
 * po akcji ma nową wartość, a ile nadal starą. Liczba z trasy nie jest tu dowodem sama dla siebie.
 *
 * Niezmiennik główny: **B == C == realna zmiana**. Trzyma się z konstrukcji — `uzycie` i UPDATE
 * mają ten sam predykat `WHERE <kol> = wartosc` (`atrybuty_module.cjs:296`, `pending_module.cjs:289`
 * i `:331`). Pomiar na kopii `db/snapshot.db`: 0 rozjazdów B≠C na 4148 pomiarach.
 *
 * Niezmiennik pomocniczy **A == C** trzyma się TYLKO tuż po skanie i tylko wtedy, gdy predykat
 * skanu (`pending_module.cjs:84-93`) pokrywa się z predykatem UPDATE. Trzy znane wyjątki — MO6,
 * spacje na brzegach, migawka — są niżej zapisane jako ZACHOWANIE (1:1 z oryginałem), nie błąd.
 * Pomiar na snapshocie: A == C na wszystkich 3648 świeżych pozycjach, bo w danych produkcji nie ma
 * ani wierszy MO6, ani wartości ze spacją na brzegu — wyjątki są dziś uśpione, nie nieistniejące.
 *
 * Rodzaje i kolumny są wypisane tu JAWNIE, bez importu map z repozytoriów, a wszystko idzie przez
 * trasy HTTP — test sprawdza zachowanie, nie powtarza implementacji. Nic nie zakłada, że akcje
 * NIE piszą do `audit_log` (od P7.1, ticket 74, piszą).
 *
 * `model` i `zastosowanie` akceptacje obsługują od P7.1 (backlog #41), ale skan ich NIE
 * przegląda (`ZAKRES_SKANU`, celowo) — stąd osobna lista `RODZAJE_POZA_SKANEM`: pozycję kolejki
 * wstawiamy ręcznie, a sprawdzamy niezmiennik główny B == C == realna zmiana (A nie ma sensu,
 * bo nie pochodzi ze skanu).
 */
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { products } from "../src/db/schema.js";
import {
  stworzSrodowiskoTestowe,
  type SrodowiskoTestowe,
} from "./gate/index.js";
import { PRODUKTY_TESTOWE, type NowyProdukt } from "./gate/dane.js";

/**
 * 13 rodzajów kolejki: nazwa rodzaju → pole modelu (do zasiewu) i kolumna tabeli (do przeliczeń).
 * Wypisane jawnie (patrz nagłówek, P7.1). `marka` i `kategoria` są NOT NULL — do przypadków
 * NULL/pusty napis służy `bieznik`.
 */
const RODZAJE = [
  { rodzaj: "marka", pole: "marka", kolumna: "marka" },
  { rodzaj: "kategoria", pole: "kategoria", kolumna: "kategoria" },
  { rodzaj: "konstrukcja", pole: "konstrukcja", kolumna: "konstrukcja" },
  { rodzaj: "vfIf", pole: "vfIf", kolumna: "vf_if" },
  { rodzaj: "rodzaj", pole: "rodzaj", kolumna: "rodzaj" },
  { rodzaj: "sezon", pole: "sezon", kolumna: "sezon" },
  { rodzaj: "tl_tt", pole: "tlTt", kolumna: "tl_tt" },
  {
    rodzaj: "oznaczenie_bieznika",
    pole: "oznaczenieBieznika",
    kolumna: "oznaczenie_bieznika",
  },
  { rodzaj: "bieznik", pole: "bieznik", kolumna: "bieznik" },
  { rodzaj: "wentyl", pole: "wentyl", kolumna: "wentyl" },
  { rodzaj: "rozmiar", pole: "rozmiar", kolumna: "rozmiar" },
  {
    rodzaj: "indeks_nosnosci",
    pole: "indeksNosnosci",
    kolumna: "indeks_nosnosci",
  },
  {
    rodzaj: "indeks_predkosci",
    pole: "indeksPredkosci",
    kolumna: "indeks_predkosci",
  },
] as const satisfies readonly {
  rodzaj: string;
  pole: keyof NowyProdukt;
  kolumna: string;
}[];

/**
 * Rodzaje, które akceptacje obsługują, a skan pomija (backlog #41, ticket 74). Pozycja kolejki
 * takiego rodzaju nie powstaje ze skanu, więc testy wstawiają ją do tabeli ręcznie.
 */
const RODZAJE_POZA_SKANEM = [
  { rodzaj: "model", pole: "model", kolumna: "model" },
  { rodzaj: "zastosowanie", pole: "zastosowanie", kolumna: "zastosowanie" },
] as const satisfies readonly {
  rodzaj: string;
  pole: keyof NowyProdukt;
  kolumna: string;
}[];

type Rodzaj = (typeof RODZAJE)[number] | (typeof RODZAJE_POZA_SKANEM)[number];
const BIEZNIK = RODZAJE.find((r) => r.rodzaj === "bieznik")!;
const MARKA = RODZAJE.find((r) => r.rodzaj === "marka")!;

type Pozycja = {
  id: number;
  rodzaj: string;
  wartosc: string;
  ile_wystapien: number;
};
type WynikAkcji = { ok: boolean; produktow_zaktualizowano: number };

describe("atrybuty — niezmiennik „ostrzeżenie = liczba realnie przepisanych produktów”", () => {
  let srodowisko: SrodowiskoTestowe;
  let token: string;
  let licznikKodow = 0;

  beforeEach(async () => {
    srodowisko = await stworzSrodowiskoTestowe();
    const odp = await request(srodowisko.app)
      .post("/api/login")
      .send({ email: srodowisko.dane.email, password: srodowisko.dane.haslo });
    token = (odp.body as { token: string }).token;

    // Stan PRODUKCJI: w snapshocie `atrybuty_rodzaje` zna wszystkie 15 rodzajów, a świeża baza
    // tylko wbudowane z seedu. Bez tego „Akceptuj z edycją" dla pozostałych kończy się 500
    // (FK `atrybuty_wartosci.rodzaj` → `atrybuty_rodzaje`; follow-up w raporcie ticketa 75).
    for (const r of [...RODZAJE, ...RODZAJE_POZA_SKANEM]) {
      const rodzaj = await post("/api/atrybuty/rodzaje", {
        value: r.rodzaj,
        label: r.rodzaj,
      });
      expect([200, 409]).toContain(rodzaj.status);
    }
  });

  afterEach(() => srodowisko.posprzataj());

  const get = (sciezka: string, zapytanie?: Record<string, string>) =>
    request(srodowisko.app)
      .get(sciezka)
      .query(zapytanie ?? {})
      .set("Authorization", `Bearer ${token}`);
  const post = (sciezka: string, cialo?: object) =>
    request(srodowisko.app)
      .post(sciezka)
      .set("Authorization", `Bearer ${token}`)
      .send(cialo ?? {});

  /**
   * Produkty z zadaną wartością w kolumnie rodzaju. Reszta pól z produktu testowego — ich wartości
   * też trafią do kolejki, ale żadna asercja ich nie dotyczy. `kod` unikalny na każdy wiersz.
   */
  const dodajProdukty = (
    r: Rodzaj,
    wartosc: string | null,
    ile: number,
    dostawca = "MO1",
  ) => {
    const wiersze: NowyProdukt[] = Array.from({ length: ile }, () => ({
      ...PRODUKTY_TESTOWE[0]!,
      kod: `P73_${++licznikKodow}`,
      dostawca,
      ean: null,
      eanRaw: null,
      [r.pole]: wartosc,
    }));
    srodowisko.db.insert(products).values(wiersze).run();
  };

  /** Niezależne przeliczenie: ile wierszy ma DOKŁADNIE tę wartość (predykat binarny). */
  const ileZWartoscia = (r: Rodzaj, wartosc: string) =>
    (
      srodowisko.sqlite
        .prepare(`SELECT COUNT(*) AS c FROM products WHERE ${r.kolumna} = ?`)
        .get(wartosc) as { c: number }
    ).c;

  const skanuj = async () => {
    const odp = await post("/api/atrybuty/scan-pending");
    expect(odp.status).toBe(200);
    return odp.body as { nowych_wartosci: number; zaktualizowano: number };
  };

  const pozycje = async () => {
    const odp = await get("/api/atrybuty/pending");
    expect(odp.status).toBe(200);
    return (odp.body as { items: Pozycja[] }).items;
  };

  const pozycja = async (r: Rodzaj, wartosc: string) =>
    (await pozycje()).find(
      (p) => p.rodzaj === r.rodzaj && p.wartosc === wartosc,
    );

  /** B — to, co pokaże ostrzeżenie w dialogu. */
  const uzycie = async (r: Rodzaj, wartosc: string) => {
    const odp = await get("/api/atrybuty/uzycie", {
      rodzaj: r.rodzaj,
      wartosc,
    });
    expect(odp.status).toBe(200);
    return (odp.body as { count: number }).count;
  };

  const zEdycja = async (id: number, nowa: string) => {
    const odp = await post(`/api/atrybuty/pending/${id}/akceptuj-z-edycja`, {
      nowa_wartosc: nowa,
    });
    expect(odp.status).toBe(200);
    return (odp.body as WynikAkcji).produktow_zaktualizowano;
  };

  const jakoAlias = async (id: number, kanoniczna: string) => {
    const odp = await post(`/api/atrybuty/pending/${id}/akceptuj-jako-alias`, {
      kanoniczna_wartosc: kanoniczna,
    });
    expect(odp.status).toBe(200);
    return (odp.body as WynikAkcji).produktow_zaktualizowano;
  };

  /** Wartość do słownika — alias wymaga, żeby kanoniczna tam była. */
  const doSlownika = async (r: Rodzaj, wartosc: string) => {
    const odp = await post("/api/atrybuty/wartosci", {
      rodzaj: r.rodzaj,
      wartosc,
    });
    expect(odp.status).toBe(200);
  };

  // ———————————————————————————— niezmiennik główny ————————————————————————————

  describe("B == C == realna zmiana, tuż po skanie także A", () => {
    it.each(RODZAJE)("akceptuj-z-edycja: $rodzaj", async (r) => {
      const stara = `P73_STARA_${r.rodzaj}`;
      const nowa = `P73_NOWA_${r.rodzaj}`;
      dodajProdukty(r, stara, 3);
      dodajProdukty(r, `P73_INNA_${r.rodzaj}`, 2);
      await skanuj();

      const p = (await pozycja(r, stara))!;
      const B = await uzycie(r, stara);
      const C = await zEdycja(p.id, nowa);

      expect({ A: p.ile_wystapien, B, C }).toEqual({ A: 3, B: 3, C: 3 });
      expect(ileZWartoscia(r, nowa)).toBe(C);
      expect(ileZWartoscia(r, stara)).toBe(0);
      expect(ileZWartoscia(r, `P73_INNA_${r.rodzaj}`)).toBe(2);
    });

    it.each(RODZAJE)("akceptuj-jako-alias: $rodzaj", async (r) => {
      const stara = `P73_STARA_${r.rodzaj}`;
      const kanoniczna = `P73_KANON_${r.rodzaj}`;
      dodajProdukty(r, stara, 4);
      dodajProdukty(r, kanoniczna, 1);
      await doSlownika(r, kanoniczna);
      await skanuj();

      const p = (await pozycja(r, stara))!;
      const B = await uzycie(r, stara);
      const C = await jakoAlias(p.id, kanoniczna);

      expect({ A: p.ile_wystapien, B, C }).toEqual({ A: 4, B: 4, C: 4 });
      // Realna zmiana: kanoniczną ma teraz 1 + C wierszy, starej nie ma nikt.
      expect(ileZWartoscia(r, kanoniczna)).toBe(1 + C);
      expect(ileZWartoscia(r, stara)).toBe(0);
    });
  });

  describe("rodzaje poza zakresem skanu (#41): B == C == realna zmiana", () => {
    /** Pozycja kolejki wstawiona ręcznie — skan tych rodzajów nie przegląda (`ZAKRES_SKANU`). */
    const pozycjaRecznie = (r: Rodzaj, wartosc: string) =>
      Number(
        srodowisko.sqlite
          .prepare(
            `INSERT INTO atrybuty_wartosci_pending (rodzaj, wartosc, ile_wystapien, dostawcy)
             VALUES (?, ?, 1, '')`,
          )
          .run(r.rodzaj, wartosc).lastInsertRowid,
      );

    it.each(RODZAJE_POZA_SKANEM)("akceptuj-z-edycja: $rodzaj", async (r) => {
      const stara = `P71_STARA_${r.rodzaj}`;
      const nowa = `P71_NOWA_${r.rodzaj}`;
      dodajProdukty(r, stara, 3);
      dodajProdukty(r, `P71_INNA_${r.rodzaj}`, 2);
      const id = pozycjaRecznie(r, stara);

      const B = await uzycie(r, stara);
      const C = await zEdycja(id, nowa);

      expect({ B, C }).toEqual({ B: 3, C: 3 });
      expect(ileZWartoscia(r, nowa)).toBe(C);
      expect(ileZWartoscia(r, stara)).toBe(0);
      expect(ileZWartoscia(r, `P71_INNA_${r.rodzaj}`)).toBe(2);
    });

    it.each(RODZAJE_POZA_SKANEM)("akceptuj-jako-alias: $rodzaj", async (r) => {
      const stara = `P71_STARA_${r.rodzaj}`;
      const kanoniczna = `P71_KANON_${r.rodzaj}`;
      dodajProdukty(r, stara, 4);
      dodajProdukty(r, kanoniczna, 1);
      await doSlownika(r, kanoniczna);
      const id = pozycjaRecznie(r, stara);

      const B = await uzycie(r, stara);
      const C = await jakoAlias(id, kanoniczna);

      expect({ B, C }).toEqual({ B: 4, C: 4 });
      expect(ileZWartoscia(r, kanoniczna)).toBe(1 + C);
      expect(ileZWartoscia(r, stara)).toBe(0);
    });
  });

  // ——————————————— brzegi predykatu: skan (A) liczy inaczej niż UPDATE (C) ———————————————

  describe("brzegi predykatu skanu — zachowanie 1:1 z oryginałem, nie błąd", () => {
    /**
     * Skan pomija dostawcę MO6 (`pending_module.cjs:91`), a `uzycie` i UPDATE nie mają tego filtra.
     * Ostrzeżenie (B) mówi prawdę, kolumna listy kolejki (A) zaniża o wiersze MO6 — i akcja
     * przepisuje także produkty MO6. Na snapshocie uśpione: MO6 nie ma tam ani jednego produktu.
     */
    it("MO6: A pomija wiersze MO6, B i C je liczą — akcja przepisuje także MO6", async () => {
      dodajProdukty(MARKA, "P73_MARKA", 2, "MO1");
      dodajProdukty(MARKA, "P73_MARKA", 1, "MO6");
      await skanuj();

      const p = (await pozycja(MARKA, "P73_MARKA"))!;
      const B = await uzycie(MARKA, "P73_MARKA");
      const C = await zEdycja(p.id, "P73_MARKA_NOWA");

      expect({ A: p.ile_wystapien, B, C }).toEqual({ A: 2, B: 3, C: 3 });
      expect(ileZWartoscia(MARKA, "P73_MARKA_NOWA")).toBe(3);
      const mo6 = srodowisko.sqlite
        .prepare("SELECT marka FROM products WHERE dostawca = 'MO6'")
        .get() as { marka: string };
      expect(mo6.marka).toBe("P73_MARKA_NOWA");
    });

    /**
     * Skan grupuje po SUROWEJ wartości, a klucz pozycji przycina (`String(w).trim()`, `:101`).
     * „X" i „X " to dwie grupy z jednym kluczem „X": druga (w kolejności GROUP BY „X " jest po
     * „X") trafia w istniejącą pozycję i NADPISUJE jej `ile_wystapien` swoim licznikiem — stąd
     * `zaktualizowano: 1` w pierwszym skanie na pustej kolejce. UPDATE szuka dokładnie „X", więc
     * wiersze „X " zostają nietknięte, a wartość przy kolejnym skanie wraca do kolejki.
     * Na snapshocie uśpione: żadna z 13 kolumn nie ma wartości ze spacją na brzegu.
     *
     * ⚠ „Która grupa wygrywa" zależy od kolejności wierszy `GROUP BY` bez `ORDER BY` — w SQLite
     * to w praktyce porządek sortowania grupowania (binarny, „X" < „X "), ale nie gwarancja
     * języka. Gdyby ten test kiedyś padł na `A: 1`, pierwsze pytanie brzmi: czy zmieniła się
     * wersja SQLite albo plan zapytania (np. indeks na kolumnie), a nie „zepsuł się skan".
     * Samo zjawisko — A to licznik JEDNEJ z grup, nie ich suma, a UPDATE nie rusza „X " — zostaje.
     */
    it("spacja na końcu obok wersji czystej: A = licznik wersji ze spacją, B == C = wersja czysta", async () => {
      dodajProdukty(BIEZNIK, "P73 BIEZNIK", 2);
      dodajProdukty(BIEZNIK, "P73 BIEZNIK ", 1);
      const staty = await skanuj();
      expect(staty.zaktualizowano).toBe(1);

      const p = (await pozycja(BIEZNIK, "P73 BIEZNIK"))!;
      const B = await uzycie(BIEZNIK, "P73 BIEZNIK");
      const C = await zEdycja(p.id, "P73 NOWY");

      expect({ A: p.ile_wystapien, B, C }).toEqual({ A: 1, B: 2, C: 2 });
      expect(ileZWartoscia(BIEZNIK, "P73 NOWY")).toBe(2);
      expect(ileZWartoscia(BIEZNIK, "P73 BIEZNIK ")).toBe(1);

      await skanuj();
      expect((await pozycja(BIEZNIK, "P73 BIEZNIK"))?.ile_wystapien).toBe(1);
    });

    /**
     * Najostrzejszy wariant: wartość istnieje WYŁĄCZNIE ze spacją. Kolejka pokazuje A = 2, a akcja
     * nie przepisuje niczego (B == C == 0) — pozycja znika z kolejki, produkty zostają ze starą
     * wartością i przy kolejnym skanie pozycja wraca. Ostrzeżenie (B = 0) jest zgodne z prawdą.
     */
    it("tylko wersja ze spacją: A = 2, B == C == 0, pozycja wraca przy kolejnym skanie", async () => {
      dodajProdukty(BIEZNIK, "P73 SPACJA ", 2);
      await skanuj();

      const p = (await pozycja(BIEZNIK, "P73 SPACJA"))!;
      const B = await uzycie(BIEZNIK, "P73 SPACJA");
      const C = await zEdycja(p.id, "P73 NOWY");

      expect({ A: p.ile_wystapien, B, C }).toEqual({ A: 2, B: 0, C: 0 });
      expect(ileZWartoscia(BIEZNIK, "P73 SPACJA ")).toBe(2);
      expect(await pozycja(BIEZNIK, "P73 SPACJA")).toBeUndefined();

      await skanuj();
      expect((await pozycja(BIEZNIK, "P73 SPACJA"))?.ile_wystapien).toBe(2);
    });

    /**
     * Porównanie jest BINARNE w skanie, w `uzycie` i w UPDATE (kolumny `TEXT` bez `COLLATE`),
     * więc warianty wielkości liter to OSOBNE pozycje i każda akcja rusza tylko swój wariant.
     * Tu nie ma rozjazdu. Karta P7.2 (#42) zmienia PODOBIEŃSTWO na case-insensitive — to wpływa
     * na sugestie aliasów, nie na te predykaty — więc ten test ma zostać zielony także po niej.
     */
    it("wielkość liter: osobne pozycje, akcja rusza tylko swój wariant", async () => {
      dodajProdukty(MARKA, "P73 Bkt", 2);
      dodajProdukty(MARKA, "P73 BKT", 1);
      await skanuj();

      const male = (await pozycja(MARKA, "P73 Bkt"))!;
      const duze = (await pozycja(MARKA, "P73 BKT"))!;
      expect([male.ile_wystapien, duze.ile_wystapien]).toEqual([2, 1]);

      const B = await uzycie(MARKA, "P73 Bkt");
      const C = await zEdycja(male.id, "P73 BKT");

      expect({ B, C }).toEqual({ B: 2, C: 2 });
      expect(ileZWartoscia(MARKA, "P73 BKT")).toBe(3);
      expect(ileZWartoscia(MARKA, "P73 Bkt")).toBe(0);
    });

    /**
     * NULL, pusty napis i same spacje odpadają już w skanie (`IS NOT NULL AND TRIM(...) != ''`),
     * więc nie ma pozycji, którą dałoby się zaakceptować, a `uzycie` z pustą wartością to 400.
     * Akcja na sąsiedniej wartości tych wierszy nie dotyka.
     */
    it("NULL / pusty napis / same spacje: brak pozycji, akcja obok ich nie rusza", async () => {
      dodajProdukty(BIEZNIK, null, 1);
      dodajProdukty(BIEZNIK, "", 1);
      dodajProdukty(BIEZNIK, "   ", 1);
      dodajProdukty(BIEZNIK, "P73 OBOK", 2);
      await skanuj();

      const zBieznika = (await pozycje()).filter((p) => p.rodzaj === "bieznik");
      expect(zBieznika.map((p) => p.wartosc)).not.toContain("");
      const pusty = await get("/api/atrybuty/uzycie", {
        rodzaj: "bieznik",
        wartosc: "",
      });
      expect(pusty.status).toBe(400);

      const p = (await pozycja(BIEZNIK, "P73 OBOK"))!;
      expect(await zEdycja(p.id, "P73 NOWY")).toBe(2);
      const puste = srodowisko.sqlite
        .prepare(
          "SELECT COUNT(*) AS c FROM products WHERE bieznik IS NULL OR TRIM(bieznik) = ''",
        )
        .get() as { c: number };
      expect(puste.c).toBe(3);
    });
  });

  // ——————————————— C liczy wiersze DOPASOWANE, nie ZMIENIONE ———————————————

  describe("C to wiersze dopasowane, nie zmienione — zachowanie 1:1 z oryginałem", () => {
    /**
     * `changes` w SQLite liczy wiersze, które UPDATE dopasował, także gdy wartość się nie zmienia.
     * Pozycja kolejki obecna już w słowniku (skan nie czyści kolejki) dostaje samą siebie jako
     * sugestię ze 100% — backlog #40, karta P7.2. Kliknięcie tej sugestii: ostrzeżenie mówi „w N
     * produktach", toast „Zaktualizowano produktów: N", a realnie nie zmienia się NIC. Danych to
     * nie psuje, ale liczba w ostrzeżeniu nie jest liczbą zmian. Pomiar na snapshocie: 437 z 500
     * pozycji kolejki ma taką sugestię na pierwszym miejscu (bieznik 242, rozmiar 99, marka 68,
     * indeks_nosnosci 27, konstrukcja 1).
     *
     * ⚠ Po P7.2: jeśli ta karta zacznie usuwać z kolejki pozycje obecne w słowniku, ten przypadek
     * przestanie być osiągalny z UI i asercja na `pozycja` trzeba będzie odwrócić — to jest
     * efekt, na który P7.2 czeka.
     */
    it("alias na samą siebie: B == C == n, realna zmiana 0", async () => {
      dodajProdukty(BIEZNIK, "P73 SAM", 3);
      await skanuj();
      await doSlownika(BIEZNIK, "P73 SAM"); // wartość trafia do słownika, pozycja zostaje

      const p = (await pozycja(BIEZNIK, "P73 SAM"))!;
      const B = await uzycie(BIEZNIK, "P73 SAM");
      const C = await jakoAlias(p.id, "P73 SAM");

      expect({ B, C }).toEqual({ B: 3, C: 3 });
      expect(ileZWartoscia(BIEZNIK, "P73 SAM")).toBe(3); // przed i po — te same 3 wiersze
    });

    /** Ten sam mechanizm przy edycji: zapis bez zmiany napisu raportuje n przepisanych. */
    it("edycja na ten sam napis: B == C == n, realna zmiana 0", async () => {
      dodajProdukty(BIEZNIK, "P73 BEZ ZMIANY", 2);
      await skanuj();

      const p = (await pozycja(BIEZNIK, "P73 BEZ ZMIANY"))!;
      const B = await uzycie(BIEZNIK, "P73 BEZ ZMIANY");
      const C = await zEdycja(p.id, "P73 BEZ ZMIANY");

      expect({ B, C }).toEqual({ B: 2, C: 2 });
      expect(ileZWartoscia(BIEZNIK, "P73 BEZ ZMIANY")).toBe(2);
    });
  });

  // ——————————————— import między skanem a akcją ———————————————

  describe("import między skanem a akcją — A to migawka, B nadal == C", () => {
    /**
     * A jest zapisem z chwili skanu i nie śledzi katalogu — to celowe. Ostrzeżenie czyta B,
     * liczone przy otwarciu dialogu, więc mówi prawdę. A pokazuje kolumna listy kolejki i dialog
     * w ułamku sekundy, zanim przyjdzie B. Pomiar na snapshocie: 126 z 500 pozycji kolejki ma
     * A ≠ C — wszystkie nieświeże (61 wartości zniknęło z katalogu, 65 zmieniło liczność).
     */
    it("produkt dochodzi po skanie: A stoi, B == C obejmuje nowy", async () => {
      dodajProdukty(MARKA, "P73 IMPORT", 2);
      await skanuj();
      dodajProdukty(MARKA, "P73 IMPORT", 1);

      const p = (await pozycja(MARKA, "P73 IMPORT"))!;
      const B = await uzycie(MARKA, "P73 IMPORT");
      const C = await zEdycja(p.id, "P73 IMPORT NOWY");

      expect({ A: p.ile_wystapien, B, C }).toEqual({ A: 2, B: 3, C: 3 });
      expect(ileZWartoscia(MARKA, "P73 IMPORT NOWY")).toBe(3);
    });

    it("produkt znika po skanie: A stoi, B == C bez niego", async () => {
      dodajProdukty(MARKA, "P73 ZNIKA", 3);
      await skanuj();
      srodowisko.sqlite
        .prepare(
          "DELETE FROM products WHERE id = (SELECT MIN(id) FROM products WHERE marka = ?)",
        )
        .run("P73 ZNIKA");

      const p = (await pozycja(MARKA, "P73 ZNIKA"))!;
      const B = await uzycie(MARKA, "P73 ZNIKA");
      await doSlownika(MARKA, "P73 KANON");
      const C = await jakoAlias(p.id, "P73 KANON");

      expect({ A: p.ile_wystapien, B, C }).toEqual({ A: 3, B: 2, C: 2 });
      expect(ileZWartoscia(MARKA, "P73 KANON")).toBe(2);
    });

    /** Pozycji spoza słownika ponowny skan odświeża A — wtedy A == C wraca. */
    it("ponowny skan wyrównuje A dla pozycji spoza słownika", async () => {
      dodajProdukty(MARKA, "P73 RESKAN", 2);
      await skanuj();
      dodajProdukty(MARKA, "P73 RESKAN", 2);
      const staty = await skanuj();
      expect(staty.zaktualizowano).toBeGreaterThan(0);

      const p = (await pozycja(MARKA, "P73 RESKAN"))!;
      expect(p.ile_wystapien).toBe(4);
      expect(await zEdycja(p.id, "P73 RESKAN NOWY")).toBe(4);
    });

    /**
     * …ale pozycji, która trafiła już do słownika, skan NIE odświeża (pomija wartości ze
     * słownika, zanim sięgnie do kolejki) — jej A zostaje na zawsze z pierwszego skanu. To źródło
     * wszystkich 126 rozjazdów A ≠ C w kolejce ze snapshotu.
     */
    it("pozycji obecnej w słowniku skan nie odświeża — A zostaje nieświeże", async () => {
      dodajProdukty(MARKA, "P73 ZAMROZONA", 2);
      await skanuj();
      await doSlownika(MARKA, "P73 ZAMROZONA");
      dodajProdukty(MARKA, "P73 ZAMROZONA", 3);
      await skanuj();

      const p = (await pozycja(MARKA, "P73 ZAMROZONA"))!;
      const B = await uzycie(MARKA, "P73 ZAMROZONA");
      expect({ A: p.ile_wystapien, B }).toEqual({ A: 2, B: 5 });
    });
  });
});
