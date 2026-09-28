# Wejście dla TEST.2 od ticketu 153 (koordynator) · 2026-09-24 — metoda porównania CSV ROZSTRZYGNIĘTA

Karta TEST.2 miała sama wybrać metodę dowodu dla odcinka „porównanie ze starą wersją". **Już nie musi** —
metoda została wykonana 24.09 i od razu wykryła błąd (wpis backlogu `#153.1`, karta `FIX.1`). Opisz
w instrukcji dokładnie tę procedurę.

## Procedura (wykonana, działa)

1. **Żywy generator produkcji bierze się z `origin/main`**, nie z gałęzi roboczej — w `develop` katalog
   `mirror/` jest świadomie cofnięty do stanu z 25.08 (commit `6594525`, bramki wierności). Pierwsze
   podejście użyło wersji z `develop` i pokazało nieistniejącą różnicę „59 kolumn kontra 60”.
2. **Nigdy nie uruchamiaj oryginału wprost** — ma zaszyte `DB_PATH` produkcji i produkcyjny katalog
   eksportu, nadpisałby plik, który Selly zaciąga o 12:00. Uruchamia się kopię z podmienionymi trzema
   stałymi (`DB_PATH`, `OUT_DIR`, `OUT_FILE`) i **kontroluje się je `grep`em przed startem**.
3. Skrypt wymaga obok siebie `payment_blocks.cjs` (też z `origin/main`) i katalogu `node_modules`
   z `better-sqlite3` — wystarczy dowiązanie do `node_modules` wydania stagingu. Woła z tego modułu
   wyłącznie `getBlockedPaymentForms()` (czysty odczyt mapy), `ensurePaymentBlocks()` z `ALTER TABLE`
   nie jest stamtąd wywoływane, więc baza zostaje nietknięta.
4. Oba pliki generuje się **z tej samej bazy, jeden po drugim** — scheduler importu na stagingu jest
   włączony, więc przerwa między nimi wprowadza szum w cenach i stanach.
5. Porównanie: nagłówek, liczba wierszy, `diff`, a przy różnicach **rozkład na kolumny** (ile wierszy
   różni się w której kolumnie) i podgląd pierwszego różniącego się wiersza kolumna po kolumnie.
   Sam `diff` mówi „899 linii” i nic więcej; rozkład na kolumny od razu pokazał pięć flag.

Komendy w formie gotowej do wklejenia: raport ticketu `docs/tickets/153-DOCS-flagi-tak-w-csv/raport.md`.

## Co to znaczy dla instrukcji

Ten dowód jest **dla nas**, nie dla Ani — wymaga SSH na VPS i podmieniania stałych w skrypcie.
W instrukcji dla Ani zostaw z niego tylko **wynik** („plik nowego stosu jest identyczny z produkcyjnym,
sprawdzone tą metodą, ostatnio <data>”) i krótkie „co sprawdzić w panelu”: że plik się wygenerował,
ma dzisiejszą datę i sensowną liczbę pozycji. Procedurę opisz w sekcji technicznej albo odeślij do
raportu ticketu.

⚠ Dopóki `FIX.1` nie jest zrobione, **dowód nie wychodzi na zero** — instrukcja nie może twierdzić,
że pliki są identyczne. Sprawdź stan `FIX.1` przed napisaniem tego akapitu.
