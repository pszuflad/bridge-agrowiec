# Wejście dla TEST.1 od ticketu 150 (karta TEST.2) · 2026-09-24

## Ścieżka krytyczna jest już pokryta — odesłać, nie powtarzać

`docs/instrukcja-testu-sciezki-krytycznej.md` (gotowy, pięć odcinków) pokrywa: import trzema
drogami (`url`/`mail`/`upload`), MO9 osobno (jedyny dostawca przez API), parsery i staging,
generowanie CSV, dowód równoważności generatorów, adres feedu w Selly. **TEST.1 ma do tego
odesłać jednym linkiem na początku**, nie powtarzać żadnego z tych pięciu odcinków. Zostaje dla
TEST.1: panel administracyjny i pozostałe ekrany — priorytet „20%" opisany w
`docs/karty/TEST.1/wejscie-145.md`.

## Warunki środowiskowe stagingu — jeden opis, nie dwa rozbieżne

Nagłówek `docs/instrukcja-testu-sciezki-krytycznej.md` (sekcja „Zanim zaczniesz") już opisuje:
wersja z `develop` (stan 24.09), baza = kopia produkcji z 23.09, automat importu `url` włączony
i odpytuje co 60 min, integracja Selly wyłączona. **Jeśli TEST.1 też opisuje warunki
środowiskowe — ma to być TEN SAM opis**, nie osobno wyprowadzony i ewentualnie rozjeżdżający się
w szczegółach (np. w dacie kopii bazy albo w tym, czy automat importu chodzi).

## Konkrety UI, które można wziąć bez ponownego sprawdzania

Zweryfikowane w kodzie przy tickecie 150 (`raport.md`, sekcja „Wyniki testów"), TEST.1 może
przyjąć bez ponownej weryfikacji:

- menu: `Staging`, `Katalog`, `Alerty`, `Archiwum importów`, `Konfiguracja`, `Selly` —
  `rebuild/frontend/src/components/nawigacja.ts:42-59`;
- Konfiguracja → Dostawcy: przycisk „Synchronizuj"/„Synchronizuję…" — `pages/konfiguracja/Dostawcy.tsx:314`;
  „Wgraj plik" — `:341`; rozszerzenia `.csv,.xml,.xlsx` — `:322`; „Plik wczytany" — `:206`;
  „Błąd uploadu" — `:130`;
- Archiwum importów, kolumny: Data, Dostawca, Źródło, Plik, Rozmiar, Rekordy, Status —
  `pages/archiwum-importow/TabelaArchiwum.tsx:39-45`;
- Staging: szukajka „Szukaj po kodzie, nazwie, dostawcy lub EAN…" — `pages/Staging.tsx:222`,
  faktycznie obejmuje EAN (`repos/staging.ts:117`, `like(stagingItems.eanRaw, wzorzec)`);
  przycisk „Kolumny" — `pages/staging/KonfiguratorKolumn.tsx:84`; przycisk „Szczegóły" →
  sekcja „Podgląd różnic" — patrz ostrzeżenie niżej;
- Selly: sekcja „Codzienna synchronizacja CSV", przycisk „Wygeneruj CSV teraz", potwierdzenie
  „Wygenerować plik CSV teraz? Zastąpi bieżący plik pobierany przez Selly.", komunikaty
  „⏳ Generuję plik CSV…", „✓ Wygenerowano — N produktów (X MB) w Y s", link
  „Pobierz / podgląd CSV ↗" — `pages/selly/SekcjaCsv.tsx:27,53,81,118,125`;
  `generate-csv`/`csv-status` nie zależą od `SELLY_TRYB` ani od klienta Selly
  (`routes/selly.ts:372,389`), więc ten przycisk działa też na stagingu.

## Ostrzeżenie — lista „Dodatkowe (z katalogu)" w oknie „Kolumny" Stagingu nic nie pokazuje

To wierne odtworzenie oryginału (decyzja D3 przy karcie 14b), nie błąd. Cztery pola
(`ex_ean`, `ex_rozmiar`, `ex_marka`, `ex_model`) są w `pages/staging/kolumny.ts` oznaczone jako
`dodatkowa`, ale **nie ma ich w `KOLEJNOSC_KOLUMN`** i `TabelaStagingu.tsx` ich nie renderuje —
zaznaczenie checkboxów w popoverze nic nie zmieni w tabeli (popover sam to mówi: „Te kolumny
nie są jeszcze wyświetlane w tabeli stagingu"). **Do oglądania surowego wiersza z pliku
dostawcy (EAN, rozmiar, marka, bieżnik…) służy przycisk „Szczegóły" → sekcja „Podgląd różnic"**,
nie okno „Kolumny". Ta pułapka kosztowała w tickecie 150 jeden BLOCKER w review — jeśli TEST.1
pisze cokolwiek o konfiguratorze kolumn Stagingu, niech od razu użyje ścieżki „Szczegóły".

## Otwarte pytanie do Ani, które TEST.1 powinien znać

MO6 (Agrowiec/Uniglory) nie ma ani jednego produktu w katalogu i nie ma go w pliku CSV (pomiar
na kopii bazy z 13.08 — na bazie stagingu z 23.09 może być inaczej). W instrukcji ścieżki
krytycznej postawione jako pytanie w sekcji „Do Twojej decyzji", punkt 1. Jeśli Ania odpowie
„to błąd", może to mieć znaczenie też dla ekranów katalogu/alertów, które TEST.1 opisuje.
