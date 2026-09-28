# 162-DOCS-proces-po-cutoverze — raport

**Data:** 2026-09-24. **Typ:** DOCS. **Gałąź:** `docs/162-proces-po-cutoverze`.

## Podsumowanie

Na pytanie użytkownika „czy po cutoverze trzeba będzie coś zmienić w `/feature` i w agentach"
wykonany audyt plików procesu, a jego wynik zapisany jako **karta `PO.0` — pierwsza po
przełączeniu domeny** (decyzja użytkownika 2026-09-24). Sam ticket niczego nie przestraja.

Odpowiedź na pytanie: **tak, ale zmienia się jedna rzecz — premisa „wierne odtworzenie 1:1".**
Szkielet procesu (19 kroków, rezerwacja numeru, worktree, plan/raport/review, bramki, sync
z `develop`, `push-i-pr.sh`, ruleset, hooki) zostaje bez zmian. `reviewer` wymaga zmiany jednej
linii, `doc-checker` — jednej sekcji; mechanika obu jest niezależna od odbudowy.

## Zmiany

| Plik | Co |
|---|---|
| `docs/po-cutoverze-proces.md` | **nowy** — audyt: warunek wstępny, 5 ognisk zmiany z miejscami (plik:linia), co NIE wymaga zmian, lista zadań PO.0, trzy decyzje do postawienia, DoD |
| `docs/rebuild-backlog/wpis-162.md` | **nowy** — wpis `#162.1`, `Do nowej wersji? ✅ TAK` (decyzja użytkownika), Status `⬜ czeka na cutover` |
| `docs/rebuild-roadmap.md` | §6b Blok 2: wiersz `PO.0` na początku tabeli + akapit ⭐ + rekomendacja kolejności („PO.0 najpierw"); Blok 5: wskaźnik do audytu + adnotacja, że PO.0 stawia pod decyzję politykę `mirror/` (zmiana D9, nie jej wykonanie) |
| `docs/cutover-runbook.md` | Krok 13 („Pierwsza doba"): pozycja listy kontrolnej wskazująca PO.0, z zastrzeżeniem „nie wcześniej" |

## Co audyt wykazał (skrót — pełna treść w `docs/po-cutoverze-proces.md`)

1. **Hierarchia źródeł prawdy odwraca się.** Dziś fixtures > spec > mapa kodu > `deminified/`,
   a kod w `rebuild/` „może jeszcze nie istnieć" (`researcher.md:14`). Po cutoverze prawdą jest
   kod + testy; `deminified/`/`mirror/` to archeologia.
2. **Fixtures nie giną — zmieniają rolę** z wzorca produkcji na baseline regresji. Zmiana
   kontraktu przestaje być zakazana, staje się jawną decyzją (`openapi.yaml` + przenagranie +
   `plan.md`).
3. **GATE zostaje, ale celuje inaczej:** kontrakty zewnętrzne, które przeżywają wyłączenie starego
   Bridge — REST/CSV do Selly, formaty importu od 10 dostawców, FE↔BE.
4. **`/triaz-zmian` umiera w całości** (żywi się commitami `sync(vps)` do `mirror/`). Przed
   zamknięciem `docs/rebuild-backlog.md` trzeba potwierdzić, że żaden otwarty wpis nie zostaje
   bez nośnika — najważniejszy `#154.1`.
5. **Mechanika kart zwija się**, ale zasada „nie dopisuj na koniec współdzielonego pliku"
   **zostaje** — wynika z równoległych gałęzi, nie z odbudowy.
6. **`CLAUDE.md` dzieli się na pół:** pułapki naszego kodu zostają (Drizzle, `mode: "boolean"`,
   `UPPER()` ASCII-only, `safeAll()`, MSW), archeologia oryginału odchodzi. Jedna reguła zmienia
   status z faktu na decyzję: „nie naprawiaj schematu flag `'Tak'`, bo tryb `boolean` jest wierny
   oryginałowi" — po cutoverze wierność przestaje być uzasadnieniem.

## Weryfikacja

- `tools/stan-backlogu.sh 162` → `#162.1 · ✅ · ⬜` — wpis widoczny dla narzędzi.
- `gh pr list --state open` → 0; `tools/stan-kart.sh` → 31/31 kart ✅ — brak równoległej karty,
  więc edycja roadmapy przez tę sesję (koordynator, CLAUDE.md pkt 0) nie koliduje.
- Numer ticketa 162 z atomowej rezerwacji `.worktrees/.numery/162` (`develop` miał już 160 i 161).
- Bramki `rebuild/backend/` **nieuruchamiane** — zmiana wyłącznie w `docs/`, zero plików kodu
  w diffie. GATE: **N/D** (nie dotyka API ani kontraktu).

## Odstępstwa od planu

Brak.

## Follow-up

- **`PO.0` do wykonania po przełączeniu domeny** — `docs/po-cutoverze-proces.md` §3 jest jej listą
  zadań, §4 Definition of done.
- Trzy decyzje użytkownika zapisane jako otwarte (archiwizacja `mirror/`, przenagranie fixtures
  z nowego backendu, naprawa schematu flag `'Tak'`).
- `docs/karty/PO.0/karta.md` **nieutworzona** świadomie — D5 ticketu 158: katalogi kart zakłada
  koordynator tuż przed wydaniem promptów fali.
