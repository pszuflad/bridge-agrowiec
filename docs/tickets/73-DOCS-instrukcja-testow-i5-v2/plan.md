# 73-DOCS-instrukcja-testow-i5-v2 — delta instrukcji testów Historii dla Ani (karta P5.3)

> Status: Implemented
> Branch: `docs/73-instrukcja-testow-i5-v2`
> Worktree: `.worktrees/73-DOCS-instrukcja-testow-i5-v2`

## Ticket description
Karta P5.3 — delta instrukcji testów I5 (`docs/instrukcja-testow-I5-v2.md`) po kartach kodu P5.1
(ticket 69, backlog #87) i P5.2 (ticket 70, backlog #93). Format „Zgłosiłaś → Jest teraz → Sprawdź”
(decyzja użytkownika z 2026-09-18), wzorzec `docs/instrukcja-testow-I4-v2.md`. Ania w I5 niczego nie
reklamowała — część „zgłosiłaś” obejmuje wyłącznie jej rozstrzygnięcia (§3.2/#21, §6, §9); P5.1 i P5.2
idą do osobnego rozdziału „Przy okazji — zmiany, o które nie prosiłaś”.

## Warunek startu — spełniony
- PR #85 (P5.1) zmergowany 2026-09-21 14:21, PR #86 (P5.2) 14:28; HEAD `develop` = `a793eeb`.
- Staging: workflow „Deploy staging” dla `a793eeb` zakończony `success` (2026-09-21 14:28). Kod P5.2
  jest na stagingu. Uwaga: działający ZIP był w odbudowie już od 8a (`archiver@8`) — P5.2 zmieniła tylko
  ścieżkę błędu po nagłówkach i bramki testów, więc wpis w Historii po eksporcie ZIP istnieje na stagingu
  niezależnie od tej karty.

## Context — pomiary (develop `a793eeb`, `db/snapshot.db`)
**P5.1 (Historia bez limitu):**
- `audit_log` na snapshocie: **3873** wierszy (2026-06-30 … 2026-08-13), próg 5000 nieosiągnięty.
- Wierszy widocznych w Historii (5 akcji słownika): **270** (`edycja_produktu` 178, `upload_pliku` 92);
  pozostałe 3603 = **93,0%** — w tym `auto_pull` 2869.
- Remisy `kiedy` wśród widocznych: **0** → nowe rozstrzyganie remisu `id DESC` nic nie zmienia na ekranie.
- Fraza, `total`, filtr dostawcy, paginacja — dalej w pamięci na tym samym zbiorze (`routes/history.ts`,
  `historia/mapowanie.ts`); poniżej progu wynik identyczny jak przed P5.1.
- Scheduler na stagingu wyłączony (`IMPORT_SCHEDULER`, roadmapa 3f), więc dziennik stagingu rośnie tylko
  od działań testerów — próg 5000 nieosiągalny w praktyce testów. **Wniosek: nie ma czego klikać,
  zabezpieczenie na przyszłość.** Faktycznej liczby wierszy w `data-nowy.db` na VPS nie da się ustalić
  z repo.
- W produkcji tempo ~1500–2400 wierszy/mies. (raport 69) sugeruje, że próg jest tam już przekroczony —
  stąd warunkowe zdanie w instrukcji („jeśli stary Bridge zaczyna Historię później niż nowy”).

**P5.2 (eksport ZIP):** `routes/export-shoper.ts:89-156`
- Bez `?dostawca` → ZIP `shoper_wszyscy_{data}.zip`, jeden CSV na dostawcę z `listaDostawcow` (snapshot: 10).
- Audyt: `akcja: "eksport_csv"`, `encjaTyp: "dostawcy"` (liczba mnoga), `encjaId: "wszyscy"`,
  `szczegoly: { liczbaDostawcow }`.
- Mapowanie (`historia/mapowanie.ts::naWpisHistorii`): typ `eksport`; `dostawca` = `null` (bo `encjaTyp`
  ≠ `"dostawca"` i brak `szczegoly.dostawca`) → kolumna **„—”**; `liczbaPozycji` = `liczbaDostawcow`;
  `format` = `csv`; `uwagi` = `"Format: csv"`.
- Front (`TabelaHistorii.tsx:70-77`, 1:1 z `fe.js:25537-25545`) renderuje „Format: csv” + `uwagi` →
  na ekranie **„Format: csv Format: csv”** (dublowanie wierne oryginałowi).
- Trasa za `requireAuth`, działa na cookie `bridge_session` (nawigacja przeglądarki) — potwierdzone
  w `test/eksport-shoper.gate.test.ts`.
- **Brak przycisku w UI** — ani w odbudowie, ani w oryginale (`pages/katalog/eksport.ts:6-11`, I8 D2).
  „Pobierz CSV” w Katalogu to eksport kliencki bez audytu.
- W produkcji ZIP → 500 przed zapisem audytu (konstruktor pada pierwszy) → wpisu nie ma.

**Katalog §3.3 — NIEAKTUALNY, ale nie przez P5.x.** Od 12a (`35-FEATURE-mutacje-produktow-backend`
+ front katalogu) wiersz Katalogu ma menu „Akcje” → „Edytuj” → okno „Edycja produktu (kod)” → „Zapisz
zmiany” (`pages/katalog/MenuAkcji.tsx:65-69`, `DialogEdycjiProduktu.tsx:288-318`, `api.ts:68` —
`PATCH /api/products/:id`), a backend zapisuje `edycja_produktu` (`routes/products.ts:270`). Karta 59
(Zadanie B) zmierzyła, że ślad w Historii jest identyczny po obu stronach i wskazała, że §3.3 trzeba
poprawić. Pierwsze sprawdzenie tej karty (grep po `method: "PUT"`) przeoczyło wywołanie
`zadanie("PATCH", …)` — wyłapane przy czytaniu raportu 59.

**P7.1:** nie ma jej w `develop` (roadmapa: ⬜ gotowe) → brak zdania z odesłaniem do I7.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa
Brak (nie dotyka kontraktu) — ticket DOCS, zero zmian w `rebuild/` i `contract/`. Gate odbudowy nie
obowiązuje; zastępuje go weryfikacja każdego twierdzenia instrukcji z kodem `develop` (review).

## Decisions
- **D1 (użytkownik, 2026-09-21): scenariusz ZIP z gotowym linkiem.** Brak przycisku w obu Bridge'ach —
  instrukcja daje Ani jeden link do kliknięcia (`https://test.agritires.eu/api/export-shoper`), bez
  nazywania go trasą. Świadome, ograniczone odstępstwo od reguły „zero tras API”.
- **D2 (moja, sprostowanie promptu):** prompt mówi, że ZIP to „jedyne miejsce, w którym nowy Bridge
  celowo pokaże WIĘCEJ niż stary”. Po P5.1 jest drugie: najstarsze wpisy, jeśli dziennik produkcji
  przekroczył 5000. Instrukcja mówi o obu; ZIP to jedyny nowy RODZAJ wpisu.
- **D3:** §3.3 i wiersz „ręczna edycja” z §12 trafiają do rozdziału „przestało być prawdą” jako osobna
  podsekcja „z innego powodu niż zmiany z rozdziału 2” (unieważniła je 12a, nie P5.x; prompt wskazał
  §3.3 jako kandydata, a raport 59 — jako do poprawienia). §3.1 pomijamy całkowicie (Ania zamknęła temat).

## Implementation plan
1. `docs/instrukcja-testow-I5-v2.md` — nowy plik: „Po co ta kartka” → 1. Twoje odpowiedzi (#21,
   §6, §9) → 2. Przy okazji (2.1 limit — nic do klikania; 2.2 ZIP — Sprawdź z linkiem)
   → 3. Co przestało być prawdą (cytaty znak w znak) → 4. Podsumowanie → 5. Jak zgłosić.
2. Banner „częściowo nieaktualne” na górze `docs/instrukcja-testow-I5.md` (wzorzec I4).
3. `docs/rebuild-roadmap.md` — wiersz P5.3 → ✅, Iteracja 5 zamknięta.
4. Raport, review, PR.

## Testing strategy
Brak testów kodu. Review: każde twierdzenie instrukcji o zachowaniu aplikacji porównane z kodem
`develop` (plik:linia) i z pomiarem snapshotu.

## Out of scope
P7.1 (Historia akcji kolejki atrybutów), §3.1 (zmiany cen per opona), jakiekolwiek zmiany w `rebuild/`
i `contract/`. Poza zakresem jest też niewielka nieścisłość §8.1 pierwszej wersji (import pokazuje
„Plik: x (Plik: x)”, nie samo „Plik: x”) — istniała przed P5.1/P5.2, Ania jej nie zgłosiła → follow-up.

## Definition of done
- [x] warunek startu sprawdzony (oba PR w develop, deploy stagingu `success`)
- [x] `instrukcja-testow-I5-v2.md` napisana, każde twierdzenie zweryfikowane z kodem
- [x] banner w `instrukcja-testow-I5.md`
- [x] roadmapa: P5.3 ✅, Iteracja 5 zamknięta
- [x] review bez BLOCKER-ów, PR do develop
