# PR.6 — aktualizacja przeglądu 12 widoków

> **Stan:** ✅ 2026-09-22 · 102-DOCS-przeglad-widokow-aktualizacja
> **Iteracja:** przegląd 12 widoków · **Wpisy backlogu:** — · **Zależy od:** PR.1–PR.5 (wszystkie zmergowane: #108, #112, #105, #106, #114)
> **Ticket:** 102-DOCS-przeglad-widokow-aktualizacja

Przeniesione z roadmapy (blok „Poprawki po testach Ani”, plan P) ticketem `86-DOCS-migracja-kart-etap2`, 2026-09-21.

## Zakres
Aktualizacja `docs/przeglad-12-widokow.md` po wszystkich kartach przeglądu. Wejścia od innych kart:
pliki `wejscie-*.md` w tym katalogu.

## Pliki (wyłączna własność)
`docs/przeglad-12-widokow.md`.

## Decyzje
- **D1 (użytkownik, 2026-09-22):** Archiwum importów jako nowa sekcja „10.” zaraz po Historii
  (kolejność menu), przenumerowanie: Konfiguracja 11, Selly 12, Moje konto 13. Tytuł
  „Przegląd widoków”, w treści „13 ekranów”. **Nazwa pliku bez zmian** — linkują do niego
  `cutover.md`, roadmapa, backlog i karty.
- **D2:** miejsca, które odpowiadają na zgłoszenia Ani, mają układ „Zgłosiłaś → Jest teraz →
  Sprawdź”; punkty nadal prawdziwe zostały bez zmian.

## Dowiezione
- Wejścia: 77 (Pulpit — dwa rodzaje alertów; Alerty — zakładki), 91 (nowa sekcja Archiwum +
  3 różnice do listy zbiorczej), 92 (polskie znaki w alertach, pułapka „stary Bridge zapisuje
  B??d do przełączenia”; liczby 435/2219 NIE trafiły do tekstu dla Ani — są w „Do koordynatora”),
  93 (Selly — dwa kroki, drugi „następnego dnia”, „Plik nie zostal wygenerowany dzisiaj” jako
  poprawne), 97 (kafle KPI, brak reakcji na filtry, limit 1000), 101 (ALLIANCE w filtrze marek,
  „marki” wyglądające jak rozmiar).
- Przegląd całości — każdy punkt sprawdzony z kodem `develop` (79cda97); poprawione zdania,
  których nie niosły wejścia:
  - Pulpit: kafel „Ostatni eksport CSV” działa (P10.2).
  - Katalog: wyszarzona „Historia” w menu Akcje (1:1 z oryginałem).
  - Narzuty: wygasła promocja zostaje na liście.
  - Atrybuty: brak „X zamień na X”, podobieństwo bez wielkości liter (P7.2), ślad akceptacji
    w Historii (P7.1), ostrzeżenie o podpowiedziach w małych literach.
  - Alerty: trzy stany + „Otwórz ponownie”, domyślny filtr „Nierozwiązane”, „Szukaj w treści”
    (P6.1), „Zaakceptuj wszystko” bez potwierdzenia (P6.2).
  - Waga: lista przewoźników wspólna na serwerze (odwrócona nota), potwierdzenia usunięcia
    i „Przywróć domyślne”, mocniejsze okno dla wybranego przewoźnika, kalkulator paletowy
    (P9.1, ticket 84).
  - Analityka: **„zmiana zakresu dat” była błędna od początku** — ekran nie ma pola dat, ma
    pasek sześciu filtrów; karty Dostępności z danymi (P10.1); CSV = tabela po filtrach (P10.3).
  - Historia: bez limitu 5000 (P5.1), filtr „Edycje” (P7.1).
  - Konfiguracja: **osiem zakładek** — ręczne wgrywanie jest osobną zakładką „Wgrywanie
    ręczne”, nie częścią „Dostawcy” (błąd od pierwszej wersji dokumentu); „AI Fallback”.
  - Selly: **ekran nie ma zakładek** „Status”/„Dziennik” (błąd od pierwszej wersji) — pięć kart
    jedna pod drugą.
  - Lista zbiorcza: usunięte „wygasłe promocje nadal obniżają ceny” (sprzeczne z §4 i z kodem
    od 14f) i „karty Dostępności puste”; dopisane pozycje 8–12. Usunięte z tekstu numery
    wpisów backlogu i nazwy plików.
  - „Rzecz znana i nienaprawiona” (brak ról) — nadal prawdziwa, bez zmian.

## Do koordynatora
- **Przegląd 12 widoków do oznaczenia w roadmapie jako zamknięty** (PR.6 ✅).
- **Przed wysłaniem dokumentu Ani** staging musi stać na wydaniu z `develop` ≥ 79cda97
  (po merge'u tego ticketu dowolny deploy): skrypt deployu uruchamia `npm run migrate`
  (`tools/deploy-staging.sh:120`), więc migracje 009 (polskie znaki) i 010 (ALLIANCE) wejdą
  same, a poprawka z ticketu 93 przestaje kasować plik CSV Selly. Bez tego Ania zobaczy „B??d”
  i duplikat marki i zgłosi je ponownie.
- `docs/pytania-do-ani-2026-09-18.md` — pytanie **12.6 jest nieaktualne** (przyczyna ustalona
  w tickecie 93 bez godziny kliknięcia). Pliku nie zmieniałem. W tym samym pliku liczba
  „339 alertów” jest zaniżona: naprawionych wierszy jest 435 (typ) + 2219 (treść) — karta PR.3.
- Otwarte pytanie z backlogu #19 (czy wygasłe promocje ukrywać z listy Narzutów) nadal bez
  decyzji — dokument opisuje stan obecny (zostają z oznaczeniem „zakończona”).
