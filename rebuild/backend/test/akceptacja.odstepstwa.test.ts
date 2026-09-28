/**
 * ODSTĘPSTWO 14i — ZDJĘTE. Ten plik pilnuje, że ZOSTAŁO zdjęte i co weszło w jego miejsce.
 *
 * HISTORIA. Karta 14i (ticket 58) wprowadziła świadome odstępstwo: EAN zepsuty notacją
 * naukową miał trafiać do katalogu jako PUSTE pole, zamiast — jak w produkcji — jako wartość
 * rozwinięta (`6,41944E+12` → `6419440000000`), która wygląda na prawdziwy numer, a nim nie
 * jest. Decyzja Ani z 2026-09-18, `docs/rebuild-backlog.md` #11.
 *
 * CO SIĘ ZMIENIŁO. Decyzja **D4** (Staging v2, ticket 129) rozwiązuje ten sam problem
 * WCZEŚNIEJ i ostrzej: taka pozycja w ogóle NIE JEST WPUSZCZANA do akceptacji.
 * `checkAcceptance` (`staging_policy.cjs:197`) odsyła ją do ręcznej poprawki numeru
 * komunikatem „Błędny EAN: popraw numer w edycji zgłoszenia przed akceptacją.". Ciche
 * zapisywanie pustego pola przestało być potrzebne i zostało z `akceptacja.ts` usunięte.
 *
 * DLATEGO TEN PLIK MA DZIŚ DWA ZADANIA, oba negatywne wobec przeszłości:
 *  1. **Bazowa akceptacja jest znów IDENTYCZNA z produkcją** — żadnego pola wyjątku. Gdyby
 *     ktoś przywrócił zerowanie `ean`, asercja „port == oryginał" zapali.
 *  2. **Blokada D4 naprawdę działa** — pozycja z zapisem naukowym nie przechodzi przez
 *     `sprawdzAkceptacje`, więc do bazowej akceptacji nigdy nie dociera.
 *
 * METODA ZOSTAJE TA SAMA CO W CHARAKTERYZACJI i to jest sens tego pliku: nie wpisujemy
 * ręcznie, co „powinno wyjść". Uruchamiamy oryginał i nasz port na dwóch identycznie
 * zasianych bazach i porównujemy stan. Zmieniło się tylko to, czego dowodzimy: kiedyś
 * „różnią się dokładnie jednym polem", dziś „nie różnią się niczym".
 */
import { afterEach, describe, expect, it } from "vitest";

import { zatwierdzPozycjeStagingu } from "../src/import/akceptacja.js";
import { sprawdzAkceptacje } from "../src/import/polityka/blokady.js";
import { products, stagingItems } from "../src/db/schema.js";
import { stworzTestowaBaze, type TestowaBaza } from "./gate/baza.js";
import { zaladujOryginal } from "./charakteryzacja/akceptacja/oryginal.mjs";
import { pozycja, produkt } from "./charakteryzacja/akceptacja/scenariusze.mjs";

type Wiersz = Record<string, unknown>;

/** Wartości z realnego przypadku — te same, na których stoi scenariusz `ean-notacja-naukowa`. */
const EAN_SUROWY = "6,41944E+12";
const EAN_ROZWINIETY = "6419440000000";
const KANDYDACI = JSON.stringify([EAN_ROZWINIETY]);

/** EAN o POPRAWNEJ cyfrze kontrolnej — rozwinięcie `8,05997E+12`. Używany jako kontrola negatywna. */
const EAN_Z_POPRAWNA_SUMA = "8059970000000";

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

describe("14i zdjęte — bazowa akceptacja zapisuje EAN dokładnie jak produkcja", () => {
  it("port zapisuje rozwinięty EAN, tak samo jak oryginał — odstępstwa już nie ma", () => {
    const { oryginal, port } = obieStrony(pozycjaZEanem("scientific_notation_uncertain"));

    expect(oryginal.produkty).toHaveLength(1);
    expect(port.produkty).toHaveLength(1);

    // Dowód, że oryginał naprawdę to robi — bez tego test nie mierzyłby niczego.
    expect(oryginal.produkty[0]!.ean, "oryginał zapisuje rozwinięty zapis naukowy").toBe(
      EAN_ROZWINIETY,
    );

    // I właściwa asercja: po zdjęciu 14i port robi TO SAMO.
    expect(port.produkty[0]!.ean, "14i zdjęte decyzją D4 — port nie zeruje już EAN-u").toBe(
      EAN_ROZWINIETY,
    );
  });

  it("żadnego pola wyjątku — CAŁY produkt jest identyczny jak u produkcji", () => {
    const { oryginal, port } = obieStrony(pozycjaZEanem("scientific_notation_uncertain"));

    // Kiedyś zdejmowaliśmy tu `ean` przed porównaniem. Dziś porównujemy wszystko:
    // to jest dowód, że odstępstwo zniknęło w całości, a nie przesunęło się gdzie indziej.
    expect(port.produkty[0]!).toEqual(oryginal.produkty[0]!);
  });

  it("pola towarzyszące dalej opisują pochodzenie EAN-u", () => {
    const { port } = obieStrony(pozycjaZEanem("scientific_notation_uncertain"));
    const produkt = port.produkty[0]!;

    expect(produkt.eanRaw, "surowa wartość z cennika").toBe(EAN_SUROWY);
    expect(produkt.eanSourceStatus, "ślad po zapisie naukowym").toBe(
      "scientific_notation_uncertain",
    );
    expect(produkt.eanCandidates, "co dało rozwinięcie").toBe(KANDYDACI);
    expect(produkt.eanIsValid).toBe(0);
  });

  it("staging zachowuje się jak produkcja", () => {
    const { oryginal, port } = obieStrony(pozycjaZEanem("scientific_notation_uncertain"));
    expect(port.staging).toEqual(oryginal.staging);
  });
});

describe("D4 — to, co zastąpiło 14i: pozycja z zapisem naukowym NIE WCHODZI do akceptacji", () => {
  /**
   * ⭐ SEDNO ZMIANY. Bazowa akceptacja (wyżej) zachowuje się jak produkcja, bo w produkcji
   * też nigdy nie dostaje takiej pozycji — bramka odrzuca ją wcześniej. Ten test pokazuje
   * tę bramkę: ten sam wiersz, który wyżej przechodzi przez `zatwierdzPozycjeStagingu`,
   * przez `sprawdzAkceptacje` NIE przechodzi.
   */
  it("blokada oddaje 409 i DOSŁOWNY komunikat z `staging_policy.cjs:197`", () => {
    const baza = stworzTestowaBaze();
    otwarte.push(baza);

    const wiersz = pozycjaZEanem("scientific_notation_uncertain") as Wiersz;
    const snapshot = JSON.parse(String(wiersz.snapshotJson)) as Record<string, unknown>;
    // Pozycja poza tym KOMPLETNA wobec Staging v2 — żeby paść na EAN-ie, a nie na
    // „starym imporcie" czy nieaktualnym katalogu.
    snapshot._policyVersion = 2;
    snapshot._catalogVersion = null;
    wiersz.snapshotJson = JSON.stringify(snapshot);

    const id = zasiej(baza, wiersz);

    expect(() => sprawdzAkceptacje(baza.db, id)).toThrowError(
      "Błędny EAN: popraw numer w edycji zgłoszenia przed akceptacją.",
    );

    try {
      sprawdzAkceptacje(baza.db, id);
    } catch (e) {
      expect((e as { status?: number }).status, "`fail()` zawsze daje 409").toBe(409);
    }
  });

  it("poprawny EAN przechodzi przez bramkę — blokada nie jest szersza, niż ma być", () => {
    const baza = stworzTestowaBaze();
    otwarte.push(baza);

    // ⚠ `EAN_ROZWINIETY` (`6419440000000`) NIE nadaje się na kontrolę negatywną: to wynik
    // rozwinięcia zapisu naukowego i jego cyfra kontrolna się NIE zgadza, więc `validateEan`
    // odrzuca go niezależnie od notacji. Bierzemy numer o poprawnej sumie — ten sam,
    // na którym stoi niżej test grupowania `kod_importu`.
    const wiersz = pozycjaZEanem("ok", EAN_Z_POPRAWNA_SUMA, 1) as Wiersz;
    const snapshot = JSON.parse(String(wiersz.snapshotJson)) as Record<string, unknown>;
    snapshot._policyVersion = 2;
    snapshot._catalogVersion = null;
    snapshot.eanRaw = EAN_Z_POPRAWNA_SUMA;
    wiersz.snapshotJson = JSON.stringify(snapshot);

    const id = zasiej(baza, wiersz);

    expect(() => sprawdzAkceptacje(baza.db, id)).not.toThrow();
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

  it("…a produkt jest poza tym identyczny jak u produkcji — bez pola wyjątku", () => {
    const { oryginal, port } = obieStrony(pozycjaNaukowa, innyMagazyn);

    expect(port.produkty.map((p) => p.kod)).toEqual(oryginal.produkty.map((p) => p.kod));

    // Produkt z innego magazynu nie może zostać tknięty — akceptacja dotyczy wyłącznie `P1`.
    expect(port.produkty.find((p) => p.kod === "P0-INNY-MAGAZYN")).toEqual(
      oryginal.produkty.find((p) => p.kod === "P0-INNY-MAGAZYN"),
    );

    // Po zdjęciu 14i porównujemy CAŁY wiersz, razem z `ean`.
    expect(port.produkty.find((p) => p.kod === "P1")!).toEqual(
      oryginal.produkty.find((p) => p.kod === "P1")!,
    );
    expect(port.produkty.find((p) => p.kod === "P1")!.ean).toBe(EAN_Z_POPRAWNA_SUMA);
  });
});
