// Wspólny filtr pól edytowalnych dla tras mutacji.
//
// PO CO TO ISTNIEJE: trasy `PATCH` w oryginale wrzucają ciało żądania wprost do `SET`, bez
// żadnej listy (`X.update(…).set(e)`), więc każdy zalogowany użytkownik mógł nadpisać dowolną
// kolumnę — łącznie z wyliczanymi. Pełny rozbiór: `docs/rebuild-backlog.md` #14.
//
// Precedens jest po stronie PRODUKCJI, nie odbudowy: `PUT /api/staging/:id` (`:48598`) ma jawną
// listę ośmiu pól i pętlę `if (!r.includes(v)) continue;`. Doprowadzamy resztę tras do wzorca,
// który produkcja już stosuje — najpierw dostawcy (blok 3f-2), teraz narzuty i promocje (I4a).

/**
 * Przepuszcza ciało żądania przez listę pól edytowalnych.
 *
 * ⚠ Zwraca WYŁĄCZNIE klucze, które w ciele faktycznie były (`Object.hasOwn`). Brak klucza
 * znaczy „nie ruszaj", a nie „ustaw na null" — bez tego rozróżnienia PATCH z jednym polem
 * kasowałby wszystkie pozostałe.
 */
export function odsiejPola<K extends string>(
  cialo: unknown,
  dozwolone: readonly K[],
): Partial<Record<K, unknown>> {
  if (typeof cialo !== "object" || cialo === null) return {};
  const zrodlo = cialo as Record<string, unknown>;
  const wynik: Partial<Record<K, unknown>> = {};
  for (const pole of dozwolone) {
    if (Object.hasOwn(zrodlo, pole)) wynik[pole] = zrodlo[pole];
  }
  return wynik;
}
