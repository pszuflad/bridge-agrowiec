# TEST.1 — instrukcja pełnego testu systemu dla Ani

> **Stan:** ✅ 2026-09-24 · 149-DOCS-instrukcja-pelnego-testu
> **Iteracja:** poza iteracjami (przygotowanie do cutoveru) · **Wpisy backlogu:** — · **Zależy od:** I15.9, I15.5, I15.11, I15.10b
> **Ticket:** 149-DOCS-instrukcja-pelnego-testu

Założona przez koordynatora ticketem `138-DOCS-status-i15`, 2026-09-23.

## Zakres
Lista kontrolna **całego systemu bez ścieżki krytycznej** (20% uwagi wg `wejscie-145.md`) przed
przełączeniem. Podstawą jest `docs/przeglad-12-widokow.md` (13 ekranów, zaktualizowany kartą PR.6),
rozszerzony o to, czego przegląd nie obejmuje:
- **staging po zmianach z 22–23.09, część widoczna dla Ani**: okno „Rozstrzygnij" (i „Sprawdź kartę"
  przy starej karcie), okna blokad akceptacji, filtr/odznaka „Braki w cenniku" / „Brak w cenniku";
- **panel administracyjny i reszta ekranów**: archiwum importów, alerty (w tym zakładka „Katalog"),
  atrybuty, analityka z pełnymi plikami CSV (P10.5), waga gabarytowa, konto.

⚠ **Odstępstwo od pierwotnego założenia (decyzja użytkownika 2026-09-24, `wejscie-148.md`).** Karta
zakładała JEDEN dokument obejmujący też ścieżkę krytyczną, MO9 (API Agro-Rami) i Selly (CSV o 6:00,
Tor 1/Tor 2). Wejście 148 podzieliło to na trzy dokumenty: ścieżka krytyczna (import → parsery →
baza → CSV → Selly, w tym MO9) wyszła do **TEST.2**; zasady zgłaszania uwag przez Claude Code do
**TEST.3**. TEST.1 zostaje wyłącznie listą kontrolną **„ekran vs. potok"** (D2) — bierze to, co Ania
widzi i klika na `/staging`, nie to, co potok importu wytwarza.

⚠ **Format: polecenie Ani z 2026-09-22** (`docs/karty/I15.9/wejscie-104b.md`) — na punkt: co zmieniliśmy
(jedno zdanie) → polecenie → rezultat. Bez ściany tekstu. Rozbieżności z logiką biznesową → osobna sekcja
„Do Twojej decyzji".
⚠ W raporcie podaj użytkownikowi **warunki środowiskowe**: jaka wersja ma stać na stagingu, czy baza jest
świeżą kopią produkcji i które automaty są tam włączone (import) lub wyłączone (Selly).

## Pliki (wyłączna własność)
`docs/instrukcja-pelnego-testu.md` (nowy), `docs/karty/TEST.1/karta.md`, `docs/tickets/<ID>/**`.
NIE: `docs/przeglad-12-widokow.md` (zostaje jako osobny dokument), instrukcje `instrukcja-testow-*`.

## Decyzje
Wszystkie użytkownika, 2026-09-24 (pełna treść: `docs/tickets/149-DOCS-instrukcja-pelnego-testu/plan.md`).
- **D1** — stare zgłoszenia w poczekalni (kopia produkcji z 23.09, brak `_policyVersion`): odmowa
  akceptacji jest POPRAWNA, instrukcja każe Ani najpierw zrobić jeden import, dopiero potem akceptować
  świeże pozycje. `staging_items` na serwerze NIE czyścimy.
- **D2** — granica TEST.1/TEST.2 = „ekran vs. potok": TEST.1 bierze to, co Ania klika na `/staging`
  (okno „Rozstrzygnij", okna blokad, podgląd starej karty, etykiety „Braki w cenniku"); TEST.2 bierze
  mechanizmy, które te decyzje WYTWARZAJĄ (blokada niewiarygodnego cennika, wycofania po trzech
  cennikach, auto-wstrzymania).
- **D3** — kratki ✅/❌ jak w `przeglad-12-widokow.md`, żeby dać namacalny wynik testu.
- **D4** — sekcja „Do Twojej decyzji" ma cztery pozycje: #89 (brak pola „priorytet" w regule narzutu),
  brak podziału admin/zwykły użytkownik, #137.2 (ciche nadpisywanie poprawek Marty), cztery podwójne
  bieżniki w `/atrybuty`.
- **D5** — odświeżania dostępności NIE testujemy w tej turze; jedno zdanie, że brak nowego CSV po
  imporcie jest oczekiwany (Selly wyłączone), bez kazania Ani czytać logu backendu.
- **D6** — ostrzeżenie przed „Akceptuj wszystkie" (backlog #129.1: kilka tysięcy pozycji ≈ kilkanaście
  minut w jednym żądaniu), bez odradzania.
- **D7** — kolumna „Blokowane formy płatności" w `/katalog` (ticket 122) wchodzi jedną linijką;
  „—" przy MO6 i nieznanym dostawcy jest poprawne.

**Ustalenie o kolejności blokad, odkryte przy pisaniu (nie decyzja — fakt).** Pozycje z odznaką
„Braki w cenniku" trafiają w blokadę o trzech potwierdzeniach nieobecności
(`rebuild/backend/src/import/polityka/blokady.ts:48-53`), NIE w blokadę o starym imporcie
(`:56-59`) — obie mogą dotyczyć tej samej pozycji, ale blokada o trzech potwierdzeniach jest
wcześniejsza w kolejności sprawdzeń i to jej komunikat Ania zobaczy pierwszy.

## Dowiezione
- `docs/instrukcja-pelnego-testu.md` (300 linii): warunki środowiskowe (adres, wersja, 8329 produktów
  kopia z 23.09, import włączony, Selly wyłączone trzema blokadami) → „Zanim klikniesz cokolwiek
  w poczekalni" (D1, D6) → Część 1, sześć punktów delty od 22.09 w układzie „co zmieniliśmy →
  polecenie → rezultat" (okno „Rozstrzygnij"/„Sprawdź kartę", okna blokad akceptacji, filtr/odznaka
  „Braki w cenniku", kolumna „Blokowane formy płatności", pełne pliki CSV analityki z P10.5, etykieta
  w podsumowaniu wgrywania ręcznego) → Część 2, lista kontrolna 14 pozycji reszty systemu →
  „Czego NIE zgłaszać" (trzy znane defekty z `wejscie-141.md`) → „Do Twojej decyzji" (cztery pozycje
  z D4).
- Wszystkie etykiety UI i komunikaty blokad cytowane z kodu na `develop` (nie z pamięci) — lista
  plik:linia w `docs/tickets/149-DOCS-instrukcja-pelnego-testu/raport.md`.
- Sprostowanie do punktu 8 przeglądu (plik CSV analityki ≠ tabela na ekranie od P10.5) wpisane
  bezpośrednio w dokumencie dla Ani; poprawka samego `przeglad-12-widokow.md` niżej, „Do koordynatora".
- Liczba 3362 (pozycje w poczekalni bez `_policyVersion`, zmierzona na `db/snapshot.db`) świadomie
  NIE trafiła do dokumentu — migawka ma mtime 2026-08-13, baza stagingu jest kopią z 23.09; dokument
  ma jakościowe „dużo zgłoszeń sprzed tej zmiany".
- Zero zmian w `rebuild/`, `contract/`, `rebuild/schema/` — ticket dokumentacyjny, gate odbudowy N/D.

## Do koordynatora
Trzy poprawki do `docs/przeglad-12-widokow.md` (karta TEST.1 NIE jest właścicielem tego pliku, więc
go nie edytuje — poprawki wnosi koordynator):
1. **Punkt 8 i pozycja 9 listy zbiorczej** twierdzą, że plik CSV z Analityki to „dokładnie to, co
   widać w tabeli — ta sama liczba wierszy". Po karcie P10.5 (23.09) to nieprawda dla ośmiu z dziewięciu
   kart z eksportem: tabela rysuje najwyżej 300 wierszy, plik dociąga pełny zbiór bez sufitu SQL.
2. **Punkt 2** opisuje filtr stagingu jako „nowa / zmieniona / wycofana". Realne opcje (`rebuild/frontend/src/pages/staging/dane.ts:75-82`):
   „Wszystkie / Nowe produkty / Nowe produkty (stare) / Braki w cenniku / Zmiany kluczowe / Błędy importu".
3. **Punkt 12** cytuje komunikat ekranu Selly jako „tryb wyłączony". Realny tekst (`rebuild/frontend/src/pages/selly/BladSekcji.tsx:28`):
   **„Integracja Selly wyłączona na tym środowisku"**. Wykryte w review tego ticketa.
