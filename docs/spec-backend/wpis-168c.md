# Wpis 168 — okno „Sprawdź dopasowanie opony": zapis od razu do katalogu, własne parametry, wyjaśnienie

> Ticket 168 (2026-09-30). **Odstępstwo od produkcji — decyzja użytkowniczki.** Dotyczy
> `POST /api/staging/{id}/resolve` i `GET /api/staging/{id}/review`.

**Co było (produkcja, `staging_policy.cjs:227-250`).** `resolve` kasował zgłoszenie i zakładał NOWE
(`Ręcznie rozstrzygnięto: …`), które trzeba było osobno zaakceptować — każda taka opona była
akceptowana dwa razy. Okno nie dawało sposobu poprawienia zapisu z oferty (np. zła kolejność w
nazwie: `20.8x38 BKT TR 270 DOT 8PR TT`), więc pozycji nie dało się ani zaakceptować, ani dodać
jako osobnego produktu. Hasło z importera (`Oznaczenie wskazuje inną oponę…`) nie mówiło, co jest nie tak.

**Co jest.**
- `resolve` w jednej transakcji: `rozstrzygnijZgloszenie` → poprawki → `zatwierdzPozycjeZPolityka`
  (`import/polityka/rozstrzygniecie-z-zapisem.ts`). Odmowa akceptacji (np. błędny EAN) cofa całość.
  Odpowiedź: `{ok, kod}` — bez `id` (nie ma już drugiego zgłoszenia). Po zapisie skan nowych
  wartości atrybutów, jak po `accept`. `rozstrzygnijZgloszenie` bez zmian (charakteryzacja).
- Ciało `corrections` (opcjonalne): `nazwa|marka|model|rozmiar|dot|ean`, tylko niepuste napisy.
  Poprawki trafiają do snapshotu, `edytowane_pola` i — poza `dot` — do `manual_overrides`
  (jak `PUT /api/staging/{id}`), więc kolejny import nie cofnie nazwy do zapisu z pliku.
- `review` dostaje: `wyjasnienie: string[]` (`import/polityka/wyjasnienie.ts` — przyczyna po
  ludzku + „Import chce ustawić nazwę: … (w katalogu jest: …)"), `propozycja` (wartości z importu do
  pól poprawki) i `candidates[].produktId`. Nic nie zapisuje się w bazie — liczone przy odczycie.
- Frontend: link „Zobacz tę pozycję w katalogu" → `/katalog?szukaj=<kod>` (nowy deep link,
  czytany przy montowaniu jak `?status=`), sekcja „Popraw dane z oferty", przycisk
  „Zapisz w katalogu".

**Nie ruszone.** Gałąź „stara karta" (`choose-absence-card`) i „sprzeczne wiersze"
(`resolve-source-conflict`, wpis 2026-09-29) — bez zmian. `dot` nie ma odpowiednika w
`manual_overrides`, więc poprawiony DOT działa jednorazowo.
