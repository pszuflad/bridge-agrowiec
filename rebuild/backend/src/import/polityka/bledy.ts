// Błędy blokujące import — bezpieczeństwo źródła (#103).
//
// W oryginale wszystkie cztery to gołe `new Error(...)` bez pola `.status`
// (`staging_policy.cjs:336, :337, :458, :460`), w odróżnieniu od `fail()` (`:81`), które
// ustawia 409 na ścieżce akceptacji. Trasa importu w produkcji łapie je dopiero na swoim
// poziomie: `POST /api/dostawcy/:kod/upload` oddaje 500 z treścią wyjątku, a synchronizacja
// z URL (`L4()`) w ogóle nie rzuca — zwraca `{ok:false, error}` z kodem 200.
//
// ⚠ ODSTĘPSTWO ŚWIADOME (D-130.4, kontynuacja D7): u nas wszystkie blokady źródła dają
// **400**, tak jak istniejące `PustyImportBlad` i `BladCennika`. Powód: 500 znaczy „backend
// się zepsuł", a zły plik dostawcy to normalna, przewidziana sytuacja, o której Marta ma
// dostać czytelny komunikat. Klasy są osobne, żeby trasa mogła je rozróżnić bez parsowania
// treści komunikatu.
//
// Treść komunikatów jest DOSŁOWNA z oryginału — to ona trafia do panelu.

/**
 * Import bez ani jednej pozycji — ŚWIADOME ODSTĘPSTWO od oryginału (D7).
 *
 * Produkcja puszcza pusty wsad prosto do `tk()`. Skutek: każda pozycja dostawcy dostaje +1 do
 * `nieobecnosc_pod_rzad`, a po trzech takich przebiegach cały jego katalog zostaje wycofany
 * (backlog #8). Od resyncu 23.09 `feed_safety.attach()` wykrywa pusty cennik wcześniej,
 * ale kończy się tym samym wyjątkiem i tą samą odpowiedzią 400 — dwa bezpieczniki na tę samą
 * sytuację mają dawać jeden komunikat.
 *
 * ⚠ Komunikat jest HISTORYCZNY (nasz, nie z produkcji) i celowo zachowany: Ania i Marta znają
 * go z dotychczasowej wersji. Oryginał w tym miejscu mówi „Pusty cennik. Zachowano katalog
 * i staging bez zmian." — decyzja D-130.4 zostawia nasze brzmienie.
 */
export class PustyImportBlad extends Error {
  constructor(kodDostawcy: string) {
    super(
      `Nie ma ani jednej pozycji do zaimportowania dla ${kodDostawcy} — import przerwany. ` +
        `Sprawdź, czy plik ma właściwy format.`,
    );
    this.name = "PustyImportBlad";
  }
}

/**
 * Parser zgłosił błędy odczytu — `staging_policy.cjs:336`.
 *
 * Blokuje CAŁY import, zamiast po cichu przełączyć się na stary format. Wcześniej taki
 * cichy fallback był i to on produkował fałszywe wycofania (#103).
 */
export class BladOdczytuCennikaBlad extends Error {
  constructor() {
    super("Cennik zawiera błędy odczytu. Zachowano katalog i staging bez zmian.");
    this.name = "BladOdczytuCennikaBlad";
  }
}

/**
 * Cennik mniejszy niż 80% historycznego maksimum — `staging_policy.cjs:458`.
 *
 * Próg liczony z `supplier_feed_state.max_item_count`, które NIGDY nie maleje (repo I15.4a
 * podnosi je przez `MAX(…)`). Bez tej blokady jeden obcięty plik dostawcy wystawiłby cały
 * jego katalog na wycofanie.
 */
export class CennikPodejrzanieMalyBlad extends Error {
  constructor(
    readonly liczbaPozycji: number,
    readonly minimum: number,
  ) {
    super(
      `Cennik jest podejrzanie mały (${liczbaPozycji} zamiast co najmniej ${minimum}). ` +
        `Import zatrzymany, bez zmiany katalogu i stagingu.`,
    );
    this.name = "CennikPodejrzanieMalyBlad";
  }
}

/**
 * Większości oznaczeń nie udało się dopasować do katalogu — `staging_policy.cjs:459-461`.
 *
 * Warunek: znany stan dostawcy, co najmniej 20 pozycji i mniej niż połowa rozpoznanych.
 * Typowa przyczyna to zmiana schematu kodów u dostawcy — import zatrzymuje się, zamiast
 * potraktować cały katalog jako nieobecny.
 */
export class CennikMasowoNierozpoznanyBlad extends Error {
  constructor() {
    super(
      "Większości oznaczeń z cennika nie udało się rozpoznać. " +
        "Import zatrzymany do sprawdzenia zamiast tworzenia masowych braków.",
    );
    this.name = "CennikMasowoNierozpoznanyBlad";
  }
}

/** Czy wyjątek jest blokadą źródła, czyli sytuacją „zły plik", a nie awarią backendu. */
export function jestBlokadaZrodla(e: unknown): boolean {
  return (
    e instanceof PustyImportBlad ||
    e instanceof BladOdczytuCennikaBlad ||
    e instanceof CennikPodejrzanieMalyBlad ||
    e instanceof CennikMasowoNierozpoznanyBlad
  );
}
