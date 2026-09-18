/**
 * ŚWIADOME ODSTĘPSTWO OD PRODUKCJI — karta 14i (ticket 58).
 *
 * Decyzja Ani z 2026-09-18 (`docs/rebuild-backlog.md` #11): „EAN który jest zepsuty notacją
 * naukową ma być importowany jako PUSTE POLE W KATALOGU". Produkcja robi inaczej — zapisuje
 * rozwiniętą wartość (`:44872`) i tylko dokleja ostrzeżenie „zapis naukowy ma tylko null cyfr
 * znaczących — EAN niepewny".
 *
 * ⚠ DLACZEGO TEN PLIK ISTNIEJE OSOBNO, ZAMIAST DOŁOŻYĆ SCENARIUSZ DO CHARAKTERYZACJI.
 * `akceptacja.charakteryzacja.test.ts` porównuje nasz port z URUCHOMIONYM oryginałem i żąda
 * pełnej równości (`expect(nasz.produkty).toEqual(oczekiwany.produkty)`) dla każdego wpisu
 * z `charakteryzacja/akceptacja/scenariusze.mjs`. Scenariusz ze świadomym odstępstwem
 * MUSIAŁBY tam paść, a w typie scenariusza nie ma pola wyjątku. Dokładanie takiego pola
 * rozluźniłoby porównanie dla wszystkich 38 scenariuszy — czyli osłabiło jedyną siatkę, która
 * pilnuje wierności akceptacji. Dlatego odstępstwo mieszka tutaj, w jednym miejscu, jawnie.
 *
 * METODA JEST TA SAMA CO W CHARAKTERYZACJI I TO JEST SENS TEGO PLIKU: nie wpisujemy ręcznie,
 * co „powinno wyjść". Uruchamiamy oryginał i nasz port na dwóch identycznie zasianych bazach
 * i pokazujemy, że różnią się DOKŁADNIE JEDNYM POLEM. Dzięki temu test jest jednocześnie
 * dowodem, że odstępstwo jest WĄSKIE — gdyby przeciekło na inne pole albo inną tabelę,
 * asercja „reszta identyczna" zapali.
 */
import { afterEach, describe, expect, it } from "vitest";

import { zatwierdzPozycjeStagingu } from "../src/import/akceptacja.js";
import { products, stagingItems } from "../src/db/schema.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";
import { zaladujOryginal } from "./charakteryzacja/akceptacja/oryginal.mjs";
import { pozycja, produkt } from "./charakteryzacja/akceptacja/scenariusze.mjs";

type Wiersz = Record<string, unknown>;

/** Wartości z realnego przypadku — te same, na których stoi scenariusz `ean-notacja-naukowa`. */
const EAN_SUROWY = "6,41944E+12";
const EAN_ROZWINIETY = "6419440000000";
const KANDYDACI = JSON.stringify([EAN_ROZWINIETY]);

const ZNACZNIK_CZASU = "<czas przebiegu>";
const ZNACZNIK_LOSOWY = "<losowy numer sześciocyfrowy>";

/**
 * Wiersz stagingu w kształcie, jaki produkuje silnik dla EAN-u w notacji naukowej.
 * `status` steruje wyłącznie polem `ean_source_status` — reszta zostaje identyczna, żeby
 * kontrole negatywne różniły się od przypadku badanego DOKŁADNIE jedną rzeczą.
 */
function pozycjaZEanem(
  status: string | null,
  ean: string | null = EAN_ROZWINIETY,
  eanIsValid = 0,
) {
  return pozycja({
    eanRaw: EAN_SUROWY,
    eanIsValid,
    eanSourceStatus: status,
    eanCandidates: KANDYDACI,
    snapshot: {
      ean,
      eanIsValid,
      eanSourceStatus: status,
      eanCandidates: KANDYDACI,
      eanRaw: EAN_SUROWY,
    },
  });
}

/**
 * Sprowadza stan bazy do postaci porównywalnej między przebiegami (jak w charakteryzacji).
 *
 * `numeryZKatalogu` to numery `kod_importu` zasiane ręcznie — te MUSZĄ być porównywane
 * dosłownie, bo są deterministyczne i to właśnie one są ciekawe przy grupowaniu po EAN-ie.
 * Maskujemy wyłącznie numery świeżo wylosowane przez `_kiGenUnique()`, których obie strony
 * z definicji mają różne.
 */
function stan(baza: TestowaBaza, numeryZKatalogu: Set<string> = new Set()) {
  const produkty = (baza.db.select().from(products).all() as unknown as Wiersz[]).map((w) => {
    const kopia = { ...w };
    if (typeof kopia.dataAktualizacji === "string") kopia.dataAktualizacji = ZNACZNIK_CZASU;
    // `_kiGenUnique()` w `bridge_ext` losuje numer dla produktu bez grupy EAN — katalog
    // wejściowy jest pusty, więc po obu stronach numer jest inny z definicji.
    if (
      typeof kopia.kodImportu === "string" &&
      /^\d{6}$/.test(kopia.kodImportu) &&
      !numeryZKatalogu.has(kopia.kodImportu)
    ) {
      kopia.kodImportu = ZNACZNIK_LOSOWY;
    }
    return kopia;
  });
  return { produkty, staging: baza.db.select().from(stagingItems).all() as unknown as Wiersz[] };
}

/** Zasiewa pozycję stagingu (katalog zostaje pusty) i zwraca jej `id`. */
function zasiej(baza: TestowaBaza, wiersz: Wiersz): number {
  baza.db.insert(stagingItems).values(wiersz as never).run();
  return (baza.db.select().from(stagingItems).all()[0] as { id: number }).id;
}

/** Uruchamia oryginał i port na dwóch identycznie zasianych bazach. */
function obieStrony(wiersz: Wiersz, katalog: Wiersz[] = []) {
  const numery = new Set(
    katalog.map((p) => p.kodImportu).filter((n): n is string => typeof n === "string"),
  );
  const zasiejObie = (baza: TestowaBaza) => {
    if (katalog.length) baza.db.insert(products).values(katalog as never).run();
    return zasiej(baza, wiersz);
  };

  const bazaOryginalu = stworzTestowaBaze();
  const bazaPortu = stworzTestowaBaze();
  otwarte.push(bazaOryginalu, bazaPortu);

  const { U } = zaladujOryginal(bazaOryginalu);
  U.acceptStaging(zasiejObie(bazaOryginalu), 1);

  zatwierdzPozycjeStagingu(bazaPortu.db, zasiejObie(bazaPortu), 1);

  return { oryginal: stan(bazaOryginalu, numery), port: stan(bazaPortu, numery) };
}

const otwarte: TestowaBaza[] = [];

afterEach(() => {
  for (const baza of otwarte.splice(0)) baza.posprzataj();
});

describe("14i — EAN w notacji naukowej trafia do katalogu jako PUSTE pole", () => {
  it("produkcja zapisuje rozwinięty EAN, my zapisujemy NULL — i to jest cała różnica", () => {
    const { oryginal, port } = obieStrony(pozycjaZEanem("scientific_notation_uncertain"));

    expect(oryginal.produkty).toHaveLength(1);
    expect(port.produkty).toHaveLength(1);

    // Najpierw DOWÓD, że oryginał naprawdę robi to, od czego odstępujemy — bez tego test
    // przechodziłby także wtedy, gdyby produkcja sama przestała zapisywać tę wartość.
    expect(oryginal.produkty[0]!.ean, "oryginał zapisuje rozwinięty zapis naukowy").toBe(
      EAN_ROZWINIETY,
    );

    // I właściwe odstępstwo.
    expect(port.produkty[0]!.ean, "decyzja Ani 2026-09-18: puste pole w katalogu").toBeNull();
  });

  it("odstępstwo jest WĄSKIE — poza `ean` produkt jest identyczny jak u produkcji", () => {
    const { oryginal, port } = obieStrony(pozycjaZEanem("scientific_notation_uncertain"));

    // Zdejmujemy JEDNO pole, którego różnica jest zamierzona, i żądamy równości reszty.
    // Wszystkie 70+ pozostałych kolumn `products` musi się zgadzać co do wartości.
    const { ean: _pominietyOryginal, ...resztaOryginalu } = oryginal.produkty[0]!;
    const { ean: _pominietyPort, ...resztaPortu } = port.produkty[0]!;

    expect(resztaPortu).toEqual(resztaOryginalu);
  });

  it("pola towarzyszące ZOSTAJĄ w katalogu — widać, dlaczego `ean` jest pusty", () => {
    const { port } = obieStrony(pozycjaZEanem("scientific_notation_uncertain"));
    const produkt = port.produkty[0]!;

    // Bez tego pominięty EAN stałby się niewidzialny: zostałby pusty wiersz bez śladu,
    // że w cenniku EAN w ogóle był i dlaczego go odrzucono.
    expect(produkt.eanRaw, "surowa wartość z cennika").toBe(EAN_SUROWY);
    expect(produkt.eanSourceStatus, "powód pustego pola").toBe("scientific_notation_uncertain");
    expect(produkt.eanCandidates, "co dało rozwinięcie").toBe(KANDYDACI);
    expect(produkt.eanIsValid).toBe(0);
  });

  it("ostrzeżenie w stagingu jest nietknięte — staging zachowuje się jak produkcja", () => {
    const { oryginal, port } = obieStrony(pozycjaZEanem("scientific_notation_uncertain"));

    // Karta 14i tnie WYŁĄCZNIE przy zapisie do katalogu. Silnik i staging zostają, więc
    // tabela `staging_items` musi być po obu stronach identyczna — bez żadnego wyjątku.
    expect(port.staging).toEqual(oryginal.staging);
  });
});

describe("14i — kontrole negatywne: warunek nie może być szerszy, niż decyzja Ani", () => {
  it("status `ok` — EAN zapisuje się normalnie, port == oryginał", () => {
    const { oryginal, port } = obieStrony(pozycjaZEanem("ok"));

    expect(port.produkty[0]!.ean, "poprawny EAN nie może zniknąć").toBe(EAN_ROZWINIETY);
    expect(port.produkty).toEqual(oryginal.produkty);
  });

  it("status `no_valid_candidate` — bez zmian względem produkcji", () => {
    // Tu oryginał i tak nie ma czego zapisać (silnik zostawia `ean` pusty), więc obie strony
    // dają NULL. Asercja pilnuje, że nie „naprawiliśmy" przy okazji sąsiedniej gałęzi.
    const { oryginal, port } = obieStrony(pozycjaZEanem("no_valid_candidate", null));

    expect(port.produkty).toEqual(oryginal.produkty);
  });

  it("status pusty (brak informacji o EAN-ie) — bez zmian względem produkcji", () => {
    const { oryginal, port } = obieStrony(pozycjaZEanem(null));

    expect(port.produkty[0]!.ean).toBe(EAN_ROZWINIETY);
    expect(port.produkty).toEqual(oryginal.produkty);
  });
});

describe("14i — grupowanie `kod_importu` po EAN-ie musi zostać NIETKNIĘTE", () => {
  /**
   * ⚠ REGRESJA WYKRYTA W CODE REVIEW TEGO TICKETA — najważniejszy test w tym pliku.
   *
   * `assignKodImportu()` (`legacy/bridge_ext.cjs:164-167`) nadaje produktom z różnych magazynów
   * WSPÓLNY sześciocyfrowy `kod_importu` (wielomagazynowość Selly), grupując je po kluczu
   * `EAN:<ean>` — ale tylko gdy `ean` jest niepusty ORAZ `eanIsValid === 1`. Zapis naukowy
   * z POPRAWNĄ sumą kontrolną spełnia oba warunki, więc jest realnym przypadkiem, a nie
   * teoretycznym: `8,05997E+12` rozwija się do `8059970000000`, którego suma kontrolna się
   * zgadza (ta sama wartość stoi w `test/silnik.gate.test.ts`).
   *
   * Pierwsza wersja tej karty zerowała `ean` na `rekord` PRZED `assignKodImportu()` — przez co
   * grupowanie spadało na gałąź zapasową `marka|rozmiar|bieznik|nazwa`, a produkt LOSOWAŁ nowy
   * numer zamiast odziedziczyć numer swojego odpowiednika z innego magazynu. To byłoby DRUGIE,
   * nieobjęte decyzją Ani odstępstwo. Dlatego cięcie przeniesiono na `doZapisu`, tuż przed
   * zapisem. Ten test pilnuje, żeby nikt go nie przesunął z powrotem.
   */
  const EAN_Z_POPRAWNA_SUMA = "8059970000000";
  const NUMER_GRUPY = "424242";

  /** Ten sam produkt w innym magazynie — ma już numer grupy, nadany przy wcześniejszym imporcie. */
  const innyMagazyn = [
    produkt({
      kod: "P0-INNY-MAGAZYN",
      ean: EAN_Z_POPRAWNA_SUMA,
      eanIsValid: 1,
      kodImportu: NUMER_GRUPY,
    }),
  ] as unknown as Wiersz[];

  const pozycjaNaukowa = pozycjaZEanem("scientific_notation_uncertain", EAN_Z_POPRAWNA_SUMA, 1);

  it("produkt dziedziczy numer grupy po innym magazynie — dokładnie jak produkcja", () => {
    const { oryginal, port } = obieStrony(pozycjaNaukowa, innyMagazyn);

    const nowyOryginal = oryginal.produkty.find((p) => p.kod === "P1")!;
    const nowyPort = port.produkty.find((p) => p.kod === "P1")!;

    // Najpierw dowód, że produkcja NAPRAWDĘ dziedziczy tu numer — inaczej test nie mierzyłby nic.
    expect(nowyOryginal.kodImportu, "oryginał dziedziczy numer grupy po EAN-ie").toBe(NUMER_GRUPY);

    // I właściwa asercja: nasze odstępstwo NIE MOŻE tego zepsuć.
    expect(nowyPort.kodImportu, "grupowanie po EAN-ie jest poza zakresem decyzji Ani").toBe(
      NUMER_GRUPY,
    );
  });

  it("…a jedyną różnicą wobec produkcji dalej jest samo pole `ean`", () => {
    const { oryginal, port } = obieStrony(pozycjaNaukowa, innyMagazyn);

    expect(port.produkty.map((p) => p.kod)).toEqual(oryginal.produkty.map((p) => p.kod));

    // Produkt z innego magazynu nie może zostać tknięty — akceptacja dotyczy wyłącznie `P1`.
    expect(port.produkty.find((p) => p.kod === "P0-INNY-MAGAZYN")).toEqual(
      oryginal.produkty.find((p) => p.kod === "P0-INNY-MAGAZYN"),
    );

    const { ean: _o, ...resztaOryginalu } = oryginal.produkty.find((p) => p.kod === "P1")!;
    const { ean: _p, ...resztaPortu } = port.produkty.find((p) => p.kod === "P1")!;
    expect(resztaPortu).toEqual(resztaOryginalu);

    // Samo odstępstwo dalej obowiązuje — mimo poprawnej sumy kontrolnej EAN ma być pusty.
    expect(port.produkty.find((p) => p.kod === "P1")!.ean).toBeNull();
    expect(oryginal.produkty.find((p) => p.kod === "P1")!.ean).toBe(EAN_Z_POPRAWNA_SUMA);
  });
});
