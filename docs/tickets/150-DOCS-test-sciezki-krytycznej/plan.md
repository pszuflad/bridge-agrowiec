# 150-DOCS-test-sciezki-krytycznej — instrukcja testu ścieżki krytycznej dla Ani

> Status: Draft
> Branch: `docs/150-test-sciezki-krytycznej`
> Worktree: `.worktrees/150-DOCS-test-sciezki-krytycznej`
> Karta: `docs/karty/TEST.2/karta.md`

## Opis ticketa

Napisać instrukcję testu ścieżki krytycznej dla Ani — dokument 2 z trzech, najważniejszy.
Plik: `docs/instrukcja-testu-sciezki-krytycznej.md`. Pięć odcinków: (1) import od dostawców
trzema drogami (`url`, `mail`, `upload`), z MO9 osobno bo to jedyne API; (2) parsery i zapis
znormalizowanych danych do bazy, z przeprowadzeniem jednej pozycji przez cały łańcuch od pliku
do katalogu; (3) wygenerowanie pliku CSV; (4) dowód, że nowy generator daje ten sam plik co
stary; (5) sprawa adresu feedu w Selly (model pull).

Dwie rzeczy do rozstrzygnięcia PRZED pisaniem: metoda porównania CSV oraz wariant przepięcia
Selly. Wprost napisać, czego na stagingu sprawdzić nie można.

## Kontekst

Karta TEST.2 (`docs/karty/TEST.2/karta.md`) wyrasta z priorytetów użytkownika
(`docs/karty/TEST.1/wejscie-145.md`, 2026-09-24): instrukcja ma być uporządkowana według ryzyka
biznesowego, nie ekranów. Ścieżka krytyczna została wydzielona z TEST.1 jako osobny, krótki
dokument „na jedno posiedzenie" — jeśli ten ciąg działa, cutover jest możliwy.

Granice wobec dwóch pozostałych dokumentów są czyste i nie zachodzą na siebie:
- **TEST.1** (`docs/instrukcja-pelnego-testu.md`, jeszcze nie istnieje) — pełny przegląd systemu,
  panel administracyjny, pozostałe ekrany;
- **TEST.3** (`docs/instrukcja-pracy-dla-ani.md`) — zasady pracy Ani z Claude Code po testach,
  nie jest instrukcją testu.

Ustalenia z rozpoznania, na których stoi dokument:

- **Przypisanie dróg dostarczania potwierdzone w danych produkcji**, nie z nazw: `db/snapshot.db`,
  tabela `suppliers`, kolumna `sposob_dostarczania`. `url` = MO2 (JMK), MO3 (Grasdorf), MO4
  (Handlopex Wrocław), MO5 (Handlopex Rzeszów), MO9 (Agro-Rami); `mail` = MO1 (Bohnenkamp),
  MO7 (Nokian), MO8 (Trelleborg), MO10 (GRI); `upload` = MO6 (Agrowiec/Uniglory).
- **MO9 ma `sposobDostarczania='url'` tylko jako fasadę** — URL `agroopony.eu/imports/agrorami.csv`
  istnieje po to, żeby harmonogram nie przerywał się na „Brak URL"; dane realnie idą z GraphQL
  (`rebuild/backend/src/import/legacy/parsers/mo9_agrorami.cjs:11-19`).
- **Stary generator w `mirror/` na `develop` jest NIEAKTUALNY** (59 kolumn, bez
  `Blokowane-formy-platnosci`). Wersja produkcyjna z 60. kolumną: `git show
  88fa31c:mirror/backend/generate_selly_export.cjs`. Uruchomienie starego generatora z `develop`
  dałoby fałszywy rozjazd — to pułapka do ominięcia w kroku dowodowym.
- **Dowód równoważności generatorów jest zrobiony tylko CZĘŚCIOWO** — patrz „Decyzje", D1.
- **Dwa założenia karty TEST.2 rozjechały się ze stanem stagingu** po audycie środowiska z
  2026-09-24 (`docs/cutover.md` §3a): `IMPORT_SCHEDULER=true` (automat URL włączony, realnie
  odpytuje serwery dostawców) i `AGRORAMI_*` ustawione (MO9 zaimportuje się normalnie).
  To korekta stanu faktycznego, nie zmiana zakresu — trafia do „Do koordynatora".
- **Nowy stos pisze CSV pod tę samą ścieżkę produkcyjną co stary** (`rebuild/backend/src/config/env.ts:138-146`,
  domyślne `SELLY_CSV_DIR`/`SELLY_CSV_PLIK`/`SELLY_CSV_URL`) — to jest twardy dowód pod tezę
  „po cutoverze nic się nie przepina".

## Kontrakt i fixtures (zakres)

**Brak — ticket nie dotyka kontraktu.** Zmiana jest wyłącznie dokumentacyjna: powstaje jeden nowy
plik w `docs/` plus artefakty ticketa i aktualizacja własnej karty. Żaden plik w `rebuild/`,
`contract/` ani `rebuild/schema/` nie jest modyfikowany, więc GATE odbudowy nie obowiązuje.

Ticket **czyta** kontrakt, żeby instrukcja podawała prawdziwe nazwy i ścieżki:
`POST /api/dostawcy/{kod}/synchronizuj-teraz`, `POST /api/dostawcy/{kod}/upload`,
`POST /api/selly/generate-csv`, trasy `/api/staging/{id}/*`. Nazwy przycisków i kolumn biorę
z `rebuild/frontend/src/`, nie z roadmapy.

Osobno: krok dowodowy D1 **uruchamia** nowy generator na kopii bazy, ale niczego w repo nie zmienia
— jego wynik jest wejściem do treści dokumentu.

## Decyzje

**D1. Dowód równoważności generatorów CSV — przeprowadzam go w tym tickecie.** (decyzja
użytkownika, 2026-09-24)
Stan zastany: karta I15.3 / ticket 122 zostawiły stały test porównujący **linię nagłówkową** bajt
w bajt z realnym plikiem produkcji (`rebuild/backend/test/selly.generator-csv.test.ts`,
nagranie `test/nagrania/selly-csv-naglowek.csv` z `origin/main@88fa31c`). Pełnego porównania
**treści wierszy na tej samej bazie nie ma** — liczby w raporcie 122 (8209 vs 5461) pochodzą
z różnych momentów produkcji i są nieporównywalne. Odesłanie do I15.3 pokrywa więc format, ale
nie zawartość, a karta TEST.2 wprost uznaje to za niewystarczające.
Metoda (wariant pierwszy z karty): kopia `db/snapshot.db` → migracje 001–013 → na TEJ SAMEJ
kopii stary generator z `88fa31c` (podmienione `DB_PATH`/`OUT_DIR`) i nowy `npm run selly:csv`
→ `diff`. Odrzucony wariant drugi (porównanie z produkcyjnym CSV z 23.09): pliku nie mamy,
a odtworzenie go wymagałoby dostępu do produkcji.
Rozważone i odrzucone: samo odesłanie do testu nagłówka (zostawia odcinek 4 dziurawy) oraz dowód
jako osobny ticket (może nie zdążyć przed cutoverem).

**D2. MO9 — zachowanie przy braku sekretów tylko opisuję, bez klikania.** (decyzja użytkownika)
Na stagingu `AGRORAMI_*` są ustawione, więc Ania klika „Synchronizuj" i sprawdza, że import
przechodzi. Scenariusz awarii wymagałby usunięcia sekretów i restartu — ryzyko zostawienia
stagingu bez MO9. W zamian opisuję różnicę, która jest tu istotna merytorycznie: **oryginał**
łapał wyjątek wewnątrz `L4()` i po cichu podmieniał dane na stary CSV o znanych niewiarygodnych
stanach, zapisując alert **sukcesu**; **nowy stos** świadomie nie ma tego fallbacku i daje
czytelny alert błędu. To jest świadome odstępstwo od oryginału, już zatwierdzone wcześniej —
w instrukcji występuje jako informacja, nie jako nowa decyzja.

**D3. Droga `url` na przycisku ręcznym, automat jako obserwacja.** (decyzja użytkownika)
Test ma być powtarzalny i natychmiastowy, a dokument „na jedno posiedzenie". Automat (włączony,
co 60 min) dostaje krótką notkę: w `/archiwum` pojawią się wpisy, których Ania nie wywołała —
to normalne, nie błąd.

**D4. Selly — oba warianty opisane, docelowy wskazany wprost.** (z karty i z polecenia użytkownika)
Wariant docelowy: **cutover — nic się nie przepina**, bo nowy stos pisze pod tę samą produkcyjną
ścieżkę, więc adres w panelu Selly zostaje bez zmian. Wariant testu przed cutoverem (przestawienie
adresu na plik stagingu) opisuję razem z jego ceną: przełącza ŻYWY sklep na dane testowe, wymaga
umówionego okna, udziału Ani i integratora, powrotu po teście oraz `.htaccess` z białą listą IP
na katalogu stagingu (plik zawiera kolumnę `Cena-zakupu`). Rekomendacja w dokumencie: nie robić
go bez wyraźnej potrzeby.

**D5. Odstępstwa od oryginału — tylko odnotowane, żadnych nowych.** Ticket jest dokumentacyjny
i niczego nie zmienia w zachowaniu. Odstępstwa, które instrukcja WYMIENIA jako zastane i wcześniej
zatwierdzone: brak fallbacku MO9 (D2), generator CSV in-process zamiast podprocesu (wynik bajtowo
identyczny), `IMPORT_SCHEDULER` domyślnie wyłączony w odbudowie (w oryginale startuje zawsze).

## Plan realizacji

**Krok 1 — dowód równoważności generatorów (D1).** W katalogu tymczasowym, nie w repo:
1. `cp db/snapshot.db` → kopia robocza (nie otwierać oryginału do zapisu — plik ma `-shm`, może
   być w użyciu przez inną sesję).
2. Nałożyć migracje `rebuild/schema/001…013` na kopię (nowy generator czyta kolumny, których
   sierpniowy snapshot nie ma).
3. Stary generator: `git show 88fa31c:mirror/backend/generate_selly_export.cjs` + `payment_blocks.cjs`
   do katalogu tymczasowego, podmienić `DB_PATH` i `OUT_DIR` na kopię/katalog tymczasowy.
   ⚠ NIE brać wersji z `develop` (59 kolumn).
4. Nowy generator: `npm run selly:csv` z `DB_PATH` i `SELLY_CSV_DIR` wskazanymi na tę samą kopię.
5. `diff` obu plików; przy różnicach — policzyć je i zakwalifikować (różnica generatora vs
   artefakt migracji). Wynik zapisać do `raport.md`.
6. Jeśli wyjdą różnice, których nie umiem zakwalifikować jako nieistotne — **STOP i pytanie do
   użytkownika**, nie „naprawianie" pod tezę.

**Krok 2 — napisać `docs/instrukcja-testu-sciezki-krytycznej.md`.** Struktura:
- nagłówek jak w `instrukcja-testow-I10-v2.md`: środowisko, data, dla kogo, ramka „to jest STAGING";
- **Zanim zaczniesz** — warunki środowiskowe i co dziś na stagingu chodzi samo;
- **Odcinek 1** — import: `url` (przycisk „Synchronizuj" w `/konfiguracja` → zakładka „Dostawcy"),
  `mail` i `upload` (przycisk „Wgraj plik"), **MO9 osobno**;
- **Odcinek 2** — parsery i baza + ⭐ **jedna pozycja od pliku do katalogu**: plik dostawcy →
  `/archiwum` (kolumna „Rekordy") → `/staging` (szukanie po EAN, kolumna dodawana
  konfiguratorem kolumn) → `/katalog` (szukajka obejmuje `ean`);
- **Odcinek 3** — CSV: przycisk „Wygeneruj" na `/selly` oraz `npm run selly:csv` (to samo
  polecenie, które po cutoverze odpali cron o 6:00); gdzie ląduje plik na stagingu, co ma w środku;
- **Odcinek 4** — dowód równoważności: gotowy wynik z Kroku 1 + odsyłacz do testu nagłówka jako
  bieżącej straży + krótka lista „co mimo to sprawdź" (czy plik powstaje, czy liczba wierszy jest
  sensowna, czy otwiera się w Excelu z polskimi znakami);
- **Odcinek 5** — Selly: model pull, oba warianty, docelowy wskazany wprost (D4);
- **Czego na stagingu sprawdzić NIE MOŻNA** — osobna, wyraźna sekcja: trzy niezależne blokady
  (`SELLY_TRYB=wylaczony`, brak `SELLY_SCHEDULER`, brak sekretów sklepu), więc zaciągnięcie pliku
  przez sklep i oba tory API dopiero po cutoverze;
- **Do Twojej decyzji** — rozbieżności z logiką biznesową, jeśli wyjdą.

Forma: polecenie Ani z 2026-09-22 (`docs/karty/I15.9/wejscie-104b.md`) — „co zmieniliśmy (jedno
zdanie) → polecenie → rezultat", bez ściany tekstu, checkboxy `- [ ]` i miejsce na ocenę.
Wszystkie nazwy ekranów, przycisków i kolumn brane z `rebuild/frontend/src/`, nie z pamięci.

**Krok 3 — domknięcie karty** (Faza 5): `docs/karty/TEST.2/karta.md` — „Dowiezione", „Decyzje",
oraz „Do koordynatora" z korektą stanu stagingu (automat włączony, sekrety MO9 ustawione).
Ustalenia dla TEST.1 i TEST.3 → `docs/karty/TEST.1/wejscie-150.md` i `docs/karty/TEST.3/wejscie-150.md`.
Nowy fakt o backendzie (jeśli dowód CSV go przyniesie) → `docs/spec-backend/wpis-150.md`.
⛔ `docs/rebuild-roadmap.md` — NIE dotykam.

## Strategia testowania

Ticket nie zmienia kodu, więc nie ma czego testować jednostkowo. Weryfikacja polega na tym, że
**każdy fakt w instrukcji jest sprawdzony w źródle**:
- nazwy przycisków, ekranów i kolumn — odczytane z `rebuild/frontend/src/`, nie z roadmapy;
- ścieżki, metody i kształty — z `contract/openapi.yaml`;
- przypisanie dostawców do dróg — z `db/snapshot.db` (tabela `suppliers`);
- stan stagingu — z `tools/deploy-staging.sh` i `docs/cutover.md` §3a;
- odcinek 4 — z realnie wykonanego porównania (Krok 1), nie z założenia.
Bramki backendu (`lint`/`typecheck`/`build`/`test`) przebiegam **po** synchronizacji z `develop`
mimo braku zmian w kodzie — merge mógł wciągnąć cudze zmiany.

## Poza zakresem

- `docs/instrukcja-pelnego-testu.md` (TEST.1) i `docs/instrukcja-pracy-dla-ani.md` (TEST.3).
- `docs/przeglad-12-widokow.md`, `docs/cutover.md` — cudza własność, tylko czytam.
- Panel administracyjny i pozostałe ekrany (alerty, atrybuty, analityka, waga gabarytowa, konto)
  — należą do TEST.1.
- Jakakolwiek zmiana w `rebuild/` — w szczególności **nie** dopisuję testu pełnego porównania CSV
  do `rebuild/backend/test/`; dowód z Kroku 1 jest jednorazową czynnością dowodową. Gdyby miał
  zostać stałą strażą, to osobna decyzja i osobny ticket (→ follow-up).
- Zmiana konfiguracji stagingu lub panelu Selly — instrukcja opisuje, nie przestawia.

## Definition of done

- [ ] Dowód równoważności generatorów przeprowadzony na jednej bazie, wynik w `raport.md`
- [ ] `docs/instrukcja-testu-sciezki-krytycznej.md` — pięć odcinków, forma z polecenia Ani z 22.09
- [ ] Odcinek 4 podaje wynik dowodu i odsyła do testu nagłówka, nie powtarza dowodu
- [ ] Odcinek 5 opisuje oba warianty Selly i wskazuje docelowy wprost
- [ ] Osobna sekcja „czego na stagingu sprawdzić NIE MOŻNA" z trzema blokadami
- [ ] Nazwy ekranów, przycisków i kolumn zweryfikowane w `rebuild/frontend/src/`
- [ ] `docs/karty/TEST.2/karta.md` opisuje STAN, z „Do koordynatora" o rozjeździe stanu stagingu
- [ ] Ustalenia dla TEST.1/TEST.3 w `wejscie-150.md`, roadmapa nietknięta
- [ ] Gałąź zsynchronizowana z `origin/develop`, bramki zielone PO synchronizacji, PR `MERGEABLE`
