# 80-DOCS-instrukcja-testow-i9-v2 — Code review

> Reviewed: 2026-09-21
> Branch: `docs/80-instrukcja-testow-i9-v2`
> Diff: 4 pliki (`docs/instrukcja-testow-I9-v2.md` nowy, `docs/instrukcja-testow-I9.md`,
> `docs/rebuild-roadmap.md`, `docs/tickets/80-DOCS-instrukcja-testow-i9-v2/plan.md`), 4 commity

## Metodologia

Każde twierdzenie `docs/instrukcja-testow-I9-v2.md` i bannera w `docs/instrukcja-testow-I9.md`
sprawdzone z kodem na develop w tym worktree: `WagaGabarytowa.tsx`,
`waga-gabarytowa/{TabelaPrzewoznikow,KalkulatorPaletowy,przewoznicy,api}.tsx/.ts`,
`components/DialogPotwierdzenia.tsx`, `lib/queryClient.ts`, backend
`routes/waga-gabarytowa.ts`, `waga-gabarytowa/formula.ts`, `repos/przewoznicy.ts`,
`repos/config.ts`, `schema/007_waga_gab_przewoznicy.sql`. Liczby kalkulatora paletowego
przeliczone ręcznie z `formula.ts` dla ustawień 55/80/10/0.000167 (50×60×25 i 70×60×25) —
zgadzają się co do trzeciego miejsca po przecinku z tym, co podaje dokument (21.042 kg,
28.056 kg, oba teksty `opis` znak w znak). Treści dialogów potwierdzenia (tytuły, treść,
etykiety przycisków) porównane znak w znak z literałami w `TabelaPrzewoznikow.tsx`. Cytaty
Ani (§3.11, §3.13, 9.2, 9.3 z promptu) porównane znak w znak z plikiem — zgadzają się. Tabela
„Co przestało być prawdą” przejrzana wobec całego `docs/instrukcja-testow-I9.md` paragraf po
paragrafie (§1 przez §7) — nie znalazłem pominiętego paragrafu, który przestał być prawdą, ani
paragrafu wymienionego niesłusznie.

## BLOCKER

Brak.

## SHOULD-FIX

Brak.

## NICE-TO-HAVE

- [ ] `docs/instrukcja-testow-I9-v2.md:131-135` — treść okna „Przywrócić domyślną listę
  przewoźników?” w kodzie (`TabelaPrzewoznikow.tsx:226-229`) ma w sobie `\n` i komponent
  `DialogPotwierdzenia` renderuje ją z `whitespace-pre-line` (`DialogPotwierdzenia.tsx:52`) —
  na ekranie Ania zobaczy DWIE osobne linie, a cytat w instrukcji jest złożony jako jeden ciągły
  akapit (tylko zawijanie markdown). Słowa zgadzają się co do znaku, ale wizualny podział nie
  jest zaznaczony — przy dosłownym porównaniu „słowo po słowie" może to na chwilę zmylić.
  - Sugestia: dodać `\n` w cytacie albo dopisek, że tekst jest w dwóch liniach.
- [ ] `docs/instrukcja-testow-I9-v2.md:170-227,275-284` — numer „3.2” jest użyty dla dwóch
  różnych rzeczy w tym samym rozdziale (checkbox „Paletowy: 21.042 kg i 28.056 kg” w wierszu
  podsumowania i osobne pytanie „Progi palety: tak / do zmiany / nie wiem” też pod „3.2”) —
  gdy Ania zgłosi „błąd w 3.2”, nie wiadomo od razu, czy chodzi o wynik czy o odpowiedź na
  pytanie.
  - Sugestia: ponumerować pytanie o progi jako osobny podpunkt (np. 3.2b) w kolejnej rewizji.
- [ ] `docs/rebuild-roadmap.md:3413` — wiersz „Progi kalkulatora paletowego” w tabeli „Po
  stronie użytkownika” używa `⬜ po stronie Ani` w kolumnie „Rekomendacja”, podczas gdy sąsiednie
  wiersze (#91, #92) mają tam zwykły tekst bez checkboxa — drobna niespójność stylu w tej samej
  kolumnie tabeli.

## Plan compliance

### Done ✓
- `docs/instrukcja-testow-I9-v2.md` — nowy plik w układzie „Zgłosiłaś → Jest teraz → Sprawdź”
  (rozdziały „Zanim zaczniesz”, „Zgłosiłaś”/„Zdecydowałaś”, „Co przestało być prawdą”,
  „Podsumowanie”, „Jak zgłosić”), zgodny z formatem `I4-v2.md`/`I5-v2.md`.
- `docs/instrukcja-testow-I9.md` — banner na wzór `I5.md`, treść dokumentu bez zmian
  (zweryfikowane diffem — tylko blok banera na górze).
- `docs/rebuild-roadmap.md` — P9.2 ✅ z datą i ID ticketa, wiersz iteracji 9 w §4 zamknięty
  z jawną notatką o otwartym pytaniu, pytanie o progi palety dopisane do tabeli „Po stronie
  użytkownika — decyzje, które zostały”.
- Liczby kalkulatora paletowego policzone prawdziwą formułą, nie zmyślone — zgadzają się.
- Cytaty Ani (§3.11, §3.13, 9.1 bez cytatu, 9.2, 9.3) — znak w znak, żaden nie zmyślony.
- Język dla Ani — brak nazw plików, tras API, kluczy `waga_gab.*`, tabel, IndexedDB, numerów
  ticketów w `I9-v2.md` i w bannerze `I9.md` (sprawdzone grepem).
- `docs/rebuild-backlog.md` i `docs/karty/` nie dotknięte (zgodnie z „Out of scope”).

### Missing or deviating ✗
Brak — zakres z planu dowieziony 1:1, decyzje z „Decisions” (liczby paletowe, format delty)
zrealizowane zgodnie z zapisem.

### Definition of done
- [x] I9-v2 w układzie delty, cytaty Ani znak w znak, zero żargonu technicznego.
- [x] Banner w I9.
- [x] Roadmapa: P9.2 ✅, Iteracja 9 zamknięta, pytanie o progi otwarte.
- [ ] Review bez BLOCKER-ów; PR do develop — review bez BLOCKER-ów zrobiona (ten dokument); PR
  jeszcze nie utworzony (poza zakresem review).

## Parallel-test concerns

Brak — ticket DOCS, nie dotyka `rebuild/`, nie dodaje testów automatycznych.

## Overall assessment

Bardzo solidna robota: każde twierdzenie o zachowaniu UI, treść okien dialogowych, kolejność
przewoźników po usunięciu i liczby kalkulatora paletowego sprawdzają się co do znaku z kodem na
develop. Tabela „Co przestało być prawdą” jest kompletna — żaden paragraf starej instrukcji nie
został pominięty ani błędnie wymieniony. Trzy uwagi to kosmetyka (wizualny podział linii w
oknie „Przywróć domyślne”, podwójne użycie numeru „3.2”, drobna niespójność stylu w roadmapie)
— żadna nie zmienia treści merytorycznej ani nie wprowadza w błąd. Gotowe do PR.
