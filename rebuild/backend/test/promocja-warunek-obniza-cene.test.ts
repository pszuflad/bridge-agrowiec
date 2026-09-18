/**
 * Karta 14e, zadanie A — zgłoszenie Ani z `docs/instrukcja-testow-I4.md` §3.7:
 * „Rabaty nie działają mimo wprowadzenia promocji".
 *
 * Ten plik zamraża WERDYKT tej karty, zmierzony na kopii `db/snapshot.db` równolegle
 * na odbudowie i na ORYGINALE (`mirror/backend/index.cjs` w piaskownicy): obie strony
 * policzyły identyczne ceny dla wszystkich 7405 produktów, zero rozjazdów.
 *
 * Rozstrzygane są dwie rzeczy naraz, bo to one odróżniają „promocja nie działa" od
 * „promocja została źle założona":
 *
 *   1. **Promocja Z WARUNKIEM działa** — `marka→BKT`, rabat 10%, daty domyślne obniża
 *      cenę wg `floor(zakup × (1+narzut) × (1−rabat) × (1+vat))`. Tak każe ją zakładać
 *      §3.7 instrukcji („Odznacz «Reguła globalna» i ustaw warunek").
 *   2. **Promocja „globalna" NIE działa** — `zasieg: "globalny"`, `warunki: "[]"` (to, co
 *      wysyła checkbox w dialogu) pasuje WYŁĄCZNIE do pozycji z pustą marką i pustą
 *      kategorią, bo napis „globalny" nie zawiera ani „bkt", ani „rolnicze".
 *      To defekt produkcji, `docs/rebuild-backlog.md` #25, odtworzony 1:1 — na pełnym
 *      katalogu produkcji objął 1 produkt na 7405.
 *
 * ⚠ Ten test NIE jest naprawą #25. Pilnuje, żeby (1) nie przestało działać po cichu,
 * a (2) nie zaczęło działać po cichu — jedno i drugie byłoby rozjazdem z produkcją.
 * Świadoma zmiana #25 ma się tutaj zapalić i wymusić zapisanie decyzji.
 *
 * Baza jest PRAWDZIWA (plik w katalogu tymczasowym) — mockowanie SQLite nie dowodziłoby
 * niczego o `floor` ani o progu zapisu.
 */
import { afterEach, describe, expect, it } from "vitest";

import { markups, products, promotions } from "../src/db/schema.js";
import { przeliczCenyZRegul } from "../src/repos/ceny.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";

/** Narzut globalny +6% — dokładnie ten, który leży w `contract/fixtures/GET_markups.json`. */
const NARZUT_GLOBALNY_6 = {
  typ: "globalny",
  zakres: "",
  warunki: "[]",
  nazwa: "Reguła Globalna",
  wartosc: 6,
  jednostka: "procent",
  priorytet: 50,
  status: "aktywny",
  zmienilUzytkownikId: 1,
  zmienionoData: "2026-07-31T13:07:21.578Z",
} as const;

/**
 * Wspólna podstawa produktu; `cenaZakupu` dobrana tak, by `floor` był widoczny.
 *
 * `cenaSprzedazy`/`marzaPct` startują ze STARYCH wartości (`zakup × 1,25`, marża 25) — tak
 * wygląda pozycja sprzed wprowadzenia reguł. Kolumny są NOT NULL, więc i tak trzeba je podać,
 * a przy okazji widać, że to przeliczenie je nadpisuje, a nie że były puste od początku.
 */
const PRODUKT_BAZOWY = {
  nazwa: "Opona 480/70R28 AGRIMAX RT 765",
  dostawca: "MO5",
  magazyn: "PL",
  stan: 4,
  vat: 23,
  cenaSprzedazy: 1250,
  marzaPct: 25,
  status: "aktywny",
  dataAktualizacji: "2026-01-01T00:00:00.000Z",
} as const;

/**
 * Cztery produkty pokrywające wszystkie gałęzie dopasowania:
 *   • BKT/Rolnicze — łapie warunek `marka→BKT`, nie łapie „globalnej";
 *   • MICHELIN/Rolnicze — kontrola, że rabat NIE zjeżdża na obcą markę;
 *   • pusta marka + pusta kategoria — łapie „globalną";
 *   • pusta marka, ale NIEPUSTA kategoria — też łapie „globalną", bo dopasowanie jest
 *     ALTERNATYWĄ (`zasieg.includes(marka) || zasieg.includes(kategoria)`), a `"globalny"`
 *     zawiera pusty napis. To nie jest przypadek teoretyczny: na pełnym katalogu produkcji
 *     JEDYNYM trafionym produktem był właśnie taki (`MO4_LLCR17523575MLLS0`, marka pusta,
 *     kategoria „Ciężarowe") — 1 pozycja na 7405, zmierzone w 14e na oryginale i odbudowie.
 */
function zasiej(b: TestowaBaza) {
  b.db
    .insert(products)
    .values([
      { ...PRODUKT_BAZOWY, kod: "BKT1", marka: "BKT", kategoria: "Rolnicze", cenaZakupu: 1000 },
      {
        ...PRODUKT_BAZOWY,
        kod: "MICH1",
        marka: "MICHELIN",
        kategoria: "Rolnicze",
        cenaZakupu: 1000,
      },
      { ...PRODUKT_BAZOWY, kod: "PUSTA", marka: "", kategoria: "", cenaZakupu: 1000 },
      {
        ...PRODUKT_BAZOWY,
        kod: "PUSTA_MARKA",
        marka: "",
        kategoria: "Ciężarowe",
        cenaZakupu: 1000,
      },
    ])
    .run();
}

/** Ciało 1:1 z tym, co wysyła `DialogReguly` przy ODZNACZONEJ „regule globalnej". */
function promocjaZWarunkiem(wartosc: string) {
  return {
    nazwa: "Wyprzedaż testowa",
    rabatPct: 10,
    zasieg: "",
    warunki: JSON.stringify([{ typ: "marka", wartosc }]),
    priorytet: 50,
    start: "2026-09-18",
    koniec: "2026-10-18",
    status: "aktywna",
    zmienilUzytkownikId: 1,
    zmienionoData: "2026-09-18T00:00:00.000Z",
  };
}

/** Ciało 1:1 z tym, co wysyła `DialogReguly` przy ZAZNACZONEJ „regule globalnej". */
function promocjaGlobalna() {
  return { ...promocjaZWarunkiem("BKT"), nazwa: "Globalna", zasieg: "globalny", warunki: "[]" };
}

const poKodzie = (b: TestowaBaza, kod: string) =>
  b.db.select().from(products).all().find((p) => p.kod === kod)!;

describe("Promocja z warunkiem realnie obniża ceny (14e, zadanie A)", () => {
  let baza: TestowaBaza | null = null;

  afterEach(() => {
    baza?.posprzataj();
    baza = null;
  });

  it("sam narzut +6%: cena = floor(zakup × 1,06 × 1,23)", () => {
    baza = stworzTestowaBaze();
    zasiej(baza);
    baza.db.insert(markups).values(NARZUT_GLOBALNY_6).run();

    przeliczCenyZRegul(baza.db);

    // 1000 × 1,06 × 1,23 = 1303,8 → 1303
    expect(poKodzie(baza, "BKT1").cenaSprzedazy).toBe(1303);
    expect(poKodzie(baza, "MICH1").cenaSprzedazy).toBe(1303);
  });

  it("⭐ promocja marka→BKT z rabatem 10% zbija cenę BKT do floor(zakup × 1,06 × 0,90 × 1,23)", () => {
    baza = stworzTestowaBaze();
    zasiej(baza);
    baza.db.insert(markups).values(NARZUT_GLOBALNY_6).run();
    baza.db.insert(promotions).values(promocjaZWarunkiem("BKT")).run();

    przeliczCenyZRegul(baza.db);

    // 1000 × 1,06 × 0,90 × 1,23 = 1173,42 → 1173
    expect(poKodzie(baza, "BKT1").cenaSprzedazy).toBe(1173);
  });

  it("rabat NIE zjeżdża na obcą markę — MICHELIN zostaje przy cenie bez rabatu", () => {
    baza = stworzTestowaBaze();
    zasiej(baza);
    baza.db.insert(markups).values(NARZUT_GLOBALNY_6).run();
    baza.db.insert(promotions).values(promocjaZWarunkiem("BKT")).run();

    przeliczCenyZRegul(baza.db);

    expect(poKodzie(baza, "MICH1").cenaSprzedazy).toBe(1303);
  });

  it("`marzaPct` po promocji nadal pokazuje PROCENT NARZUTU, nie rabat i nie marżę", () => {
    baza = stworzTestowaBaze();
    zasiej(baza);
    baza.db.insert(markups).values(NARZUT_GLOBALNY_6).run();
    baza.db.insert(promotions).values(promocjaZWarunkiem("BKT")).run();

    przeliczCenyZRegul(baza.db);

    expect(poKodzie(baza, "BKT1").marzaPct).toBe(6);
  });

  it("warunek jest niewrażliwy na wielkość liter — „bkt\" łapie markę „BKT\"", () => {
    baza = stworzTestowaBaze();
    zasiej(baza);
    baza.db.insert(markups).values(NARZUT_GLOBALNY_6).run();
    baza.db.insert(promotions).values(promocjaZWarunkiem("bkt")).run();

    przeliczCenyZRegul(baza.db);

    expect(poKodzie(baza, "BKT1").cenaSprzedazy).toBe(1173);
  });
});

describe("⚠ Promocja „globalna\" nie obniża cen — defekt produkcji #25, odtworzony 1:1", () => {
  let baza: TestowaBaza | null = null;

  afterEach(() => {
    baza?.posprzataj();
    baza = null;
  });

  it("⭐ nie rusza ceny produktu z marką i kategorią — ani BKT, ani MICHELIN", () => {
    baza = stworzTestowaBaze();
    zasiej(baza);
    baza.db.insert(markups).values(NARZUT_GLOBALNY_6).run();
    baza.db.insert(promotions).values(promocjaGlobalna()).run();

    przeliczCenyZRegul(baza.db);

    expect(poKodzie(baza, "BKT1").cenaSprzedazy).toBe(1303);
    expect(poKodzie(baza, "MICH1").cenaSprzedazy).toBe(1303);
  });

  it("obejmuje pozycję z pustą marką — także gdy kategoria jest wypełniona", () => {
    baza = stworzTestowaBaze();
    zasiej(baza);
    baza.db.insert(markups).values(NARZUT_GLOBALNY_6).run();
    baza.db.insert(promotions).values(promocjaGlobalna()).run();

    przeliczCenyZRegul(baza.db);

    expect(poKodzie(baza, "PUSTA").cenaSprzedazy).toBe(1173);
    // dopasowanie jest ALTERNATYWĄ — sama pusta marka wystarcza; to jest ten jeden
    // produkt na 7405, który „globalna" realnie złapała na katalogu produkcji
    expect(poKodzie(baza, "PUSTA_MARKA").cenaSprzedazy).toBe(1173);
  });

  it("obejście z §3.7 instrukcji działa: ta sama promocja Z WARUNKIEM już obniża cenę", () => {
    baza = stworzTestowaBaze();
    zasiej(baza);
    baza.db.insert(markups).values(NARZUT_GLOBALNY_6).run();
    baza.db.insert(promotions).values(promocjaZWarunkiem("BKT")).run();

    przeliczCenyZRegul(baza.db);

    expect(poKodzie(baza, "BKT1").cenaSprzedazy).toBe(1173);
  });
});
