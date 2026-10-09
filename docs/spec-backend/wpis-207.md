# Wpis do spec-backend od ticketu 207 (zakładka „Nieobecne w imporcie”) · 2026-10-10

NOWA FUNKCJA, SPOZA PRODUKCJI (decyzja użytkowniczki 2026-10-10).

- **Co trafia na listę:** pozycje wstrzymane AUTOMATYCZNIE (wpis w `product_auto_suspensions`, czyli zniknęły z kompletnego cennika) po progu dni od `suspended_at`:
  7 dni domyślnie, **0 dla MO7 (Nokian) i MO8 (Trelleborg)** — roczne cenniki, zniknięcie z kompletnego pliku jest ostateczne. Datą odniesienia jest data wstrzymania, nie
  kalendarz importów, więc reguła działa tak samo dla dostawców wgrywanych codziennie, co tydzień i raz w roku. Ręcznie wstrzymanych kart lista NIE obejmuje.
  `suspended_at` nie przesuwa się przy kolejnych wstrzymaniach (`zapiszAutomatyczneWstrzymanie`), a zdejmowane jest przy powrocie pozycji do pliku.
- **Trasy** (`routes/nieobecne.ts`, za `requireAuth`, widoczne dla każdego zalogowanego — aplikacja nie ma ról): `GET /api/nieobecne`, `POST /api/nieobecne/usun {ids}`,
  `POST /api/nieobecne/przywroc {ids}`. Serwer sam przelicza listę; `ids` spoza niej są pomijane.
- **Usuń** (`usunKarteZArchiwum`, wspólne z krokiem usuwania kart AUTO z ticketu 206): pełny wiersz karty + poprawki → `products_scalone` („USUNIĘTA (nieobecna w imporcie)”),
  wpis `audit_log` `usuniecie_nieobecnej`, sprzątanie poprawek/`staging_*`/wstrzymań. Mapowanie Selly zostaje — Tor 3 usunie produkt ze sklepu po kontroli tożsamości.
- **Przywróć jako aktywne:** status `aktywny`, zdjęte automatyczne wstrzymanie i dowody nieobecności, audyt `przywrocenie_nieobecnej`.
  ⚠ Jeśli pozycji nadal nie ma w pliku, KOLEJNY kompletny import wstrzyma ją ponownie (z nową datą) i po progu wróci na listę.
- **Frontend:** zakładka „Nieobecne w imporcie (N)” w Katalogu (`katalog/NieobecneWImporcie.tsx`): zaznaczanie, „Przywróć jako aktywne”, „Usuń” z potwierdzeniem i liczbą.
- **Nie zrobione:** jednorazowy krok wdrożenia usuwający od razu wszystkie kwalifikujące się pozycje (decyzja 1.B) — patrz opis PR.
