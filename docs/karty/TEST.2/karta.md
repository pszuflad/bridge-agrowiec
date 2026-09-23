# TEST.2 — instrukcja testu ŚCIEŻKI KRYTYCZNEJ dla Ani

> **Stan:** ✅ 2026-09-24 · 150-DOCS-test-sciezki-krytycznej
> **Iteracja:** poza iteracjami (przygotowanie do cutoveru) · **Wpisy backlogu:** — · **Zależy od:** I15.9 (delta), I15.11
> **Ticket:** `150-DOCS-test-sciezki-krytycznej`

Założona przez koordynatora ticketem `148-DOCS-karty-testow`, 2026-09-24, na polecenie użytkownika:
ścieżka krytyczna ma być **osobnym, krótkim dokumentem**, nie rozdziałem w instrukcji całego systemu.
Priorytety, z których ta karta wyrasta: `docs/karty/TEST.1/wejscie-145.md` (decyzja użytkownika 2026-09-24).

## Po co osobny dokument

Ania ma jeden ciąg do przejścia od początku do końca, bez wchodzenia w panel administracyjny.
Jeśli ten ciąg działa, cutover jest możliwy; reszta systemu (TEST.1) może mieć usterki, które
poprawimy po przełączeniu. Dokument ma być **na jedno posiedzenie**.

## Zakres — pięć odcinków, w tej kolejności

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

Trzy decyzje użytkownika, 2026-09-24 (pełny kontekst: `docs/tickets/150-DOCS-test-sciezki-krytycznej/plan.md`,
sekcja „Decyzje" D1–D3):

- **D1 — dowód równoważności generatorów CSV przeprowadzony w tym tickecie**, nie odesłany do
  I15.3/ticket 122 — tamten dowód pokrywa tylko wiersz nagłówkowy, nie treść wierszy.
- **D2 — MO9 (brak sekretów) tylko opisane, bez klikania na stagingu** — `AGRORAMI_*` są tam
  ustawione, więc scenariusz awarii wymagałby ich usunięcia i restartu; ryzyko zostawienia
  stagingu bez MO9 nieuzasadnione.
- **D3 — droga `url` testowana przyciskiem ręcznym, automat (włączony, co 60 min) tylko jako
  obserwacja** — dokument ma być powtarzalny i „na jedno posiedzenie".

## Dowiezione

Ticket `150-DOCS-test-sciezki-krytycznej`, 2026-09-24.

- **`docs/instrukcja-testu-sciezki-krytycznej.md`** — pięć odcinków: (1) import trzema drogami
  (`url`/`mail`/`upload`) z MO9 osobno jako jedyny dostawca przez API; (2) parsery i zapis do
  bazy, z przeprowadzeniem jednej pozycji od pliku dostawcy do katalogu; (3) generowanie pliku
  CSV; (4) dowód równoważności generatorów; (5) adres feedu w Selly (model pull).
- **Rozstrzygnięcie metody porównania CSV.** Karta kazała sprawdzić, czy dowód nie jest już
  zrobiony w I15.3 — jest tam **tylko częściowo**: stały test porównuje wyłącznie wiersz
  **nagłówkowy** bajt w bajt (`rebuild/backend/test/selly.generator-csv.test.ts`); porównania
  treści wierszy na tej samej bazie nie było. Przeprowadzono więc **pierwszy wariant z karty**.
  ⚠ **Wynik wymaga czytania razem z `wejscie-153.md`** (weszło na `develop` w trakcie ticketu):
  - **na kopii `db/snapshot.db` z 13.08 + migracje 001–013 pliki wyszły identyczne bajt w bajt**
    (ten sam sha256, 6899 linii, 3 177 786 B, 60 kolumn, 6898 pozycji; reviewer powtórzył
    niezależnie i dostał ten sam sha256);
  - **na bazie stagingu (kopia produkcji z 23.09) ten sam pomiar daje 899 różniących się
    wierszy** — ticket 153, wpis backlogu `#153.1`, karta `FIX.1`, **blokada cutoveru**;
  - **oba wyniki są prawdziwe.** Snapshot z 13.08 ma wszystkie dziesięć kolumn flagowych
    wyłącznie w typie `integer`, więc błąd „tekst `'Tak'` czytany przez Drizzle jako `false`"
    **nie ma tam jak się ujawnić**. Tekst `'Tak'` wszedł do bazy po 13.08.
  - **Wniosek metodyczny dla przyszłych pomiarów:** porównanie generatorów prowadzi się **na
    bazie stagingu**, nie na sierpniowym snapshocie; a zerowy `diff` podważa się tak samo jak
    niezerowy — trzeba sprawdzić, czy dane w ogóle zawierają przypadek, który mógłby zapalić
    czerwone. Kontrola nietrywialności w tym tickecie objęła wypełnienie 60. kolumny, ale nie
    rozkład TYPÓW w kolumnach flagowych, i to był brakujący krok.
  - Instrukcja dla Ani opisuje **stan faktyczny**, czyli wynik ticketu 153, i nazywa go blokadą
    przełączenia. Pełny rozbiór: `docs/tickets/150-DOCS-test-sciezki-krytycznej/dowod-csv.md`,
    sekcja „Dlaczego ten wynik NIE uogólnia się".
- **Rozstrzygnięcie wariantu Selly.** Docelowy = „przy cutoverze nic się nie przepina", bo
  `rebuild/backend/src/config/env.ts:138-146` ma domyślne `SELLY_CSV_DIR`/`SELLY_CSV_PLIK`/
  `SELLY_CSV_URL` ustawione na tę samą ścieżkę produkcyjną co stary generator. Wariant testowy
  (przestawienie adresu w panelu Selly na plik stagingu) opisany razem z ceną (żywy sklep, okno,
  integrator, `.htaccess` z białą listą IP) i odradzony.

## Do koordynatora

1. **Dwa założenia tej karty rozjechały się ze stanem stagingu** po audycie środowiska z
   2026-09-24 (`docs/cutover.md` §3a): karta zakładała, że automat importu jest czymś tylko
   opisywanym, a na stagingu jest **włączony** (`IMPORT_SCHEDULER=true`,
   `IMPORT_SCHEDULER_PIERWSZY_PRZEBIEG=true`) i realnie odpytuje serwery dostawców co 60 min;
   karta zakładała też, że przy MO9 da się pokazać awarię przy braku sekretów, a `AGRORAMI_*`
   **są na stagingu ustawione**, więc MO9 importuje się normalnie. Korekta faktu, nie zmiana
   zakresu — instrukcja to uwzględnia (automat opisany jako „chodzi sam", MO9 tylko opisane
   bez klikania scenariusza awarii, decyzja D2).
2. **Pułapka dla każdej przyszłej karty sięgającej po „oryginał":**
   `mirror/backend/generate_selly_export.cjs` na `develop` ma 59 kolumn, bez
   `Blokowane-formy-platnosci` — o jedną mniej niż wersja produkcyjna. **Nie jest to jednak
   zaniedbanie, tylko stan świadomy:** `mirror/` w `develop` jest cofnięty do stanu z 25.08
   (commit `6594525`, bramki wierności) — ustalenie z `wejscie-153.md`. Żywy generator produkcji
   bierze się więc z **`origin/main`** (sprawdzone: `88fa31c` i `origin/main` dają tu identyczny
   plik). Porównanie z wersją z `develop` pokazuje nieistniejącą różnicę „59 kontra 60 kolumn" —
   ticket 153 wszedł w tę pułapkę przy pierwszym podejściu.
3. **Instrukcja opisała zachowanie, którego karta nie przewidziała:** przy
   `SELLY_TRYB=wylaczony` serwer nie montuje modułu dostępności (`rebuild/backend/src/server.ts:90`),
   więc na stagingu plik CSV **nie odświeża się sam po imporcie** — trzeba kliknąć
   „Wygeneruj CSV teraz". Na produkcji odświeża się automatycznie.
