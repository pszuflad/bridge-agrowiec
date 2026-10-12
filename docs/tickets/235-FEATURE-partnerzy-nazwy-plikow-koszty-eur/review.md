# 235-FEATURE-partnerzy-nazwy-plikow-koszty-eur — Code review

> Reviewed: 2026-10-12
> Branch: claude/peaceful-gates-a8yebr
> Diff: 20 plików, 1 commit ticketu (ee14bc4) + DOCS 47c51c7

## BLOCKER

Brak. Walidacja `nazwaPliku` (`/^[A-Za-z0-9_-]{1,60}$/`, `repos/partnerzy.ts:116-120`) wyklucza `/`, `\`, `.` i `..`, a w JS `$` nie przepuszcza końcowego `\n`, więc path traversal przez API jest zamknięty. Wartość trafia tylko do nazwy pliku w `partnerzy/<id>/pricelist|archive`. Nie ma ścieżki pisania do bazy z pominięciem walidatora (`dodajPartnera` i `edytujPartnera` biorą wynik walidatora).

## SHOULD-FIX

- [ ] `rebuild/frontend/src/pages/partnerzy/UstawieniaPartnera.tsx:53` i `api.ts:125-148` — panel nie ma pola `nazwaPliku`. Typ `SzczegolyPartnera` i `UstawieniaDoZapisu` go nie znają.
  - Reason: plan (pkt 2) zakłada nazwy typu `adtyres_agrowiec_at.csv`, ale bez pola w panelu da się to ustawić tylko ręcznym PUT. Backend i frontend są niespójne (API zwraca `nazwaPliku`, UI go ignoruje). Plan pkt 7 wymienia tylko KrajePartnera, więc to luka w planie, nie pomyłka kodu.
  - Suggestion: dodać pole w `UstawieniaPartnera` (placeholder = slug nazwy) i test. Jeśli to świadomie poza zakresem, zapisać to w raporcie.
- [ ] `rebuild/backend/src/repos/partnerzy.ts:116` — brak testów backendu dla nowej walidacji: `nazwaPliku` (poprawne, `../x`, `a.b`, 61 znaków, `null`, zapis przez PUT i odczyt przez GET) i `przesylkaStalaEur` (ujemna, NaN, `null`, brak pola). Nie ma też testu `ostatniKurs` w `szczegolyPartnera`.
  - Reason: to granica API i miejsce wrażliwe na bezpieczeństwo. Dziś nic nie pilnuje regexu.
- [ ] `rebuild/backend/src/partnerzy/generator.ts:61` — brak testu `wyczyscArchiwum` dla starego formatu `YYYYMMDD_HHMMSS_<plik>` (regex ma go obsługiwać, ale test `generator.test.ts:150` sprawdza chyba tylko jeden format).
- [ ] `rebuild/backend/src/partnerzy/generator.ts:139-143` — regresja nazw: po zmianie schematu stare pliki (`adtyres_AT.csv`, `adtyres.csv` itp.) zostają w `pricelist/` obok nowych i nikt ich nie usuwa. Przy zmianie `nazwa_pliku` dzieje się to samo. Stare pliki z nieaktualnymi cenami będą wyglądały jak aktualny cennik.
  - Reason: dziś na produkcji nie ma partnerów, więc ryzyko jest małe. Przy pierwszym FTP/e-mailu (poziom 4) stary plik może wyjść do partnera.
  - Suggestion: po udanym zapisie usuwać z `pricelist/` pliki spoza bieżącego zestawu nazw. Albo odnotować w planie i raporcie, że to świadomie odłożone.
- [ ] `rebuild/backend/src/partnerzy/generator.ts:63-70` — archiwum „1 plik na dzień": stare kopie z godziną (`YYYYMMDD_HHMMSS_<plik>`) z tego samego dnia zostają obok nowej `YYYYMMDD_<plik>`. Znikną dopiero po 30 dniach. Zachowanie jest akceptowalne, ale warto je opisać w `wpis-235.md`.
- [ ] `rebuild/backend/src/partnerzy/kurs-nbp.ts:116-125` — `ostatniUzytyKurs` pobiera `.all()` całą historię `partner_kursy` partnera i szuka `find` po kraju. Wołane jest to w pętli po krajach w `szczegolyPartnera` (`repos/partnerzy.ts:206`), a każde generowanie dodaje wiersze (`harmonogram 60 min`, plan poza zakresem).
  - Reason: koszt rośnie liniowo z historią, razem N krajów × cała historia na każde otwarcie panelu.
  - Suggestion: `where(and(partnerId, kraj)).orderBy(desc(id)).limit(1)`. Opcjonalnie indeks.
- [ ] `rebuild/backend/src/partnerzy/kalkulator.ts:104-105` — przy stałej przesyłce kraju nadal dodawane są ostrzeżenia „waga uzupełniona automatycznie / szacowana", choć waga nie wpływa już na cenę (chyba że formuła użyje zmiennej `waga`). To szum w logach `partner_error_log`.
- [ ] `rebuild/backend/src/partnerzy/selekcja.ts:141` — blokada 0 % jest tylko w `wycenPozycje`. `obliczCene` nadal liczy cenę dla narzutu 0 (jedyny wołający to `selekcja.ts:155`, więc dziś bez luki). Reguła nie jest w kalkulatorze, więc przyszły wołający ją ominie. Opisać w komentarzu przy `obliczCene` albo przenieść.
- [ ] `docs/tickets/235-…/` — brak `raport.md`, a `plan.md` nie ma sekcji „Definition of done". Nie da się sprawdzić wyników testów ani bramek (lint, typecheck, build, test) z raportu. Wyniki wymagają potwierdzenia.
- [ ] Zmiana semantyki `koszty_dodatkowe` (PLN → EUR) i formuły domyślnej: istniejące pola obliczeniowe partnerów, które dzielą `koszty_dodatkowe / kurs_EUR`, będą po cichu liczyć inaczej (kwota mniejsza ~4,3 razy). Plan twierdzi, że na produkcji nie ma partnerów z kosztami, i wolno się na to powołać. Brakuje jednak automatycznej asekuracji (np. testu, który sprawdza, że nie ma partnerów z `koszty_dodatkowe > 0`), a `schema/030` nie ma komentarza o semantyce.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/repos/partnerzy.ts:116-120` — nie ma unikalności `nazwa_pliku` między partnerami. Pliki leżą w `partnerzy/<id>/`, więc dziś nie ma kolizji. Jeśli zbiorczy katalog FTP się pojawi, kolizje będą możliwe.
- [ ] `rebuild/frontend/src/pages/partnerzy/KrajePartnera.tsx:18` — `zapisano` (ISO UTC) jest pokazywane jako „YYYY-MM-DD HH:MM" bez oznaczenia strefy. Dopisać „UTC" albo przeliczyć na czas lokalny.
- [ ] `rebuild/frontend/src/pages/partnerzy/KrajePartnera.tsx` — brak testu dla wariantów `opisKursu` (ręczny bez wartości, `ostatniKurs` ustawiony). Test pokrywa tylko „NBP — jeszcze nie użyto".
- [ ] `rebuild/backend/src/partnerzy/generator.ts:35` — slug i `nazwaPliku` mogą wskazywać na tę samą bazę dla różnych układów (jeden plik vs. `_kraj`). Komentarz w nagłówku mógłby to zaznaczyć.
- [ ] Panel: komunikat błędu „Narzut kraju nie jest ustawiony" jest zwracany z `kod: "*"`. Sprawdzić, czy UI logów dobrze go pokazuje (nie ma kodu produktu).

## Plan compliance

### Done ✓
- Migracja 030 (`@dodaj-kolumne-jesli-brak` dla obu kolumn), `schema.ts`, `schema/README.md`, test migracji.
- Nazwy plików: `<nazwa_pliku|slug>[_kraj małymi].csv|xml`.
- Archiwum 1/dzień (`YYYYMMDD_<plik>`), czyszczenie 30 dni także dla starych nazw.
- Koszty dodatkowe w EUR (formuła domyślna bez dzielenia przez kurs; zaktualizowany test).
- Stały koszt przesyłki kraju zamiast GEIS (puste = GEIS), walidacja po stronie API.
- Blokada przy narzucie 0 % (jeden błąd na kraj, test).
- Panel: kolumny EUR, pole „Przesyłka EUR", kolumna „Używany kurs" (`ostatniKurs` z `partner_kursy`).

### Missing or deviating ✗
- Pole `nazwaPliku` jest w backendzie i API, ale nie w panelu (plan pkt 2 nie mówi, jak je ustawiać; pkt 7 go nie obejmuje).
- Brak `raport.md` i sekcji Definition of done.
- Brak testów walidacji (`nazwaPliku`, `przesylkaStalaEur`) i `ostatniKurs`.
- `contract/openapi.yaml`: w repo nie ma opisu tras partnerów, więc GATE kontraktu nie dotyczy tej zmiany (brak śladu w `contract/`). Zmiana kształtu odpowiedzi `GET /api/partnerzy/:id` (`nazwaPliku`, `przesylkaStalaEur`, `ostatniKurs`) jest nowa, więc `docs/spec-backend/wpis-235.md` jest właściwym miejscem opisu. Nie ruszono eksportu do Selly ani parsowania cenników dostawców.

### Definition of done
- [ ] Brak sekcji DoD w `plan.md` — nie można rozliczyć.
- [x] Zakres z listy 1–7 jest zaimplementowany po stronie backendu.
- [ ] Panel pokrywa tylko część ustawień (brak `nazwaPliku`).

## Parallel-test concerns

None — nowe testy używają bazy w katalogu tymczasowym i `mkdtemp`. Nie dodano stałych portów ani plików o stałej ścieżce.

## Overall assessment

Zmiana jest spójna z planem i bezpieczna: walidacja `nazwaPliku` zamyka path traversal, blokada 0 % i stała przesyłka są pokryte testami. Główne luki to brak pola `nazwaPliku` w panelu, brak testów walidacji API, pozostające po zmianie nazw stare pliki w `pricelist/` oraz niewydajne `ostatniUzytyKurs`. Do merge'a brak blockerów, ale warto domknąć SHOULD-FIX przed włączeniem FTP.
