## Ticket
`160-DOCS-roadmapa-model-cutoveru` — roadmapa po zmianie modelu cutoveru (PR #176)

## Summary
Ticket koordynacyjny, **wyłącznie `docs/rebuild-roadmap.md`, zero zmian w `rebuild/` i `contract/`**. PR #176 zmienił model cutoveru (nowy rozdział 0 w `docs/cutover.md`), przez co §6a i §6b roadmapy — dopisane godzinę wcześniej ticketem 158 — zaczęły opisywać plan, którego już nie ma. CLAUDE.md pkt 4: roadmapa koryguje siebie, zamiast być korygowana promptem.

## Co się zmieniło w modelu
| Było | Jest (decyzja użytkownika 2026-09-24) |
|---|---|
| podmiana kodu na serwerze produkcyjnym + migracje na żywej `data.db` | **przełączenie domeny** — środowisko testowe staje się produkcją |
| weryfikacja schematu i próba migracji przed oknem | **baza już zweryfikowana** (ticket 113) |
| rozdz. 5 = procedura okna · rozdz. 7 = rollback | oba **nierealizowane**, zostają jako materiał źródłowy |
| rozdz. 8 „po cutoverze" | wykonywane **PRZED** przełączeniem, w trakcie testów |
| — | nowy warunek wstępny: `159-FEATURE-gri-upload-csv-xlsx` |

## Zmiany w roadmapie
- **§4** — „nic nie jest w toku" przestało być prawdą (doszedł ticket 159); dopisek o zmianie modelu.
- **§1a** — wiersz „PRODUKCJA (nowa) = `main` po cutoverze" oznaczony jako czekający na decyzję (patrz niżej).
- **§6** — akapit o cutoverze („big-bang, migracje 001→003, rollback") zastąpiony opisem nowego modelu.
- **§6a przepisane** — „Przed przełączeniem domeny": cztery skutki zmiany modelu, weryfikacja schematu **zdjęta** z listy (zrobiona), audyt §3a przeformułowany, **nowy wiersz: ticket 159**, okno → przełączenie domeny.
- **§6b Blok 1 przepisany** — rozdzielony na „przed przełączeniem" i „na moment przełączenia i po"; rollback oznaczony jako nierealizowany.

## Dwie rzeczy do rozstrzygnięcia, których zmiana modelu nie zamyka
1. **Świeżość danych** — baza środowiska testowego to kopia produkcji z 23.09. „Baza zweryfikowana" dotyczy SCHEMATU, nie DANYCH w dniu przełączenia. Dociągamy dane ze starego środowiska czy startujemy ze stanu z 23.09? (Ryzyko wskazane wprost w `cutover.md` §0 — przenoszę je do roadmapy, nie rozstrzygam.)
2. **Co jest stagingiem po przełączeniu** — jeśli dzisiejszy staging staje się produkcją, auto-deploy z `develop` szedłby prosto na żywy panel, a ścieżka `develop → staging → test → produkcja` (D9) przestaje istnieć.

## Ustalenie dla przyszłego ticketu 159 (w `raport.md`)
Zmierzone w kodzie: parser `mo10_gri.cjs:19-51` rozpoznaje XLSX **po sygnaturze bajtów**, `parsujBufor` zachowuje rozszerzenie, trasa uploadu nie filtruje rozszerzeń, przycisk „Wgraj plik" jest dostępny dla dostawców `mail` (MO10 jest `mail`), `accept=".csv,.xml,.xlsx"`. **Ścieżka wygląda na kompletną** — ticket 159 ma zacząć od odtworzenia realnej awarii Ani, inaczej ryzykuje pustą robotę. Pomiar jest statyczny, więc nie jest to twierdzenie „to działa".

## Tests
Nie dotyczy — wyłącznie `docs/`.

## Breaking changes
None.

---
Ticket docs: `docs/tickets/160-DOCS-roadmapa-model-cutoveru/`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
