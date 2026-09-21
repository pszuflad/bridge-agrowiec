# 85-DOCS-instrukcja-testow-i6-v2 — Code review

> Reviewed: 2026-09-21
> Branch: docs/85-instrukcja-testow-i6-v2
> Diff: 7 plików (docs/instrukcja-testow-I6-v2.md nowy, docs/instrukcja-testow-I6.md banner,
> docs/karty/P6.3/karta.md nowy, docs/karty/P10.4/wejscie-85.md nowy, docs/rebuild-backlog.md
> (#26, #90), docs/tickets/85-.../plan.md i raport.md), 1 commit (`4f648f5`)

## BLOCKER

Brak. Zweryfikowałem każdą etykietę przycisku, nazwę filtra, treść toastu, opis pustego stanu
i próg liczbowy z `docs/instrukcja-testow-I6-v2.md` bezpośrednio w kodzie na tym branchu
(`rebuild/frontend/src/pages/Alerty.tsx`, `pages/alerty/{Tabela|Lista}Alertow*.tsx`,
`filtry-katalogu.ts`, `silnik-katalogu.ts`, `statusy.ts`, `PrzyciskiStatusu.tsx`,
`grupowanie.ts`, `zakladki.ts`, `katalog-api.ts`, `pages/Pulpit.tsx`, `pages/pulpit/kpi.ts`) oraz
`backend/src/import/synchronizuj.ts:173`. Wszystkie sprawdzone twierdzenia zgadzają się
1:1 (podpis strony `Alerty.tsx:31`, próg 5%/0%/7/30 dni w `silnik-katalogu.ts`, toasty
„Zmieniono status N alertów"/„Status alertu zmieniony", puste stany „Brak alertów spełniających
filtr."/„filtry.", kolejność przycisków z `akcjeStatusu()`, MO7/MO8 w `WYKLUCZENI_Z_BRAKU_IMPORTU`
= Nokian/Trelleborg wg `test/charakteryzacja/ZRODLA.md`, sekcje Pulpitu i linki `adresZakladki`
na liniach dokładnie cytowanych w `raport.md`/`wejscie-85.md`). Zdania starego Bridge (brak
potwierdzenia przy „Zaakceptuj wszystko", chowanie rozwiązanych przy starym „Wszystkie statusy")
też potwierdzone w żywym bundlu `origin/main:mirror/frontend/assets/index-PRICEFMT1783512500.js`
(zgodnie z regułą D3 z CLAUDE.md — to jedyny bundle wskazywany przez `index.html` na `origin/main`).
Roadmapa, `rebuild/`, `contract/` — nietknięte, zgodnie z planem i zasadą kart z ticketu 82.

## SHOULD-FIX

Brak. Nie znalazłem nic, co uzasadniałoby poprawkę przed mergem.

## NICE-TO-HAVE

- `docs/instrukcja-testow-I6-v2.md:105-106` — przykładowy opis „Dostawca MO3: ostatni import
  **39 dni** temu" jest wiarygodny (`PROG_KRYTYCZNY_DNI=30` w kodzie), ale plan (`plan.md`,
  „Warunki startu") świadomie zakłada „instrukcja bez liczb stagingu", bo danych stagingu nie da
  się zmierzyć z repo. Konkretna liczba dni w przykładzie może się realnie różnić od tego, co
  zobaczy Ania (dni liczą się od `dataAktualizacji`, więc rosną z każdym dniem od nagrania kopii).
  Dokument już zabezpiecza to zdaniem „Liczb nie porównuj" w kroku 6, ale samo słowo „w rodzaju"
  przed przykładem mogłoby być odrobinę mocniejsze (np. „liczba dni będzie inna") — kosmetyka,
  nie treść.
- `docs/tickets/85-DOCS-instrukcja-testow-i6-v2/plan.md` (D2) wylicza rozdziały 1–5, ale dokument
  ma też rozdział 6 „Jak zgłosić znalezisko" (zgodny z formatem I5-v2, gdzie to jest rozdział 5).
  Nieszkodliwe dla Ani, ale plan nie odzwierciedla finalnej struktury 1:1 — czysto redakcyjne.
- `docs/karty/P6.3/karta.md`, sekcja „Do koordynatora" — sam ticket już trafnie flaguje
  nieścisłość w źródle listy z raportu 72 (zakres §3.4–3.7). To dobra praktyka, zostawiam jako
  potwierdzenie, że koordynator dostanie tę informację, a nie jako coś do poprawy tutaj.

## Plan compliance

### Done ✓
- D1: nowy plik `docs/instrukcja-testow-I6-v2.md` jako delta wzorem I5-v2, banner w pierwszej
  wersji, treść pierwszej wersji bez zmian.
- D2: układ rozdziałów 1 (trzy odpowiedzi Ani: 1.1 zakładka Katalog, 1.2 dwa przyciski,
  1.3 wyszukiwarka), 2 (pięć zmian „przy okazji"), 3 („czego nie zgłaszaj"), 4 (16 zdań I6
  z numerami paragrafów), 5 (podsumowanie) — zrealizowane; rozdział 6 („jak zgłosić") dodany
  ponad listę z D2, spójnie z formatem I5-v2.
- D3: etykiety cytowane z kodu `develop` (`5a7f7db`), zachowanie starego Bridge z żywego bundla
  `origin/main:mirror/frontend/assets/index-PRICEFMT1783512500.js` — zweryfikowane, to faktycznie
  bundle wskazywany przez `index.html` na `origin/main`.
- D4: Pulpit/I10 nietknięty; nota w I6-v2 (koniec rozdziału 4) + nowy
  `docs/karty/P10.4/wejscie-85.md` z faktami i listą obalonych paragrafów I10.
- Backlog #26 i #90 dostały odsyłacz do instrukcji, bez zmiany istoty wpisów.
- Zero zmian w `rebuild/`, `contract/`, `docs/rebuild-roadmap.md` — potwierdzone `git diff`.
- Język dla Ani: brak API-route'ów, nazw plików, numerów ticketów/kart, słowa „migracja” —
  potwierdzone własnym `grep`em (zero trafień).

### Missing or deviating ✗
Brak — zakres z planu pokryty w całości, bez rozjazdów.

### Definition of done
- [x] Delta `instrukcja-testow-I6-v2.md` opisuje trzy odpowiedzi Ani zgodnie z kodem na branchu.
- [x] Banner w I6.md kieruje do v2 i wymienia unieważnione paragrafy.
- [x] Karty P6.3 i P10.4 założone i wypełnione (stan, nie zamiar).
- [x] Backlog #26/#90 zaktualizowany o odsyłacz.
- [x] Zero zmian w `rebuild/`/`contract/`/roadmapie.
- [x] Wszystkie twierdzenia o UI zweryfikowane wobec kodu (nie polegam na samej deklaracji
      raportu — sprawdziłem źródła).

## Parallel-test concerns

Nie dotyczy — ticket nie dodaje żadnych testów automatycznych (DOCS, zero zmian w `rebuild/`).

## Overall assessment

Bardzo starannie zweryfikowany dokument — każde twierdzenie o etykiecie, komunikacie, progu
i zachowaniu starego Bridge sprawdza się w kodzie na tym branchu i w żywym bundlu produkcji.
Nie znalazłem żadnej rozbieżności między tym, co przeczyta Ania, a tym, co faktycznie zobaczy na
stagingu. Ticket trzyma się reguł projektu (karty piszą tylko we własnych katalogach, roadmapa
nietknięta, ustalenie dla P10.4 poszło do właściwego pliku, nie do zamykanej karty). Gotowe do
merge'a bez zastrzeżeń.
