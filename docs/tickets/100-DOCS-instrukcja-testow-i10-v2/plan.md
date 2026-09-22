# 100-DOCS-instrukcja-testow-i10-v2 — delta instrukcji testów I10 dla Ani (karta P10.4)

> Status: Implemented
> Branch: `docs/100-instrukcja-testow-i10-v2`
> Worktree: `.worktrees/100-DOCS-instrukcja-testow-i10-v2`

## Ticket description
P10.4 — Iteracja 10: delta instrukcji testów Analityki i Pulpitu dla Ani (`docs/instrukcja-testow-I10-v2.md`).
Warunek startu: w `develop` P10.1, P10.2, P10.3 (#113) i PR.2 (#112) — **spełniony** (oba PR-y
zmergowane 2026-09-22, `develop` = `fde7697`). Typ DOCS, bez zmian w `rebuild/` i `contract/`.

## Context
- Ania oddała I10 pustą („tak testowałam, działa dobrze”). Rozstrzygnęła trzy pytania rundy 2
  (10.1 → #32, 10.2 → #34, 10.3 → #91) i w przeglądzie 12 widoków zgłosiła kafle KPI (12.3).
  Odpowiedź na 12.3 nie jest zapisana — wariant (a) przyjął użytkownik (karta PR.2).
- Materiał: `docs/karty/P10.4/wejscie-{85,90,96,97,98}.md` + raporty ticketów 90, 96, 97, 98.
- Wzorce formatu: `docs/instrukcja-testow-I7-v2.md`, `docs/instrukcja-testow-I9-v2.md`; banner
  jak w I7/I9.

### Weryfikacja wejść w kodzie `develop` — dwa wejścia obalone
1. **wejscie-96, „Sprawdź” kafla eksportu — niewykonalny.** Eksport CSV z Katalogu powstaje
   w przeglądarce i świadomie nie zapisuje audytu (`rebuild/frontend/src/pages/Katalog.tsx:297-300`,
   `pages/katalog/eksport.ts:5-11`). Wpisy `eksport_csv`/`eksport_shoper` piszą tylko trasy
   `GET /api/export-shoper` i `/api/export/shoper` (`backend/src/routes/export-shoper.ts`), których
   żaden ekran nie woła (grep FE: zero wywołań). Kopia produkcji: 0 eksportów w `audit_log`,
   92 × `upload_pliku`, ostatni 2026-07-27. Z UI da się wywołać tylko gałąź „— / Ostatni import: …”
   (przycisk „Wgraj plik”, `routes/suppliers.ts:133-203`).
2. **wejscie-98, „plik bez żadnego limitu” — nieścisłe.** Plik = wiersze karty po filtrach, ale
   trasy kart mają sufity serwera: 2.1-2.4 i 2.5 po 1000, Marża 1000 grup, Rotacja 1000, 3.1, 1.2,
   4.1, 4.2 po 500 (`backend/src/repos/analityka.ts:170,391,713-715,1126,1299-1302`). Kopia
   produkcji: pozycje unikalne 5109 → karta i plik 1000 (dawny eksport `unique` bez limitu = 5109);
   4.1/4.2 ~5184 → 500. Plan P10.3 (`98…/plan.md:66`) zakładał „karty pobierają pełne listy”.
   Skutek widoczny też w kaflu „Pozycje unikalne” (= 1000, port 1:1 oryginału).

## Kontrakt i fixtures (zakres)
Brak — ticket nie dotyka API ani `contract/`. Gate odbudowy N/D.

## Decisions
- **D1 (krok 0):** I8 dostaje dwie jednolinijkowe notki (przy §10.4 i przy wierszu tabeli
  „Rzeczy, które mają wyglądać źle”) z odesłaniem do I10-v2. Bez bannera na całym pliku.
- **D2 (kafel eksportu):** opis uczciwy — sprawdzenie gałęzi importu („Wgraj plik” →
  „Ostatni import: przed chwilą”), gałąź eksportu opisana bez klikania + pytanie do Ani, czy
  eksport z Katalogu ma zostawiać ślad w Historii (to ożywiłoby kafel; nowa zmiana).
- **D3 (sufity CSV):** kartka mówi, że plik ma tyle wierszy, ile N w stopce „Pokazano 300 z N”,
  a 500/1000 to sufit karty; pytanie do Ani, czy potrzebuje pełnych plików. Fakt + kandydat na
  backlog → „Do koordynatora”.
- **D4:** pytanie do Ani o plik marży per produkt (zapowiedziane w backlogu #91, pkt 2).
- **D5 (12.3):** punkt o kaflach KPI w układzie „Zgłosiłaś (w przeglądzie) → Jest teraz →
  Sprawdź”; nie piszemy „zdecydowałaś”, bez dodatkowej linijki-potwierdzenia.
- **D6:** P6.2 (Pulpit, dwa źródła powiadomień) — „Przy okazji”, odesłanie do I6-v2 §2.5, bez
  powtarzania scenariusza. #31 (migawka) i #35 (404) — bez scenariuszy; tylko unieważnienia.

## Implementation plan
1. `docs/instrukcja-testow-I10-v2.md` (nowy): Po co ta kartka → 1. Twoje decyzje (1.1 karty
   4.1/4.2, 1.2 kafel „Ostatni eksport CSV” + pytanie, 1.3 CSV = tabela + dwa pytania) →
   2. Twoje zgłoszenie z przeglądu (kafle KPI) → 3. Przy okazji (Pulpit P6.2; migawka) →
   4. Co przestało być prawdą (tabela z cytatami znak w znak + rozliczenie §8 i listy
   kontrolnej §9) → 5. Podsumowanie → 6. Jak zgłosić. Zero nazw plików/tras/tabel/ticketów.
2. Banner w `docs/instrukcja-testow-I10.md` (wzór I7/I9).
3. Notki w `docs/instrukcja-testow-I8.md` przy §10.4 i w tabeli.
4. `docs/karty/P10.4/karta.md` — Stan, Decyzje, Dowiezione, Do koordynatora (Iteracja 10 do
   zamknięcia; dwa obalone wejścia; sufity CSV jako kandydat na backlog; brak konsumenta
   eksportu z audytem).

## Testing strategy
Każde twierdzenie o zachowaniu sprawdzone w kodzie `develop` (ścieżki w „Context”); liczby
z kopii produkcji `db/snapshot.db` (tylko odczyt). Review przez subagenta z tym samym poleceniem.

## Out of scope
Zmiany w `rebuild/`, `contract/`, roadmapie, backlogu (statusy #32/#34/#91 już ✅ — nie ruszam),
`docs/pytania-do-ani-2026-09-18.md`. Naprawa sufitów CSV i śladu eksportu z Katalogu.

## Definition of done
- [ ] I10-v2 w formacie delty, wszystkie unieważnienia z wejść 85/90/96/97/98 + znalezione przy
      weryfikacji, cytaty znak w znak.
- [ ] Banner w I10, notki w I8.
- [ ] Karta P10.4 = stan; „Do koordynatora” z zamknięciem Iteracji 10.
- [ ] review.md bez otwartych BLOCKER-ów; PR do `develop`.
