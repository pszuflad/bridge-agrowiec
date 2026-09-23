# 151-DOCS-instrukcja-testow-i15 — raport z wykonania

## Podsumowanie

Powstał `docs/instrukcja-testow-I15.md` — delta instrukcji testów dla Ani obejmująca całe I15,
w układzie „co zmieniliśmy → polecenie → rezultat" (polecenie Ani z 22.09, `wejscie-104b.md`).
Dziesięć punktów do sprawdzenia, trzy wyraźnie oznaczone sprostowania, pięć rozbieżności
w sekcji „Do Twojej decyzji". Przy okazji wykonany triaż zmian produkcji: `88fa31c..5bd4a7b`
to 5 commitów wyłącznie z danymi, zakres I15 pozostaje domknięty na `88fa31c`.

## Zmiany

- **Nowy:** `docs/instrukcja-testow-I15.md` (434 linie) — dokument dla Ani.
- **Nowy:** `docs/tickets/151-DOCS-instrukcja-testow-i15/` — plan, raport, review, treść PR-a.
- `docs/triage-state.txt` — marker przesunięty na `5bd4a7b` z rozliczeniem 5 commitów.

## Triaż zmian produkcji (wykonany w tym tickecie)

`git log 88fa31c..origin/main` = **5 commitów `sync(vps)`** (23.09, godziny 14:00–18:00).
Każdy dotyka **wyłącznie** `mirror/frontend/ex-port-files/sellycsv-vDsrvHnz7jmyqlvtubo4g3JA.csv`.

- **Zero kodu** → nowych wpisów backlogu nie ma.
- Nagłówek CSV **bajt w bajt identyczny** na `88fa31c` i `5bd4a7b` (60 kolumn, ostatnia
  `Link-do-zdjeci`) — sprawdzone celowo, bo kolumna blokowanych form płatności jest w zakresie I15.
- **Zakres I15 pozostaje domknięty na `88fa31c`.** Nic do zgłoszenia użytkownikowi.
- Regeneracja chodzi co godzinę (skutek #104), więc kolejne triaże będą zwykle puste kodowo.

## Odstępstwa od planu

**Jedno, wykryte przy weryfikacji i naprawione przed commitem.** Plan (za `wejscie-121.md`)
zakładał zdanie „przycisków synchronizacji w panelu NIE MA". Sprawdzenie
`rebuild/frontend/src/pages/selly/` pokazało, że ekran **Selly ma przyciski** — *„Test dry-run
(5 szt.)"* i *„Wyślij do Selly"* (`SekcjaSync.tsx:110-124`) oraz przyciski sekcji CSV. Wołają one
`POST /api/selly/sync-supplier` i `POST /api/selly/generate-csv` (ścieżka z sesji 8a), a **nie**
sześć nowych tras `sync-*` z I15.8. Zdanie z `wejscie-121.md` jest prawdziwe wąsko (żaden żywy
skrypt frontu nie woła `sync-*`), ale przepisane wprost wprowadziłoby Anię w błąd — otworzyłaby
ekran Selly, zobaczyła przyciski i uznała, że dokument kłamie.

Punkt 1.8 rozdziela więc obie rzeczy: przyciski na ekranie Selly wysyłają **jednego dostawcę**,
a **oba tory harmonogramu** (dzienny i nocny 04:30) przycisku nie mają. Dołożone ostrzeżenie, żeby
nie klikać „Wyślij do Selly" na produkcji „na próbę" — `sync-supplier` z `dry_run=false` realnie
zapisuje do cudzego sklepu (CLAUDE.md, „Środowisko").

## Rozjazdy wykryte przy pisaniu (fakty, nie decyzje)

1. **⭐ Cytat „I3 §11 pkt 10" nie istnieje.** `docs/instrukcja-testow-I3.md` ma sekcje 1–8,
   `instrukcja-testow-I3-v2.md` też — **żaden nie ma §11**. Obietnica o szerokości stoi
   w `instrukcja-testow-I3.md` **§4 („Rzeczy, które WYGLĄDAJĄ na błąd") punkt 3**, wiersze 355–358:
   nowe importy „zapisują poprawnie (`620`, `14.9`, `10.00`)". Błędne odwołanie pochodzi
   z `docs/rebuild-backlog.md:3879` (wpis #83) i zostało powielone do
   `docs/karty/I15.9/wejscie-120.md`. W dokumencie dla Ani cytowane jest **§4 pkt 3**.
   Cudzych plików nie poprawiam — zgłoszone w „Do koordynatora" karty I15.9.
2. **W `/katalog` nie ma filtra „Zastosowanie".** `pages/katalog/filtrowanie.ts`: kryteria mają
   `kategorie` (multiselect), nie mają zastosowania; `zastosowanie` nie jest też w `POLA_SZUKAJKI`,
   więc szukajka go nie znajdzie. Polecenie oparte na filtrze **Kategoria** + kolumnie
   **„Zastosowanie"**. Obie kolumny domyślnie widoczne (`kolumny.ts:124,127`).
3. **MO9 to backlog #78**, nie #105 (#105 to DOT/EAN Handlopeksa).
4. **Przycisk dostawcy nazywa się „Synchronizuj"**, nie „Synchronizuj teraz" — potwierdzone
   `docs/instrukcja-testow-I3-v2.md` §3.1 i komentarzem w `pages/konfiguracja/Dostawcy.tsx`.
5. **Scheduler importu na stagingu** — `wejscie-113.md` (23.09) mówi „wyłączony", stan podany przez
   użytkownika (24.09, zweryfikowany) mówi „włączony". Poszedłem za stanem z 24.09; zgadza się on
   z docelową tabelą w `docs/cutover.md` §3a (`IMPORT_SCHEDULER` = `true` na stagingu).
   `wejscie-113.md` jest w tym punkcie nieaktualne. **Potwierdzone niezależnie** przez ticket 153
   (`docs/karty/TEST.2/wejscie-153.md`, pkt 4): „scheduler importu na stagingu jest włączony".
6. **Pliku CSV nie da się pobrać z panelu** — powstaje na serwerze o 6:00, Selly zabiera o 12:00.
   Sprawdzenie nazw kategorii w CSV to krok poza UI, odesłany do ścieżki krytycznej.

## Weryfikacja etykiet interfejsu

Każda nazwa ekranu, zakładki, filtra, kolumny, przycisku i komunikatu w dokumencie została
sprawdzona w kodzie, nie przepisana z kart:

| Element | Źródło |
|---|---|
| Pozycje menu (Katalog, Staging, Atrybuty, Analityka, Konfiguracja, Selly) | `components/nawigacja.ts:41-60` |
| Zakładki Konfiguracji („Dostawcy", „Wgrywanie ręczne") | `pages/konfiguracja/zakladki.ts:27,31` |
| Filtr „Typ sprawy" + opcja „Braki w cenniku", odznaka „Brak w cenniku" | `pages/Staging.tsx:230`, `pages/staging/dane.ts:78,103-104` |
| Kolumny „Zastosowanie", „Blokowane formy płatności" + domyślna widoczność | `pages/katalog/kolumny.ts:76,94,124,127,166-168` |
| Filtr „Kategoria" w Katalogu | `pages/Katalog.tsx:467` |
| Kolejka „Do akceptacji" w Atrybutach | `pages/atrybuty/PanelPending.tsx:2` |
| Przyciski ekranu Selly | `pages/selly/SekcjaSync.tsx:110-124` |
| Komunikat blokady EAN | `backend/src/import/polityka/blokady.ts:66-70` |
| Wartości zastosowań Rolniczych + remap | `backend/src/import/legacy/application_rules.cjs:8-41,127-131` |
| 60. kolumna CSV + pełne nazwy kategorii | `backend/src/selly/generator-csv.ts:109,190-197` |
| Migracje 001–013 | `rebuild/schema/` |

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt): N/D — ticket nie dotyka API.** Zmiany to jeden dokument
  w `docs/`, marker triażu i artefakty ticketa. Zero zmian w `rebuild/`, `contract/` i schemacie.
- **Bramki backendu: N/D — i to jest weryfikowalne, nie założone.**
  `git diff --name-only origin/develop...HEAD | grep -v "^docs/"` zwraca **pustkę**: gałąź nie
  zmienia ANI JEDNEGO pliku poza `docs/`, więc `rebuild/` jest bajt w bajt identyczne
  z `origin/develop`. Synchronizacja z `develop` (kod wyjścia `10`, merge czysty) wciągnęła
  ticket 153 — również wyłącznie `docs/`. Wymóg z CLAUDE.md („po scaleniu bramki lecą od nowa")
  chroni przed sytuacją, w której dwie zmiany kodu wykluczają się dopiero razem; tutaj po obu
  stronach merge'a zmian kodu nie ma, więc bramki nie mają czego sprawdzić.
  **Nie uruchamiałem ich i nie twierdzę, że przebiegły.**
- **Weryfikacja treści:** każda etykieta UI i każdy komunikat sprawdzone w kodzie (tabela wyżej).

### Obieg 2 recenzji — czysty

0 BLOCKER / 0 SHOULD-FIX / 1 NICE-TO-HAVE. Wszystkie poprawki z obiegu 1 potwierdzone w kodzie
(przykład MO1 co do znaku, MO6 → „—", dymek `title`, licznik 11/6, ujednolicona ocena w 1.8),
brak regresji w numeracji i odsyłaczach. Recenzent przeszedł też cały dokument w poszukiwaniu
drugiego przypadku „fakt z karty bez weryfikacji w kodzie" — nie znalazł.

**NICE-TO-HAVE rozliczony:** recenzent zgłosił, że liczba „172 pozycje u dziewięciu z dziesięciu
dostawców" (punkt 1.4) nie ma niezależnego źródła. **Ma** — to zmierzony wynik z ticketu 120:
`docs/tickets/120-CHORE-i15-2-resync-parserow/raport.md:91` (tabela zmian: `szerokosc "10.0" → "10"`
= 172, wpis #83) i `:209`, potwierdzone w `docs/karty/I15.2/karta.md:69`. Bez zmian w dokumencie.

## Sąsiedni ticket 153 — sprawdzone, że nie rusza treści tego dokumentu

W trakcie ticketa na `develop` wszedł wpis `#153.1` (karta `FIX.1`): CSV dla Selly gubi flagi
zapisane w bazie jako tekst `'Tak'` — 899 z 5396 wierszy, w pięciu kolumnach flagowych
(`Snieg-3PMSF`, `Bloto+snieg`, `CFO`, `NRO`, `CHO`). Sprawdzone: **nie dotyka niczego, co opisuje
ten dokument** — kolumna `Blokowane-formy-platnosci` i nazwy kategorii są poza zakresem tej usterki,
a pomiar potwierdza przy okazji, że nagłówek CSV ma 60 kolumn i jest identyczny z produkcyjnym.
Dowód porównania plików CSV należy do ścieżki krytycznej (TEST.2), nie do tej delty.

## Poprawki po recenzji

**BLOCKER — naprawiony.** Punkt 1.1 obiecywał, że kolumna „Blokowane formy płatności" pokaże
nazwy form, „np. «Płatność odroczona, Kredyt kupiecki»". **Nieprawda.** Kolumna pokazuje
**listę numerycznych identyfikatorów** — dla MO1 `203, 204, … 219`. Zweryfikowane w trzech
miejscach: `rebuild/backend/src/import/legacy/payment_blocks.cjs:7-18` (`BLOCKED_PAYMENT_FORMS`),
`rebuild/frontend/src/pages/katalog/formatowanie.tsx:52-70` (czwarta kopia tej samej listy)
i `formatowanie.tsx:257-260` (render: `<span title={lista}>{lista}</span>`). **Mapy numer→nazwa
nie ma nigdzie w repo** (`grep` po „odroczon", „kupieck" — zero trafień).

Fraza pochodzi wprost z `docs/karty/I15.9/wejscie-122.md` i została przeze mnie przepisana bez
sprawdzenia w kodzie — dokładnie ten błąd, przed którym ostrzega CLAUDE.md („każdą tezę potwierdź
w fixtures/oryginale"). Gdyby poszła do Ani, pierwszy i najważniejszy punkt kartki kazałby jej
szukać nazw, a zobaczyłaby ciąg liczb.

Poprawione: punkt 1.1 podaje prawdziwy przykład (`203, 204, 205, … 219`), ostrzega, że **numery
to stan poprawny**, wspomina o dymku z pełną listą (kolumna bywa węższa niż 17 numerów) i o tym,
że MO6 nie ma wpisu celowo. Dołożona decyzja **4.6** — czy Ania chce nazwy zamiast numerów
(wymagałoby to listy od niej, bo w systemie jej nie ma).

**SHOULD-FIX — oba naprawione.**
- Licznik w podsumowaniu mówił „____ / 10" przy 11 wierszach tabeli → **11**, a decyzje **/ 6**
  (doszła 4.6).
- Punkt 1.8 kończył się „☐ przeczytane", a w tabeli miał kolumny OK/ŹLE → ujednolicone do
  „☐ OK ☐ ŹLE".

**Do wiadomości (nie naprawiane):** trzy odsyłacze (`instrukcja-testu-sciezki-krytycznej.md`,
`instrukcja-pelnego-testu.md`, `instrukcja-pracy-dla-ani.md`) wskazują pliki powstające
w równoległych ticketach 149/150 — to świadoma decyzja D2. **Muszą trafić do `develop`, zanim
kartka pójdzie do Ani.**

## Breaking changes

Brak.

## Follow-up

1. **Błędne odwołanie „I3 §11 pkt 10"** siedzi w `docs/rebuild-backlog.md:3879` (#83)
   i w `docs/karty/I15.9/wejscie-120.md`. Oba to cudze pliki — do poprawienia przez koordynatora.
2. **⭐ `docs/karty/I15.9/wejscie-122.md` zawiera nieprawdziwy przykład** treści kolumny blokowanych
   form płatności („Płatność odroczona, Kredyt kupiecki"). Realnie kolumna pokazuje numery
   (`203, 204, …`). Cudzy plik — do poprawienia przez koordynatora, zanim ktoś przepisze to dalej.
3. **`wejscie-113.md` jest nieaktualne** w punkcie o wyłączonym schedulerze importu na stagingu.
4. **Trzy nieaktualne zdania z `wejscie-144.md` pkt 3** — nadal nierozliczone (decyzja koordynatora,
   czy poprawiać przed cutoverem).
5. **Sześć decyzji Ani** z rozdziału 4 dokumentu wraca do nas po jej odpowiedzi.
