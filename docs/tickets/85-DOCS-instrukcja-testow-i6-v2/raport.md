# 85-DOCS-instrukcja-testow-i6-v2 — raport

## Podsumowanie
Powstała delta `docs/instrukcja-testow-I6-v2.md` (karta P6.3), która domyka Iterację 6.
Rozdział 1 prowadzi Anię przez jej trzy odpowiedzi: zakładkę „Katalog", dwa przyciski
„Oznacz jako przejrzany" / „Rozwiąż" w obu zakładkach i wyszukiwarkę „Szukaj w treści".
Rozdział 2 opisuje pięć zmian, o które nie prosiła, z różnicami wobec starego Bridge.
Rozdział 3 zbiera zachowania odtworzone celowo, a rozdział 4 — 16 zdań pierwszej wersji, które
przestały być prawdą. Pierwsza wersja dostała banner.

## Zmiany
- **Nowy:** `docs/instrukcja-testow-I6-v2.md` — 6 rozdziałów, 9 punktów z oceną + 1 „przeczytane".
- `docs/instrukcja-testow-I6.md` — banner „częściowo nieaktualne" z listą paragrafów; treść bez zmian.
- `docs/rebuild-backlog.md` — #26 (blockquote) i #90 (Status): odsyłacz do instrukcji.
- **Nowy:** `docs/karty/P6.3/karta.md` (okres przejściowy — karta zakłada katalog sama).
- **Nowy:** `docs/karty/P10.4/wejscie-85.md` — co P6.2 obaliła w instrukcji I10 (Pulpit).

## Weryfikacja twierdzeń (kod `develop` `5a7f7db`)
- Zakładki, domyślna „Import", `?zakladka=katalog` z `replace` (F5 zostaje): `pages/Alerty.tsx`,
  `alerty/zakladki.ts`; podpis strony — `Alerty.tsx:30`.
- Przyciski i reguła akcji: `alerty/statusy.ts::akcjeStatusu`, nawias przy `liczba > 1`:
  `PrzyciskiStatusu.tsx`. Etykiety filtra „Nowy/Przejrzany/Rozwiązany", „Nierozwiązane",
  „Wszystkie statusy": `TabelaAlertow.tsx`, `ListaAlertowKatalogu.tsx`; w Imporcie konkretne
  statusy tylko z danych (`wartosciFiltrow`).
- Toasty: Import — „Zmieniono status N alertów" / „Status alertu zmieniony"; Katalog — te same
  napisy po jednym PUT; błędy „Nie udało się policzyć alertów katalogu.", pusty stan Katalogu
  „Brak alertów spełniających filtr.", Importu „Brak alertów spełniających filtry.".
- „Zaakceptuj wszystko": `filtry-katalogu.ts::doZaakceptowania` (widoczne po filtrach, bez
  potwierdzenia); cofanie tylko pojedyncze (w Katalogu `liczba={1}`, brak akcji zbiorczej).
- Wyszukiwarka: `grupowanie.ts::filtrujAlerty` (tokeny AND, bez wielkości liter, przed
  grupowaniem). Treść alertu HTTP to `"<kod> (<nazwa>): HTTP <status>"`
  (`backend/src/import/synchronizuj.ts:173`) — dlatego scenariusz szuka `404`, a nie kodu dostawcy.
- Silnik: nazwy reguł, progi 5% / 7 / 30 dni, MO7/MO8, `data` = `dataAktualizacji` produktu —
  `silnik-katalogu.ts`.
- Pulpit: suma `nowy` (`Pulpit.tsx:154`), „N krytycznych" łącznie (`:167`), sekcje z
  `adresZakladki` (`:259-271`), kafel i „Zobacz wszystkie" → `/alerty` (`:216`, `:252`).
- Stary Bridge (żywy bundle na `origin/main`): łańcuch
  `.filter(e=>"all"===r||e.status===r).filter(e=>e.status!=="rozwiazany"||r==="rozwiazany")`
  (Wszystkie statusy chowa rozwiązane), „Zaakceptuj wszystko" bez potwierdzenia, brak akcji
  powrotu do `nowy`.

## Odstępstwa od promptu
- **Link z Pulpitu:** do właściwej zakładki prowadzą WIERSZE sekcji; kafel i „Zobacz wszystkie"
  otwierają zakładkę Import. Instrukcja pisze stan z kodu.
- **Pulpit a instrukcja I10:** poza zakresem promptu, ale obalone przez P6.2 — nota w I6-v2
  i wejście dla P10.4, bez ruszania pliku I10.
- **„Otwórz ponownie"** istniało już w I6 (przy rozwiązanych); delta opisuje je jako rozszerzone
  o przejrzane i dodane w Katalogu, nie jako całkiem nowe.

## Wyniki testów
- Gate odbudowy: N/D (DOCS, zero zmian w `rebuild/` i `contract/`).
- Język dla Ani: `grep` po `migracj|/api|ticket|commit|P6.|.ts` w I6-v2 — zero trafień.

## Poprawki po review
Review nr 1 (`review.md`): 0 BLOCKER / 0 SHOULD-FIX / 3 NICE-TO-HAVE. Poprawione dwa: przykład
„39 dni" w 1.1 zastąpiony „N dni" (liczby stagingu rosną z czasem), plan D2 uzupełniony o rozdział 6.
Trzeci (nota o raporcie 72 w karcie) — bez zmian, review uznało za poprawny.

## Follow-up
- Koordynator: zamknąć Iterację 6 w roadmapie (P6.1 72, P6.2 77, P6.3 85 — wszystkie ✅).
- P10.4: `docs/karty/P10.4/wejscie-85.md`.
