import { desc, eq } from "drizzle-orm";

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
 * Jedynym pisarzem jest IMPORT (bloki 3f-1/3f-2): błąd HTTP, błąd pobierania i ręczny upload.
 * Odczyt (`listAlerts`, `updateAlertStatus`) dołożyła Iteracja 6 razem z widokiem `/alerty`.
 *
 * Oryginał zwraca wstawiony wiersz (`.returning().get()`); nasi wołający go nie używają,
 * więc zwracamy `void`.
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

/**
 * Wiersz alertu wychodzący na zewnątrz — 7 pól, dokładnie tyle ma
 * `contract/fixtures/GET_alerts.json`.
 */
export type Alert = typeof alerts.$inferSelect;

/**
 * Port `U.listAlerts()` (`backend-index.cjs:44951-44953`):
 * `X.select().from(Ki).orderBy(Ii(Ki.data)).all()` — `Ii` to `desc`.
 *
 * Bez limitu i bez parametrów: oryginał wysyła CAŁĄ tabelę jedną gołą tablicą (nagranie
 * produkcji miało 3042 wiersze — patrz `_body_przyciete_z` w fixture). Nie dokładamy
 * limitu, bo zmieniłby kształt odpowiedzi wobec kontraktu, a widok `/alerty` grupuje
 * powtórki po stronie klienta i na obciętym zbiorze kłamałby licznikami.
 *
 * KOLEJNOŚĆ JEST CZĘŚCIĄ KONTRAKTU: `data` MALEJĄCO. Widok wyprowadza z niej „ostatnio
 * o 14:45" dla każdej grupy.
 */
export function listAlerts(db: Baza): Alert[] {
  return db.select().from(alerts).orderBy(desc(alerts.data)).all();
}

/**
 * Port `U.updateAlertStatus(t, e)` (`backend-index.cjs:44957-44961`):
 * `X.update(Ki).set({status: e}).where(se(Ki.id, t)).run()`.
 *
 * ⚠ ODTWORZONE 1:1, łącznie z tym, czego tu NIE MA (decyzja D4, ticket
 * `18-FEATURE-widok-alerty`):
 *  - **brak sprawdzenia, czy wiersz istnieje** — UPDATE na nieznanym `id` jest cichym
 *    no-opem, a trasa i tak oddaje `{ok:true}`. To nie jest przeoczenie: brak nagranej
 *    próbki dla `PATCH` sprawia, że kod oryginału jest jedynym wzorcem kształtu.
 *  - **brak walidacji `status`** — kolumna `alerts.status` nie ma `CHECK`, oryginał wstawia
 *    dowolny napis. Zawężenie żyje wyłącznie w typie `StatusAlertu` po stronie wołających.
 */
export function updateAlertStatus(db: Baza, id: number, status: string): void {
  db.update(alerts).set({ status }).where(eq(alerts.id, id)).run();
}
