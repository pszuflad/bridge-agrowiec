// Wspólny kształt wzorca charakteryzacji silnika — używany przez skrypt nagrywający
// (scripts/charakteryzacja-silnik-nagraj.mjs) i przez test porównujący port z oryginałem.
//
// Jedno miejsce, bo obie strony MUSZĄ normalizować tak samo. Gdyby normalizacja rozjechała się
// między nagraniem a porównaniem, test byłby zielony z powodu, który nie ma nic wspólnego
// z wiernością portu.

/** Dostawcy objęci charakteryzacją — ci sami, co w gate 3a. */
export const KODY_DOSTAWCOW = ["MO1", "MO2", "MO3", "MO4", "MO5", "MO6", "MO7", "MO8", "MO9", "MO10"];

/**
 * Znacznik podstawiany za `utworzono`.
 *
 * Oryginał bierze JEDEN `new Date().toISOString()` na cały przebieg (`:47585`) i wstawia go
 * do każdego wiersza. Wartości nie da się porównać między przebiegami, ale JEDNOLITOŚĆ już tak
 * — i to jest tu realna własność do obronienia, bo 3b też ją odtwarzała.
 */
export const UTWORZONO_WZORCOWE = "<utworzono: jeden znacznik na przebieg>";

/**
 * Pola wiersza `staging_items` porównywane pole po polu. Kolejność jak w oryginale
 * (`backend-index.cjs:47715-47737`), żeby diff czytało się jak kod źródłowy.
 */
export const POLA_WIERSZA = [
  "typZmiany",
  "kod",
  "nazwa",
  "dostawca",
  "magazyn",
  "magazynRaw",
  "stanStary",
  "stanNowy",
  "cenaZakupuStara",
  "cenaZakupuNowa",
  "cenaSprzedazyNowa",
  "zmianaPct",
  "ostrzezenie",
  "powod",
  "snapshotJson",
  "eanRaw",
  "eanIsValid",
  "eanSourceStatus",
  "eanCandidates",
  "edytowanePola",
  "utworzono",
];

/**
 * `typZmiany` produkowane przez pętlę wycofań (`:47807-47847`), która należy do 3d.
 * Wyłączamy je z porównania świadomie — nie „bo się nie zgadza", tylko dlatego, że 3c
 * celowo tej pętli nie ma. Test wypisuje, ile wierszy odrzucił.
 */
export const TYP_POZA_ZAKRESEM_3C = "wycofana";

/** Sprowadza wiersz stagingu do porównywalnego kształtu: stałe pola, znormalizowany znacznik. */
function normalizujWiersz(wiersz) {
  const wynik = {};
  for (const pole of POLA_WIERSZA) {
    wynik[pole] = pole === "utworzono" ? UTWORZONO_WZORCOWE : (wiersz[pole] ?? null);
  }
  return wynik;
}

/**
 * Rozdziela wywołania `updateProduct` z pętli głównej na te w zakresie 3c i te w 3d.
 *
 * W pętli głównej `tk()` woła `updateProduct` w dwóch miejscach: reset `nieobecnoscPodRzad`
 * przy dopasowaniu (`:47702`, zakres 3c) i zapis auto-zatwierdzenia (`:47800`, zakres 3d).
 * Ten drugi ZAWSZE niesie `dataAktualizacji` (`:47790`), pierwszy nigdy — i to jest jedyny
 * pewny rozróżnik po kształcie patcha.
 */
function rozdzielPetleGlowna(aktualizacje) {
  const resetyDopasowania = [];
  const autoZatwierdzenia = [];
  for (const wpis of aktualizacje) {
    if ("dataAktualizacji" in wpis.patch) autoZatwierdzenia.push(wpis);
    else resetyDopasowania.push(wpis);
  }
  return { resetyDopasowania, autoZatwierdzenia };
}

/**
 * Normalizuje cały przebieg silnika do postaci zapisywanej we wzorcu.
 *
 * Odsiewa to, czego 3c świadomie nie ma, i raportuje odsiane osobno, zamiast po cichu gubić:
 * wiersze `wycofana`, licznik `wycofane`, wywołania `updateProduct` z pętli wycofań i zapisy
 * auto-zatwierdzenia. `doStagingu` oryginał liczy jako długość CAŁEGO bufora razem
 * z wycofaniami (`:47850`), więc obok surowej wartości zapisujemy tę policzoną bez nich —
 * to ta druga jest porównywalna z 3c.
 */
export function normalizujPrzebieg(przebieg) {
  const wszystkie = przebieg.staging.map(normalizujWiersz);
  const wZakresie = wszystkie.filter((w) => w.typZmiany !== TYP_POZA_ZAKRESEM_3C);
  const wycofane = wszystkie.length - wZakresie.length;

  // `doStagingu` to długość BUFORA (`:47850`), a nie liczba zapisanych wierszy — te dwie
  // wartości rozjeżdżają się, gdy addStaging zdeduplikuje powtórzoną pozycję.
  const buforWZakresie = przebieg.wywolaniaStagingu.filter(
    (w) => w.typZmiany !== TYP_POZA_ZAKRESEM_3C,
  ).length;

  const { wycofane: licznikWycofanych, doStagingu, ...licznikiWZakresie } = przebieg.statystyki;
  const { resetyDopasowania, autoZatwierdzenia } = rozdzielPetleGlowna(przebieg.fazy.petlaGlowna);

  return {
    dostawca: przebieg.dostawca,
    wejscie: przebieg.wejscie,
    katalog: przebieg.katalog,
    statystyki: { ...licznikiWZakresie, doStagingu: buforWZakresie },
    pozaZakresem3c: {
      opis:
        "Pętla wycofań (backend-index.cjs:47807-47847) i EFEKTY auto-zatwierdzania (:47791-47806) " +
        "należą do 3d — 3c liczy decyzję auto-zatwierdzenia, ale jej nie wykonuje (plan.md D5). " +
        "Odsiane tutaj, żeby porównanie mierzyło wyłącznie zakres 3c.",
      wycofaneWiersze: wycofane,
      wycofaneLicznik: licznikWycofanych,
      doStaginguZWycofaniami: doStagingu,
      wierszyPoDeduplikacji: wZakresie.length,
      aktualizacjeZPetliWycofan: przebieg.fazy.petlaWycofan.length,
      zapisyAutoZatwierdzenia: autoZatwierdzenia.length,
    },
    staging: wZakresie,
    skasowane: [...przebieg.skasowane].sort((a, b) => a - b),
    /** Wyłącznie reset `nieobecnoscPodRzad` przy dopasowaniu — jedyna mutacja produktu w 3c. */
    resetyNieobecnosci: [...resetyDopasowania].sort((a, b) => a.id - b.id),
  };
}
