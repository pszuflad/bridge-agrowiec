import type { Baza } from "../db/index.js";
import { alerts } from "../db/schema.js";

/**
 * Poziom alertu — wartości używane przez import w oryginale.
 *
 * `info` przy powodzeniu (`Ręczny upload`, `Synchronizacja`), `ostrzezenie` przy awarii
 * pobierania (`Błąd HTTP`, `Błąd pobierania` — te dochodzą w 3f-2). Kolumna w bazie jest
 * zwykłym tekstem bez CHECK-a, więc zawężenie żyje wyłącznie w typie.
 */
export type PoziomAlertu = "info" | "ostrzezenie" | "blad";

/** Stan alertu. Import pisze `rozwiazany` dla zdarzeń informacyjnych, `nowy` dla awarii. */
export type StatusAlertu = "nowy" | "rozwiazany";

export type NowyAlert = {
  poziom: PoziomAlertu;
  typ: string;
  opis: string;
  dostawca?: string | null;
  status?: StatusAlertu;
  /** ISO 8601. Podawana przez wołającego, żeby jeden import miał jeden znacznik czasu. */
  data?: string;
};

/**
 * Zapis alertu — port `U.addAlert` (backend-index.cjs:44954).
 *
 * ⚠ To jest CAŁE repo alertów w tej iteracji: sam zapis. Odczyt (`listAlerts`,
 * `updateAlertStatus`) należy do Iteracji 6 razem z widokiem `/alerty` i celowo nie
 * powstaje tutaj — luka „alerty pisane przez import nie miały właściciela" dotyczyła
 * wyłącznie strony piszącej (roadmapa §5, blok 3f, LUKA 2).
 *
 * Oryginał zwraca wstawiony wiersz (`.returning().get()`); nasi wołający go nie używają,
 * więc zwracamy `void` — dokładanie odczytu tylnymi drzwiami zaciemniłoby ten podział.
 */
export function zapiszAlert(db: Baza, alert: NowyAlert): void {
  db.insert(alerts)
    .values({
      poziom: alert.poziom,
      typ: alert.typ,
      opis: alert.opis,
      dostawca: alert.dostawca ?? null,
      status: alert.status ?? "nowy",
      data: alert.data ?? new Date().toISOString(),
    })
    .run();
}
