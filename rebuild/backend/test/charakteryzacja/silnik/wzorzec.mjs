// Wspólny kształt wzorca charakteryzacji silnika — używany przez skrypt nagrywający
// (scripts/charakteryzacja-silnik-nagraj.mjs) i przez test porównujący port z oryginałem.
//
// Jedno miejsce, bo obie strony MUSZĄ normalizować tak samo. Gdyby normalizacja rozjechała się
// między nagraniem a porównaniem, test byłby zielony z powodu, który nie ma nic wspólnego
// z wiernością portu.
//
// ⚠ ZMIANA W 3d-1: nie ma już sekcji `pozaZakresem3c`. 3c odsiewała z porównania wiersze
// `wycofana`, licznik `wycofane` i zapisy auto-zatwierdzania, bo świadomie ich nie miała.
// 3d-1 dowozi jedno i drugie, więc WSZYSTKO wraca do porównania, a dochodzą do niego dwie
// nowe rzeczy: wiersze `historia_cen` i zmiany stanu produktów.

/** Dostawcy objęci charakteryzacją — ci sami, co w gate 3a. */
export const KODY_DOSTAWCOW = ["MO1", "MO2", "MO3", "MO4", "MO5", "MO6", "MO7", "MO8", "MO9", "MO10"];

/**
 * Znacznik podstawiany za `utworzono`.
 *
 * Oryginał bierze JEDEN `new Date().toISOString()` na cały przebieg (`:47585`) i wstawia go
 * do każdego wiersza. Wartości nie da się porównać między przebiegami, ale JEDNOLITOŚĆ już tak
 * — i to jest tu realna własność do obronienia, bo 3b też ją odtwarzała.
 *
 * Ten sam znacznik trafia do `historia_cen.zarejestrowanoAt` (`:47800` podaje tam `n`)
 * oraz do `products.dataAktualizacji` przy auto-zatwierdzeniu (`:47792`).
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

/** Sprowadza wiersz stagingu do porównywalnego kształtu: stałe pola, znormalizowany znacznik. */
function normalizujWiersz(wiersz) {
  const wynik = {};
  for (const pole of POLA_WIERSZA) {
    wynik[pole] = pole === "utworzono" ? UTWORZONO_WZORCOWE : (wiersz[pole] ?? null);
  }
  return wynik;
}

/**
 * Znacznik czasu jest jeden na przebieg i nieporównywalny między uruchomieniami, więc
 * wszędzie, gdzie występuje jako WARTOŚĆ, podstawiamy stały napis. Dotyczy
 * `historia_cen.zarejestrowanoAt` i `products.dataAktualizacji`.
 */
const znormalizujZnacznik = (wartosc, znacznikPrzebiegu) =>
  wartosc === znacznikPrzebiegu ? UTWORZONO_WZORCOWE : wartosc;

/** Wiersz `historia_cen` w kształcie wzorca. */
function normalizujHistorie(wiersz, znacznikPrzebiegu) {
  return Object.fromEntries(
    Object.entries(wiersz).map(([k, v]) => [k, znormalizujZnacznik(v, znacznikPrzebiegu)]),
  );
}

/** Zmiana stanu produktu w kształcie wzorca — z podstawionym znacznikiem w `dataAktualizacji`. */
function normalizujZmianeProduktu(wpis, znacznikPrzebiegu) {
  const zmiany = {};
  for (const [pole, { przed, po }] of Object.entries(wpis.zmiany)) {
    zmiany[pole] = {
      przed: znormalizujZnacznik(przed, znacznikPrzebiegu),
      po: znormalizujZnacznik(po, znacznikPrzebiegu),
    };
  }
  return { id: wpis.id, zmiany };
}

/**
 * Normalizuje cały przebieg silnika do postaci zapisywanej we wzorcu.
 *
 * @param przebieg.znacznikPrzebiegu wartość `new Date().toISOString()`, którą `tk()` wzięło
 *   na wejściu (`:47585`). Nie da się jej odczytać z zewnątrz, więc obie strony podają ją
 *   z wierszy stagingu — dla przebiegu, który nie zapisał ani jednego wiersza, zostaje `null`
 *   i wtedy nie ma czego normalizować.
 */
export function normalizujPrzebieg(przebieg) {
  const znacznikPrzebiegu = przebieg.znacznikPrzebiegu ?? null;

  return {
    dostawca: przebieg.dostawca,
    wejscie: przebieg.wejscie,
    katalog: przebieg.katalog,
    overridy: przebieg.overridy,
    statystyki: przebieg.statystyki,
    /**
     * `doStagingu` to długość BUFORA (`:47850`), a nie liczba zapisanych wierszy — te dwie
     * wartości rozjeżdżają się, gdy `addStaging` zdeduplikuje powtórzoną pozycję. Trzymamy
     * obie, żeby różnica była widoczna, a nie mylona z błędem.
     */
    wierszyPoDeduplikacji: przebieg.staging.length,
    staging: przebieg.staging.map(normalizujWiersz),
    skasowane: [...przebieg.skasowane].sort((a, b) => a - b),
    /** Wiersze `historia_cen` z gałęzi auto-zatwierdzania (`:47800`). */
    historiaCen: przebieg.historiaCen.map((w) => normalizujHistorie(w, znacznikPrzebiegu)),
    /**
     * Zmiany stanu produktów — obejmują OBIE ścieżki, które ruszają katalog: auto-zatwierdzenie
     * (ceny/stan/magazyn + wymiary z `applyDims`) i licznik `nieobecnoscPodRzad` (reset przy
     * dopasowaniu oraz podbicie/zerowanie w pętli wycofań).
     */
    zmianyProduktow: przebieg.zmianyProduktow.map((w) =>
      normalizujZmianeProduktu(w, znacznikPrzebiegu),
    ),
    /**
     * Ile razy `applyLinkMemory` sięgnęło do tabel pamięci linków. W `tk()` dostaje PATCH
     * (bez `kod` i bez `marka/model/rozmiar`), więc wszystkie ścieżki pamięci odpadają na
     * warunku wstępnym i wartość jest 0. Trzymamy ją we wzorcu, żeby ewentualna zmiana
     * w produkcji wyszła w diffie, zamiast przejść niezauważona.
     */
    zapytanDoPamieciLinkow: przebieg.zapytanDoPamieciLinkow,
  };
}
