# TEST.2 — instrukcja testu ŚCIEŻKI KRYTYCZNEJ dla Ani

> **Stan:** ⬜ do zrobienia (razem z TEST.1 i TEST.3, fala „dokumenty dla Ani")
> **Iteracja:** poza iteracjami (przygotowanie do cutoveru) · **Wpisy backlogu:** — · **Zależy od:** I15.9 (delta), I15.11
> **Ticket:** —

Założona przez koordynatora ticketem `148-DOCS-karty-testow`, 2026-09-24, na polecenie użytkownika:
ścieżka krytyczna ma być **osobnym, krótkim dokumentem**, nie rozdziałem w instrukcji całego systemu.
Priorytety, z których ta karta wyrasta: `docs/karty/TEST.1/wejscie-145.md` (decyzja użytkownika 2026-09-24).

## Po co osobny dokument

Ania ma jeden ciąg do przejścia od początku do końca, bez wchodzenia w panel administracyjny.
Jeśli ten ciąg działa, cutover jest możliwy; reszta systemu (TEST.1) może mieć usterki, które
poprawimy po przełączeniu. Dokument ma być **na jedno posiedzenie**.

## Zakres — cztery odcinki, w tej kolejności

**1. Import od dostawców.** Dziesięciu dostawców, trzy drogi dostarczania — opisz je jako trzy
KRÓTKIE scenariusze, nie dziesięć: `url` (MO2, MO3, MO4, MO5, MO9 — automat co 60 min),
`mail` (MO1, MO7, MO8, MO10 — plik wpada z poczty), `upload` (MO6 — Ania wgrywa ręcznie).
**MO9 osobno**: to jedyny dostawca z API (Agro-Rami GraphQL, `AGRORAMI_EMAIL`/`AGRORAMI_PASSWORD`),
nie da się go wywołać plikiem, a przy braku danych logowania import pada bez ostrzeżenia przy starcie.

**2. Parsery → znormalizowana baza.** Dla każdej drogi: czy liczba pozycji zgadza się z plikiem
dostawcy, czy pola trafiły we właściwe kolumny (rozmiar, marka, bieżnik, EAN, cena zakupu, stan),
co poszło do `staging_items` i dlaczego. Tu należy też pokazać, jak Ania sama sprawdza pozycję
„od pliku do katalogu" — jeden wiersz przeprowadzony przez cały łańcuch jest wart więcej
niż zgodna suma kontrolna.

**3. Eksport → plik CSV.** Wygenerowanie pliku (przycisk w panelu oraz to samo polecenie, które
po cutoverze odpali cron o 6:00), gdzie plik ląduje, co ma w środku.

**4. Porównanie ze starą wersją.** Dowód, że nowy generator daje ten sam plik co produkcja.

⚠ **Metoda porównania jest nieoczywista i karta MUSI ją rozstrzygnąć przed pisaniem instrukcji.**
Naiwny `diff` dzisiejszego pliku stagingu z dzisiejszym plikiem produkcji pokaże **szum z rozjazdu
danych**, nie różnicę generatorów: baza stagingu to kopia produkcji z 23.09, a produkcja importuje
dalej. Porównanie ma sens tylko na TEJ SAMEJ zawartości bazy. Dwie drogi — wybierz i uzasadnij:
- uruchomić STARY generator (`mirror/backend/generate_selly_export.cjs`) na kopii bazy stagingu
  i porównać oba pliki wygenerowane z jednego stanu danych (metoda dowodowa, zgodna z
  `tools/record-write-fixtures.cjs` — oryginał da się uruchomić lokalnie);
- albo porównać plik nowego stosu z produkcyjnym CSV **z 23.09**, jeśli uda się go odtworzyć.
Sprawdź, czy porównanie nie jest już zrobione w karcie I15.3 (generator CSV) — jeśli tak, instrukcja
ma się do tego odwołać, a nie powtarzać dowód.

**5. Przepięcie Selly na nowy plik.** Selly jest w modelu **pull**: sklep sam przychodzi po plik
pod adres wpisany w SWOIM panelu (dziś: `agritires.eu/panel/ex-port-files/sellycsv-vDsrv…csv`).
Opisz oba warianty i powiedz wprost, który jest docelowy:
- **cutover (docelowy): nic się nie przepina** — nowy stos pisze pod tę samą produkcyjną ścieżkę,
  więc adres w Selly zostaje bez zmian. To jest argument za tym, żeby NIE ruszać konfiguracji sklepu.
- **test przed cutoverem:** przestawienie adresu na plik stagingu przełącza ŻYWY sklep na dane
  testowe — tylko w umówionym oknie, z udziałem Ani i integratora Selly, i z powrotem po teście.
  Katalog stagingu wymaga wtedy `.htaccess` z białą listą IP (jak produkcyjny), bo plik zawiera
  kolumnę `Cena-zakupu`.

## Czego na stagingu sprawdzić NIE MOŻNA

`SELLY_TRYB=wylaczony`, `SELLY_SCHEDULER` wyłączony i brak sekretów — trzy niezależne blokady
ustawione przez `tools/deploy-staging.sh`. Na stagingu Ania potwierdzi **powstanie i treść pliku**;
zaciągnięcie przez sklep oraz tory API (delty w ciągu dnia, pełna synchronizacja 04:30) dopiero
po przełączeniu na produkcję. Napisz to wprost — nie udawaj, że da się to sprawdzić wcześniej.

## Forma

Polecenie Ani z 2026-09-22: „co zmieniliśmy (jedno zdanie) → polecenie → rezultat". Bez ściany
tekstu. Rozbieżności z logiką biznesową → osobna sekcja „Do Twojej decyzji".
W raporcie podaj użytkownikowi warunki środowiskowe: wersja na stagingu, stan bazy, które automaty
są włączone (import) i wyłączone (Selly).

## Pliki (wyłączna własność)
`docs/instrukcja-testu-sciezki-krytycznej.md` (nowy), `docs/karty/TEST.2/karta.md`, `docs/tickets/<ID>/**`.
NIE: `docs/instrukcja-pelnego-testu.md` (TEST.1), `docs/przeglad-12-widokow.md`, `docs/cutover.md`.

## Decyzje
—

## Dowiezione
—

## Do koordynatora
—
