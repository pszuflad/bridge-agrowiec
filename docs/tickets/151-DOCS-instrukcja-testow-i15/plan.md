# 151-DOCS-instrukcja-testow-i15 — delta instrukcji testów I15 dla Ani

> Status: Draft
> Branch: `docs/151-instrukcja-testow-i15`
> Worktree: `.worktrees/151-DOCS-instrukcja-testow-i15`

## Opis ticketu

Nowy `docs/instrukcja-testow-I15.md` — DELTA instrukcji testów dla Ani, obejmująca całe I15.
Układ punktu: „Wdrożyłaś na produkcji → Jest teraz w nowym Bridge → Sprawdź tutaj" (bez
„zgłosiłaś" — to są zmiany, które Ania sama wdrożyła we wrześniu, a my je odtworzyliśmy).
Wzorce formy: `docs/instrukcja-testow-I7-v2.md`, `docs/instrukcja-testow-I10-v2.md`.
Karta: `docs/karty/I15.9/` (karta.md + 11 plików `wejscie-*.md`).

## Kontekst

**Triaż wykonany (2026-09-24, w ramach tego ticketu).** `git log 88fa31c..origin/main` = 5 commitów
`sync(vps)` (23.09, godziny 14:00–18:00), **wszystkie dotykają wyłącznie**
`mirror/frontend/ex-port-files/sellycsv-*.csv` — dane, zero kodu. Nagłówek CSV bajt w bajt ten sam
na `88fa31c` i na `origin/main` (`5bd4a7b`). Zakres I15 pozostaje domknięty na `88fa31c`; nowych
wpisów backlogu nie ma, nie ma też czego zgłaszać użytkownikowi.

Zakres merytoryczny pochodzi z 11 wejść karty I15.9 + kart I15.10, I15.10b, I15.11.

## Kontrakt i fixtures (zakres)

**Brak (nie dotyka kontraktu).** Ticket tworzy jeden dokument w `docs/` i aktualizuje kartę
I15.9 oraz `docs/triage-state.txt`. Nie zmienia kodu w `rebuild/`, schematu ani `contract/`.
GATE odbudowy nie obowiązuje. Wiarygodność treści opiera się na źródłach: karty I15.*, tickety
`docs/tickets/`, `docs/cutover.md` §3a, kod `rebuild/` — każdy fakt w dokumencie ma oparcie
w pliku, nie w pamięci.

## Decyzje

- **D1 — trzy dodatkowe punkty wchodzą** (decyzja użytkownika 2026-09-24): pełne pliki CSV
  z Analityki (`wejscie-126`), kolejka atrybutów krótsza o 526 pozycji (`wejscie-113`), import
  zatrzymujący się na błędach odczytu cennika (`wejscie-120`). Pierwsze dwa to NASZE zmiany
  w odbudowie → rozdział „Przy okazji, o co nie pytałaś" (wzorzec: I7-v2 rozdz. 2, I10-v2 rozdz. 3).
  Trzeci to zmiana Ani (#103) → rozdział 1.
- **D2 — odsyłacze do ścieżki krytycznej linkiem po nazwie pliku** (decyzja użytkownika 2026-09-24),
  mimo że `docs/instrukcja-testu-sciezki-krytycznej.md` powstaje równolegle w tickecie 150.
- **D3 — warunki środowiskowe wg stanu z 24.09 podanego przez użytkownika**, nie wg `wejscie-113`
  (23.09). `wejscie-113` mówi „scheduler importu wyłączony"; 24.09 staging został przekonfigurowany
  (scheduler włączony, `AGRORAMI_*` uzupełnione), co zgadza się z docelową tabelą w
  `docs/cutover.md` §3a. Rozjazd odnotowany w raporcie, nie ukryty.
- **D4 — sprostowania wyraźnie oznaczone.** Trzy obietnice złożone Ani wcześniej są nieaktualne:
  szerokość (`instrukcja-testow-I3.md` §11 pkt 10), EAN naukowy (`instrukcja-testow-I3-v2.md` + 14i),
  pliki CSV z Analityki (`instrukcja-testow-I10-v2.md` §1.3). Każde dostaje wiersz w tabeli
  „Co przestało być prawdą" + oznaczenie przy samym punkcie.
- **D5 — nie powielamy ścieżki krytycznej** (`wejscie-148`): przy MO9, Staging v2 i CSV zostaje samo
  „jest teraz tak" + odesłanie, bez scenariusza testowego.
- **D6 — forma wg polecenia Ani z 22.09** (`wejscie-104b`): na punkt „co zmieniliśmy (1 zdanie) →
  polecenie → rezultat", bez tła i uzasadnień technicznych; rozbieżności z logiką biznesową
  do osobnej sekcji „Do Twojej decyzji". Zachowujemy z wzorców tylko rusztowanie do raportowania:
  linijkę „Twoja ocena" pod punktem i tabelę podsumowania na końcu.

- **D7 — cytat „I3 §11 pkt 10" jest BŁĘDNY i nie wolno go powtórzyć.** `docs/instrukcja-testow-I3.md`
  ma sekcje 1–8, `instrukcja-testow-I3-v2.md` sekcje 1–8 — **żaden z nich nie ma §11**. Obietnica
  o szerokości stoi w `instrukcja-testow-I3.md` **§4 („Rzeczy, które WYGLĄDAJĄ na błąd") punkt 3**,
  wiersze 355–358: nowe importy „zapisują poprawnie (`620`, `14.9`, `10.00`)". Błędne odwołanie
  pochodzi z `docs/rebuild-backlog.md:3879` (#83) i zostało powielone w `docs/karty/I15.9/wejscie-120.md`.
  W dokumencie dla Ani cytujemy **§4 pkt 3**. Błąd zgłaszam koordynatorowi (sekcja „Do koordynatora"
  w `karta.md`), nie poprawiam cudzych plików.
- **D8 — MO9 sprawdzamy przyciskiem „Synchronizuj"** (nie „Synchronizuj teraz"). Etykieta potwierdzona
  dwoma źródłami: `docs/instrukcja-testow-I3-v2.md` §3.1 („Przycisk nazywa się «Synchronizuj»")
  i komentarzem w `rebuild/frontend/src/pages/konfiguracja/Dostawcy.tsx`. Zakres punktu: tylko
  „import przechodzi", bez liczb stanów (`wejscie-104.md` pkt 2.5 — „trzeba ufać").
- **D9 — w `/katalog` NIE MA filtra „Zastosowanie".** Zweryfikowane w
  `rebuild/frontend/src/pages/katalog/filtrowanie.ts`: kryteria mają `kategorie` (multiselect), nie mają
  zastosowania, a `zastosowanie` nie jest też w `POLA_SZUKAJKI`, więc szukajka go nie znajdzie.
  Polecenie dla Ani: filtr **Kategoria = Rolnicze** + oglądanie kolumny **„Zastosowanie"**.
  Obie kolumny („Zastosowanie", „Blokowane formy płatności") są domyślnie widoczne
  (`kolumny.ts:124,127`), więc nie trzeba ich włączać w „Kolumny".
- **D10 — nazwy kategorii w CSV to krok POZA panelem.** Pliku CSV nie da się pobrać z panelu
  (powstaje na serwerze o 6:00, Selly zaciąga o 12:00). Kolumnę „Blokowane formy płatności"
  Ania sprawdzi w `/katalog`, a zawartość CSV — dopiero przy ścieżce krytycznej. W delcie
  zaznaczam to wprost, żeby nie szukała przycisku, którego nie ma.

## Plan wykonania

1. `docs/instrukcja-testow-I15.md` — nowy dokument. Struktura:
   - nagłówek (środowisko, data, dla kogo) + ramka „to jest staging";
   - „Po co ta kartka" — czym jest delta, czego NIE zawiera (ścieżka krytyczna osobno), ile zajmuje;
   - **warunki środowiskowe** (stan 24.09): staging na czubku `develop`, baza = kopia produkcji
     z 23.09 (8329 produktów, migracje 001–013), scheduler importu włączony, `AGRORAMI_*`
     uzupełnione → MO9 testowalne; Selly wyłączone trzema blokadami (`SELLY_TRYB=wylaczony`,
     `SELLY_SCHEDULER` wyłączony, brak sekretów) → tory API i zaciągnięcie pliku przez sklep
     dopiero po cutoverze;
   - **rozdział 1 — Twoje wrześniowe zmiany**: blokowane formy płatności (katalog + CSV),
     lista zastosowań i kategorie, MO9, szerokość bez zer (sprostowanie), Staging v2
     („Rozstrzygnij" + blokada błędnego EAN, sprostowanie), „Braki w cenniku", import
     zatrzymujący się na błędach odczytu, Selly REST (4:30, trasy bez przycisków);
   - **rozdział 2 — Przy okazji, o co nie pytałaś**: pełne pliki CSV z Analityki, kolejka
     atrybutów krótsza o 526 pozycji;
   - **rozdział 3 — Co przestało być prawdą**: tabela sprostowań (3 pozycje);
   - **rozdział 4 — Do Twojej decyzji**: rozbieżności z logiką biznesową;
   - **rozdział 5 — Podsumowanie**: tabela OK/ŹLE + licznik;
   - **rozdział 6 — Jak zgłosić**: odesłanie do `instrukcja-pracy-dla-ani.md` (TEST.3).
2. `docs/karty/I15.9/karta.md` — oznaczenie karty jako zrobionej (`✅ data · ticket`), sekcja
   „Dowiezione" z zakresem faktycznie dowiezionym, usunięcie obalonego `7d6cfc9` z „Decyzji”
   (obowiązek 4 z CLAUDE.md; sprostowanie stoi w `wejscie-148.md`).
3. `docs/triage-state.txt` — marker na `5bd4a7b` z rozliczeniem 5 commitów (same dane).

## Strategia testowania

Dokument tekstowy — brak testów automatycznych. Weryfikacja:
- **każdy fakt ma źródło** — przy pisaniu sprawdzam nazwy ekranów, filtrów, kolumn i komunikatów
  w kodzie `rebuild/frontend/src/` i `rebuild/backend/src/`, nie przepisuję z pamięci;
- **reviewer** sprawdza dokument pod kątem zgodności z kartami i kodem;
- bramki backendu nie dotyczą (zero zmian w `rebuild/`), ale po synchronizacji z `develop`
  potwierdzam, że nic z kodu nie weszło w konflikt.

## Poza zakresem

- Scenariusze testowe ścieżki krytycznej (TEST.2, ticket 150) i pełnego testu (TEST.1, ticket 149).
- Zmiany w kodzie `rebuild/` — dokument opisuje stan zastany, niczego nie naprawia.
- Poprawianie trzech nieaktualnych zdań z `wejscie-144` pkt 3 (cudze pliki, decyzja koordynatora).
- Dorabianie przycisków synchronizacji Selly w panelu (wymaga decyzji Ani — trafia do rozdziału 4).

## Definition of done

- [ ] `docs/instrukcja-testow-I15.md` pokrywa cały zakres z karty I15.9 i decyzji D1
- [ ] Każdy punkt w układzie „co zmieniliśmy → polecenie → rezultat", bez ściany tekstu
- [ ] Trzy sprostowania wyraźnie oznaczone i zebrane w tabeli
- [ ] Rozbieżności z logiką biznesową w osobnej sekcji „Do Twojej decyzji"
- [ ] Tematy wspólne ze ścieżką krytyczną odesłane, nie przepisane
- [ ] Karta I15.9 opisuje STAN, nie zamiar; `triage-state.txt` zaktualizowany
- [ ] Gałąź zsynchronizowana z `origin/develop`, PR `MERGEABLE`
