# 165-BUG-rozdziel-kod-importu — rozdzielenie kod_importu dla znanych kolizji

> Status: Approved (decyzja podjęta w rozmowie z użytkownikiem, patrz Decisions)
> Branch: `fix/165-rozdziel-kod-importu`
> Worktree: `.worktrees/165-BUG-rozdziel-kod-importu`

## Ticket description

Kontynuacja ticketu 164 (naprawa nazw sklejonych opon). Użytkownik zapytał, jak rozwiązać
głębszy problem tej samej kolizji: te same 174 opony nadal dzielą `kod_importu` z innym
produktem tego samego dostawcy, co powoduje (backlog #108) pętlę synchronizacji do Selly co
15 minut — Tor 1 zapisuje ostatnio wysłaną cenę/stan per `(kod_importu, dostawca)`, więc dwa
różne produkty pod jednym `kod_importu` nadpisują sobie nawzajem zapamiętany stan w
`selly_products` i oba stale "wyglądają na zmienione".

## Context

- `docs/rebuild-backlog.md` #108: 80 grup kolizyjnych / 174 produkty (pomiar 23.09), z czego 76
  grup ma różne ceny lub stany (realna pętla). Trzy rozważane drogi: (a) naprawa danych — nowy
  `kod_importu` dla nadmiarowych produktów [ma skutek w Selly: osobne produkty/warianty]; (b)
  zostawić 1:1 [pętla trwa]; (c) zawór bezpieczeństwa w Torze 1 — WYCOFANY 23.09 przez Anię
  (bo współdzielony `kod_importu` bywa zamierzoną wielomagazynowością u RÓŻNYCH dostawców —
  to nie dotyczy naszego przypadku, gdzie kolizja jest w obrębie JEDNEGO dostawcy).
- `import/polityka/kod-importu.ts` (`nadajKodImportu`): reguła "zachowaj istniejący
  sześciocyfrowy kod_importu" jest źródłem PRZYCZYNY kolizji, ale też mechanizmem, który
  UTRZYMA naszą naprawę — raz nadany nowy numer nie zostanie już nadpisany przy imporcie.
- `selly/rest/discovery.ts`: mapowanie `selly_products` jest kluczowane `(kod_importu,
  dostawca)`. Produkt z nowym `kod_importu` nie znajdzie istniejącego wpisu i przy najbliższym
  discovery zostanie potraktowany jako NOWY produkt w Selly.
- Ten sam plik CSV z ticketu 164 (`scripts/data/164-poprawione-nazwy.csv`) ma już kolumnę
  `kod_importu` dla każdego z 174 wierszy — to gotowe źródło grup kolizyjnych, nie trzeba
  nowych danych.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

Brak (nie dotyka kontraktu). Ticket zmienia wyłącznie dane w `products.kod_importu` przez
bezpośredni zapis — nie zmienia żadnego endpointu ani kształtu odpowiedzi. Efekt widoczny
pośrednio w kolejnym cyklu synchronizacji Selly (Tor 1), ale to zachowanie już istniejącego,
niezmienionego mechanizmu dla produktu z nowym numerem grupy.

## Decisions

1. **Rozdzielić kod_importu TERAZ, dla znanych 174/80 grup** — świadoma decyzja użytkownika,
   zaakceptowany skutek: Selly przy najbliższym discovery potraktuje produkt z nowym numerem
   jako nowy produkt/wariant (dokładnie tak jak już dzieje się w Bridge). To NIE wymaga
   dodatkowego sprzątania po stronie Selly wg użytkownika — kod_importu tam służy wyłącznie do
   mapowania/wielomagazynowości.
2. **Świadome odstępstwo od 1:1**: oryginał NIE rozdziela tych kolizji (backlog #108, opcja (b)
   była status quo). To ticket 165 wprowadza rozdzielenie jako zamierzoną poprawkę, nie port.
3. **Algorytm**: w grupie (dostawca, kod_importu) z pliku CSV — PIERWSZY wiersz zachowuje
   istniejący numer, KAŻDY kolejny dostaje nowy, losowy, unikalny sześciocyfrowy numer (ten sam
   kształt co `nadajKodImportu()` dla produktów bez dopasowania).
4. **Jednorazowy skrypt migracyjny**, ta sama konwencja co `napraw-nazwy-sklejone.ts` — bez
   trwałego mechanizmu/endpointu.

## Implementation plan

1. `rebuild/backend/src/import/rozdzielKodImportu.ts` — `sparsujWierszeKolizji()` (parsowanie
   tego samego CSV, kolumny `kod_importu,dostawca,kod`) + `rozdzielKodImportu()` (grupowanie,
   przenumerowanie, idempotencja przez porównanie z bieżącym stanem).
2. `rebuild/backend/scripts/rozdziel-kod-importu.ts` — CLI wrapper, `DB_PATH=... npm run
   rozdziel-kod-importu [ścieżka-csv]`, domyślnie ten sam plik CSV z ticketu 164.
3. Wpis w `package.json` (`scripts.rozdziel-kod-importu`).
4. Testy: parsowanie, podział grupy 2-elementowej, grupy 3-elementowej (2 nowe unikalne numery),
   grupa bez kolizji (bez zmian), brak produktu w katalogu (bezpieczne pominięcie), idempotencja.
5. Automatyzacja w `tools/deploy-produkcja.sh` (jak w 164c/164d) — jednorazowe uruchomienie przy
   najbliższym deployu, bez potrzeby SSH ze strony użytkownika. Z uwzględnieniem odkrycia z 164d
   (skrypt deployu aktualizuje sam siebie w trakcie działania — zmiana ujawni się przy PIERWSZYM
   deployu, bo tym razem NIE ma pliku-znacznika, wykonuje się bezwarunkowo jak inne kroki).

## Testing strategy

- Unit/integration na tymczasowej bazie SQLite (`stworzTestowaBaze()`), bez mocków.
- Weryfikacja manualna end-to-end analogiczna do 164: zasiew kolidującej pary, uruchomienie
  skryptu, odczyt bazy.
- GATE fixtures/kontrakt: N/D.

## Out of scope

- Sprzątanie po stronie samego Selly (istniejące, wspólne wpisy) — użytkownik potwierdził, że
  Selly samo utworzy nowy produkt, bez potrzeby ręcznej interwencji.
- Zmiana logiki `nadajKodImportu()` — pozostaje bez zmian, to ona utrzyma naszą naprawę.

## Definition of done

- [x] Skrypt istnieje, czyta CSV, rozdziela grupy kolizyjne.
- [x] Testy zielone (6/6 nowych + pełny `npm test`: 1920 passed).
- [x] Lint/typecheck/build/test przechodzą.
- [ ] Automatyzacja w deploy-produkcja.sh.
- [ ] Gałąź zsynchronizowana z `origin/develop`, bramki zielone PO synchronizacji, PR `MERGEABLE`.
