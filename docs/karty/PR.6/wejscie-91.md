# Wejście dla PR.6 od ticketu 91 (PR.1) · 2026-09-22

Karta PR.1 zamknięta — ekran „Archiwum importów" jest dowieziony. `docs/przeglad-12-widokow.md`
(stan 2026-09-08) w ogóle nie wymienia archiwum: dokument ma sekcje `## 0.` … `## 12.` (Logowanie
→ Moje konto, bez numeru dla archiwum) i zero wystąpień słowa „archiw" w treści — bo w chwili
jego przygotowania widoku jeszcze nie było (to był „jedyny czysty brak funkcji obecnej w
produkcji", karta PR.1). PR.6 musi więc **dodać nową sekcję**, nie poprawiać istniejącej.

## Gdzie wstawić

Sidebar ma teraz „Archiwum importów" zaraz za „Historią" (`components/nawigacja.ts`). W
`docs/przeglad-12-widokow.md` sekcja `## 9. Historia — adres /historia` kończy się w linii 197
(przed `---` w linii 198, dalej `## 10. Konfiguracja`). Naturalne miejsce na nową sekcję to
zaraz po Historii, przed Konfiguracją — ale doc ma dziś numerację ciągłą `0`–`12` w tytułach
(„## 1. Pulpit", „## 2. Staging"…), więc wstawienie w środku wymaga decyzji: renumerować
wszystko od Konfiguracji w dół (10→11, 11→12, 12→13) albo użyć numeru pozasekwencyjnego
(„9a.”). Zostawiam decyzję PR.6 — to zmiana struktury całego dokumentu, nie punktowa.

Tytuł dokumentu („Przegląd 12 widoków") i nagłówek w linii 27 („na każdym z 12 ekranów") też
odnoszą się do liczby 12 — z archiwum robi się 13. Do rozważenia przy tej samej okazji.

## Co ma zawierać nowa sekcja

- **Adres:** `/archiwum`.
- **Ma się pokazać:** nagłówek + podtytuł, przycisk „Odśwież", 3 selecty (dostawca, miesiąc,
  status), pasek zajętości (`bajtow/limitBajtow · N plików · retencja 7 dni` — limit 5 GB),
  tabela 8 kolumn: Data, Dostawca, Źródło (+ użytkownik), Plik (+ błąd ≤120 znaków), Rozmiar,
  Rekordy, Status OK/BŁĄD, „Pobierz".
- **Do kliknięcia:**
  - filtry dostawca/miesiąc/status zawężają listę (opcje selectów dostawcy/miesiąca liczone z
    aktualnie przefiltrowanej listy — dziwactwo 1:1 ze starego Bridge'a, warte jednej uwagi w
    „Do kliknięcia", żeby Ania nie zgłosiła tego jako błąd);
  - „Pobierz” zapisuje plik pod **oryginalną nazwą**, jaką miał u dostawcy (nie pod nazwą
    archiwalną) — to jest sedno widoku: odpowiedź Ani 12.1 mówi, że używa archiwum do
    porównania pliku dostawcy z katalogiem i do weryfikacji brakujących pozycji, więc pobranie
    musi dać plik możliwy do otworzenia i porównania 1:1.
- **Rzeczy, które wyglądają inaczej — i to jest w porządku** (do sekcji zbiorczej w linii 265):
  toast zamiast `alert()` przy błędzie pobrania; wybrana wartość filtra zostaje widoczna na
  liście opcji nawet gdy zniknie z danych (oryginał wtedy pokazywał „Wszyscy dostawcy"); błąd
  listy znika po udanym odświeżeniu zamiast wisieć do przeładowania strony.

Źródło szczegółów: `docs/tickets/91-FEATURE-archiwum-importow/plan.md` (Decisions D1–D8),
`raport.md` (Deviations from plan), `docs/karty/PR.1/karta.md` („Dowiezione”).
