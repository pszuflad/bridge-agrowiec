/**
 * Silnik cen — narzuty i promocje (Iteracja 4a, `src/repos/ceny.ts`).
 *
 * PODZIAŁ PRACY MIĘDZY TYM TESTEM A CHARAKTERYZACJĄ. Dowód wierności wobec produkcji daje
 * `akceptacja.charakteryzacja.test.ts`: uruchamia ORYGINAŁ wycięty z bundla obok naszego portu
 * i porównuje stan baz. Ten plik robi coś innego i uzupełniającego — nazywa POJEDYNCZE reguły
 * po imieniu, żeby przy przyszłej zmianie diagnoza brzmiała „zepsuł się wybór specyficznej
 * reguły", a nie „rozjechał się scenariusz nr 19". Dotyka też ścieżek, których charakteryzacja
 * NIE ma, bo nie przechodzą przez `acceptStaging`: masowego `przeliczCenyZRegul`.
 *
 * Baza jest PRAWDZIWA (plik w katalogu tymczasowym) — mockowanie SQLite nie dowodziłoby niczego
 * o zaokrągleniach ani o progu zapisu.
 */
import { afterEach, describe, expect, it } from "vitest";

import { markups, products, promotions } from "../src/db/schema.js";
import {
  dopasujWarunek,
  narzutPasuje,
  promocjaPasuje,
  przeliczCenyZRegul,
  wybierzNarzut,
  wybierzPromocje,
  zastosujRegulyCenowe,
  type Narzut,
  type Promocja,
} from "../src/repos/ceny.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";

/** Reguła narzutu z domyślnymi — pola NOT NULL wypełnione. */
function narzut(pola: Partial<Narzut> = {}): Narzut {
  return {
    id: 1,
    typ: "globalny",
    zakres: "",
    warunki: null,
    nazwa: "Reguła",
    wartosc: 6,
    jednostka: "procent",
    priorytet: 50,
    status: "aktywny",
    zmienilUzytkownikId: 1,
    zmienionoData: "2026-01-01T00:00:00.000Z",
    ...pola,
  };
}

function promocja(pola: Partial<Promocja> = {}): Promocja {
  return {
    id: 1,
    nazwa: "Promocja",
    rabatPct: 10,
    zasieg: "BKT",
    warunki: null,
    priorytet: 50,
    start: "2026-01-01",
    koniec: "2026-12-31",
    status: "aktywna",
    zmienilUzytkownikId: 1,
    zmienionoData: "2026-01-01T00:00:00.000Z",
    ...pola,
  };
}

/** Produkt, na którym liczymy: zakup 1000, VAT 23, marka BKT, kategoria Rolnicze, MO5. */
const PRODUKT = {
  kod: "P1",
  nazwa: "Opona 480/70R28 BKT AGRIMAX RT 765",
  marka: "BKT",
  kategoria: "Rolnicze",
  dostawca: "MO5",
  stan: 4,
  cenaZakupu: 1000,
  vat: 23,
  dataAktualizacji: "2026-01-01T00:00:00.000Z",
} as const;

describe("1. Formuła ceny sprzedaży", () => {
  it("floor(zakup × (1+narzut) × (1−rabat) × (1+vat)) — ucina w dół, nie zaokrągla", () => {
    const rekord: Record<string, unknown> = { ...PRODUKT };
    // 1000 × 1,06 × 1,23 = 1303,8 → 1303. Zaokrąglenie dałoby 1304, i to byłby inny system.
    expect(zastosujRegulyCenowe(rekord, [narzut({ wartosc: 6 })], [])).toBe(true);
    expect(rekord.cenaSprzedazy).toBe(1303);
  });

  it("marzaPct to PROCENT NARZUTU, nie policzona marża", () => {
    const rekord: Record<string, unknown> = { ...PRODUKT };
    zastosujRegulyCenowe(rekord, [narzut({ wartosc: 6 })], []);
    // Realna marża z ceny 1303 przy zakupie 1000 to ~30%. Oryginał zapisuje 6.
    expect(rekord.marzaPct).toBe(6);
  });

  it("marzaPct zaokrągla się do jednego miejsca po przecinku", () => {
    const rekord: Record<string, unknown> = { ...PRODUKT };
    zastosujRegulyCenowe(rekord, [narzut({ wartosc: 12.34 })], []);
    expect(rekord.marzaPct).toBe(12.3);
  });

  it("brak VAT-u na produkcie ⇒ stawka domyślna 23, nie 0", () => {
    const bezVat: Record<string, unknown> = { ...PRODUKT, vat: null };
    zastosujRegulyCenowe(bezVat, [narzut({ wartosc: 6 })], []);
    expect(bezVat.cenaSprzedazy).toBe(1303);
  });

  it("VAT z produktu wygrywa nad domyślnym", () => {
    const zerowyVat: Record<string, unknown> = { ...PRODUKT, vat: 0 };
    zastosujRegulyCenowe(zerowyVat, [narzut({ wartosc: 6 })], []);
    expect(zerowyVat.cenaSprzedazy).toBe(1060);
  });

  it("narzut i rabat składają się multiplikatywnie, nie sumują", () => {
    const rekord: Record<string, unknown> = { ...PRODUKT };
    zastosujRegulyCenowe(rekord, [narzut({ wartosc: 20 })], [promocja({ rabatPct: 10 })]);
    // 1000 × 1,2 × 0,9 × 1,23 = 1328,4 → 1328. Suma (+20−10 = +10%) dałaby 1353.
    expect(rekord.cenaSprzedazy).toBe(1328);
    expect(rekord.marzaPct).toBe(20);
  });

  it("gałąź NIE wchodzi, gdy nie pasuje ani narzut, ani promocja", () => {
    const rekord: Record<string, unknown> = { ...PRODUKT, cenaSprzedazy: 1250, marzaPct: 25 };
    expect(zastosujRegulyCenowe(rekord, [narzut({ status: "wylaczony" })], [])).toBe(false);
    expect(rekord.cenaSprzedazy).toBe(1250);
    expect(rekord.marzaPct).toBe(25);
  });

  it("status: cena sprzedaży 0 po zaokrągleniu w dół wstrzymuje produkt", () => {
    // 0,004 × 1 × 1,23 = 0,00492 → floor = 0, mimo dodatniej ceny zakupu.
    const grosz: Record<string, unknown> = { ...PRODUKT, cenaZakupu: 0.004 };
    zastosujRegulyCenowe(grosz, [narzut({ wartosc: 0 })], []);
    expect(grosz.cenaSprzedazy).toBe(0);
    expect(grosz.status).toBe("wstrzymany");
  });

  it("status: dodatnia cena ⇒ aktywny", () => {
    const rekord: Record<string, unknown> = { ...PRODUKT, status: "wstrzymany" };
    zastosujRegulyCenowe(rekord, [narzut({ wartosc: 6 })], []);
    expect(rekord.status).toBe("aktywny");
  });
});

describe("2. Dopasowanie warunku", () => {
  it("dostawca porównuje się przez RÓWNOŚĆ, kategoria przez zawieranie", () => {
    expect(dopasujWarunek(PRODUKT, { typ: "dostawca", wartosc: "MO5" })).toBe(true);
    // To nie jest przeoczenie testu — oryginał naprawdę nie łapie prefiksu dostawcy.
    expect(dopasujWarunek(PRODUKT, { typ: "dostawca", wartosc: "MO" })).toBe(false);
    expect(dopasujWarunek(PRODUKT, { typ: "kategoria", wartosc: "roln" })).toBe(true);
  });

  it("porównanie jest niewrażliwe na wielkość liter", () => {
    expect(dopasujWarunek(PRODUKT, { typ: "marka", wartosc: "bkt" })).toBe(true);
  });

  it("typ „produkt\" szuka i w kodzie, i w nazwie", () => {
    expect(dopasujWarunek(PRODUKT, { typ: "produkt", wartosc: "P1" })).toBe(true);
    expect(dopasujWarunek(PRODUKT, { typ: "produkt", wartosc: "agrimax" })).toBe(true);
  });

  it("pusta wartość i NIEZNANY typ dają true — reguła z literówką łapie wszystko", () => {
    expect(dopasujWarunek(PRODUKT, { typ: "marka", wartosc: "  " })).toBe(true);
    expect(dopasujWarunek(PRODUKT, { typ: "markaa", wartosc: "cokolwiek" })).toBe(true);
  });
});

describe("3. Dopasowanie i wybór narzutu", () => {
  it("status inny niż „aktywny\" wyklucza regułę", () => {
    expect(narzutPasuje(narzut({ status: "wylaczony" }), PRODUKT)).toBe(false);
  });

  it("warunki są KONIUNKCJĄ — wszystkie muszą pasować", () => {
    const oba = JSON.stringify([
      { typ: "marka", wartosc: "BKT" },
      { typ: "kategoria", wartosc: "roln" },
    ]);
    const jeden = JSON.stringify([
      { typ: "marka", wartosc: "BKT" },
      { typ: "kategoria", wartosc: "osobowe" },
    ]);
    expect(narzutPasuje(narzut({ warunki: oba }), PRODUKT)).toBe(true);
    expect(narzutPasuje(narzut({ warunki: jeden }), PRODUKT)).toBe(false);
  });

  it("uszkodzony JSON w warunkach degraduje do typ/zakres, zamiast wywracać silnik", () => {
    const zepsute = narzut({ typ: "dostawca", zakres: "MO5", warunki: "{to nie json" });
    expect(narzutPasuje(zepsute, PRODUKT)).toBe(true);
    const zepsuteNiepasujace = narzut({ typ: "dostawca", zakres: "MO9", warunki: "{to nie json" });
    expect(narzutPasuje(zepsuteNiepasujace, PRODUKT)).toBe(false);
  });

  it("⭐ reguła SPECYFICZNA bije globalną mimo DRASTYCZNIE niższego priorytetu", () => {
    const globalna = narzut({ id: 1, typ: "globalny", wartosc: 6, priorytet: 99 });
    const specyficzna = narzut({ id: 2, typ: "dostawca", zakres: "MO5", wartosc: 20, priorytet: 1 });
    expect(wybierzNarzut([globalna, specyficzna], PRODUKT)?.id).toBe(2);
  });

  it("wśród samych globalnych wygrywa wyższy priorytet", () => {
    const niska = narzut({ id: 1, wartosc: 6, priorytet: 10 });
    const wysoka = narzut({ id: 2, wartosc: 9, priorytet: 90 });
    expect(wybierzNarzut([niska, wysoka], PRODUKT)?.id).toBe(2);
  });

  it("globalna z warunkami liczy się jako SPECYFICZNA", () => {
    const globalna = narzut({ id: 1, typ: "globalny", priorytet: 99 });
    const zWarunkami = narzut({
      id: 2,
      typ: "globalny",
      priorytet: 1,
      warunki: JSON.stringify([{ typ: "marka", wartosc: "BKT" }]),
    });
    expect(wybierzNarzut([globalna, zWarunkami], PRODUKT)?.id).toBe(2);
  });

  it("brak pasującej reguły ⇒ null", () => {
    expect(wybierzNarzut([narzut({ typ: "dostawca", zakres: "MO9" })], PRODUKT)).toBeNull();
  });
});

describe("4. Dopasowanie i wybór promocji", () => {
  it("aktywny status to „aktywna\", nie „aktywny\"", () => {
    expect(promocjaPasuje(promocja({ status: "aktywny" }), PRODUKT)).toBe(false);
    expect(promocjaPasuje(promocja({ status: "aktywna" }), PRODUKT)).toBe(true);
  });

  it("dopasowanie po zasięgu jest ODWRÓCONE — to zasięg zawiera markę produktu", () => {
    expect(promocjaPasuje(promocja({ zasieg: "BKT,MICHELIN" }), PRODUKT)).toBe(true);
    expect(promocjaPasuje(promocja({ zasieg: "MICHELIN" }), PRODUKT)).toBe(false);
  });

  it("pusty zasięg bez warunków ⇒ promocja nie pasuje do niczego", () => {
    expect(promocjaPasuje(promocja({ zasieg: "" }), PRODUKT)).toBe(false);
  });

  it("warunki całkowicie zastępują zasięg", () => {
    const p = promocja({
      zasieg: "COSINNEGO",
      warunki: JSON.stringify([{ typ: "dostawca", wartosc: "MO5" }]),
    });
    expect(promocjaPasuje(p, PRODUKT)).toBe(true);
  });

  /**
   * ⚠ DEFEKT PRODUKCJI ODTWARZANY 1:1 (plan.md D4, `rebuild-backlog.md`). Ten test istnieje
   * PO TO, żeby naprawa dat nie przeszła kiedyś przypadkiem, jako „oczywista poprawka".
   * Jeśli ktoś świadomie zdecyduje inaczej — zapali się tutaj i będzie musiał tę decyzję
   * zapisać, zamiast po cichu rozjechać port z produkcją.
   */
  it("⚠ promocja WYGASŁA nadal działa — silnik nie czyta start ani koniec", () => {
    const wygasla = promocja({ start: "2020-01-01", koniec: "2020-03-31" });
    expect(promocjaPasuje(wygasla, PRODUKT)).toBe(true);

    const przyszla = promocja({ start: "2099-01-01", koniec: "2099-12-31" });
    expect(promocjaPasuje(przyszla, PRODUKT)).toBe(true);
  });

  it("wśród promocji wygrywa wyższy priorytet — bez reguły specyficzności", () => {
    const niska = promocja({ id: 1, rabatPct: 5, priorytet: 10 });
    const wysoka = promocja({ id: 2, rabatPct: 40, priorytet: 90 });
    expect(wybierzPromocje([niska, wysoka], PRODUKT)?.id).toBe(2);
  });
});

describe("5. Masowe przeliczenie katalogu (przeliczCenyZRegul)", () => {
  let baza: TestowaBaza | null = null;

  afterEach(() => {
    baza?.posprzataj();
    baza = null;
  });

  /** Katalog: trzy produkty — normalny, z zerowym zakupem i innego dostawcy. */
  function zasiej(b: TestowaBaza) {
    b.db
      .insert(products)
      .values([
        { ...PRODUKT, kod: "P1", magazyn: "PL", cenaSprzedazy: 1250, marzaPct: 25, status: "aktywny" },
        {
          ...PRODUKT,
          kod: "P2",
          magazyn: "PL",
          cenaZakupu: 0,
          cenaSprzedazy: 0,
          marzaPct: 0,
          status: "wstrzymany",
        },
        {
          ...PRODUKT,
          kod: "P3",
          magazyn: "PL",
          dostawca: "MO9",
          cenaSprzedazy: 1250,
          marzaPct: 25,
          status: "aktywny",
        },
      ])
      .run();
  }

  const poKodzie = (b: TestowaBaza, kod: string) =>
    b.db.select().from(products).all().find((p) => p.kod === kod)!;

  it("przelicza cały katalog i raportuje, ile sprawdził i ile zmienił", () => {
    baza = stworzTestowaBaze();
    zasiej(baza);
    baza.db.insert(markups).values({ ...narzut({ wartosc: 6 }), id: undefined }).run();

    const wynik = przeliczCenyZRegul(baza.db);

    // Trzy produkty sprawdzone, ale P2 (zakup 0) odpada przed liczeniem ⇒ dwie zmiany.
    expect(wynik.checked).toBe(3);
    expect(wynik.updated).toBe(2);
    expect(poKodzie(baza, "P1").cenaSprzedazy).toBe(1303);
    expect(poKodzie(baza, "P1").marzaPct).toBe(6);
  });

  it("produkt z zerową ceną zakupu jest pomijany, a nie zerowany", () => {
    baza = stworzTestowaBaze();
    zasiej(baza);
    baza.db.insert(markups).values({ ...narzut({ wartosc: 6 }), id: undefined }).run();

    przeliczCenyZRegul(baza.db);
    const p2 = poKodzie(baza, "P2");
    expect(p2.cenaSprzedazy).toBe(0);
    expect(p2.marzaPct).toBe(0);
  });

  /**
   * ⚠ RÓŻNICA WOBEC GAŁĘZI IMPORTU, KTÓRA MA ZNACZENIE: masowe przeliczenie NIE rusza
   * `status`. Produkt, któremu reguła zbije cenę do zera, zostaje „aktywny" aż do
   * najbliższego importu. Port 1:1 — `recalcPricesFromRules` po prostu nie ma tam `status`.
   */
  it("NIE zmienia statusu, nawet gdy cena spada do zera", () => {
    baza = stworzTestowaBaze();
    baza.db
      .insert(products)
      .values({
        ...PRODUKT,
        magazyn: "PL",
        cenaZakupu: 0.004,
        cenaSprzedazy: 5,
        marzaPct: 25,
        status: "aktywny",
      })
      .run();
    baza.db.insert(markups).values({ ...narzut({ wartosc: 0 }), id: undefined }).run();

    przeliczCenyZRegul(baza.db);
    const p = poKodzie(baza, "P1");
    expect(p.cenaSprzedazy).toBe(0);
    expect(p.status).toBe("aktywny");
  });

  it("bez reguł ceny lecą do gołego zakup × VAT — brak reguł to narzut 0, nie „zostaw\"", () => {
    baza = stworzTestowaBaze();
    zasiej(baza);

    const wynik = przeliczCenyZRegul(baza.db);

    expect(wynik.updated).toBe(2);
    expect(poKodzie(baza, "P1").cenaSprzedazy).toBe(1230);
    expect(poKodzie(baza, "P1").marzaPct).toBe(0);
  });

  it("próg zapisu: brak realnej różnicy ⇒ żadnego UPDATE-u", () => {
    baza = stworzTestowaBaze();
    baza.db
      .insert(products)
      .values({ ...PRODUKT, magazyn: "PL", cenaSprzedazy: 1303, marzaPct: 6, status: "aktywny" })
      .run();
    baza.db.insert(markups).values({ ...narzut({ wartosc: 6 }), id: undefined }).run();

    const wynik = przeliczCenyZRegul(baza.db);
    expect(wynik.checked).toBe(1);
    expect(wynik.updated).toBe(0);
  });

  it("reguła specyficzna po dostawcy dotyka tylko swoich produktów", () => {
    baza = stworzTestowaBaze();
    zasiej(baza);
    baza.db
      .insert(markups)
      .values({ ...narzut({ typ: "dostawca", zakres: "MO5", wartosc: 20 }), id: undefined })
      .run();

    przeliczCenyZRegul(baza.db);
    expect(poKodzie(baza, "P1").cenaSprzedazy).toBe(1476);
    // MO9 nie pasuje do żadnej reguły ⇒ narzut 0, sam VAT.
    expect(poKodzie(baza, "P3").cenaSprzedazy).toBe(1230);
  });

  it("filtr po id ogranicza przeliczenie do wskazanych produktów", () => {
    baza = stworzTestowaBaze();
    zasiej(baza);
    baza.db.insert(markups).values({ ...narzut({ wartosc: 6 }), id: undefined }).run();
    const idP1 = poKodzie(baza, "P1").id;

    const wynik = przeliczCenyZRegul(baza.db, [idP1]);

    expect(wynik.checked).toBe(1);
    expect(poKodzie(baza, "P1").cenaSprzedazy).toBe(1303);
    expect(poKodzie(baza, "P3").cenaSprzedazy).toBe(1250);
  });

  it("promocja bez narzutu obniża cenę i zeruje marżę", () => {
    baza = stworzTestowaBaze();
    zasiej(baza);
    baza.db
      .insert(promotions)
      .values({ ...promocja({ rabatPct: 10, zasieg: "BKT" }), id: undefined })
      .run();

    przeliczCenyZRegul(baza.db);
    expect(poKodzie(baza, "P1").cenaSprzedazy).toBe(1107);
    expect(poKodzie(baza, "P1").marzaPct).toBe(0);
  });
});
