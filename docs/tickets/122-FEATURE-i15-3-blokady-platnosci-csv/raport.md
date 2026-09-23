# 122-FEATURE-i15-3-blokady-platnosci-csv — raport z implementacji

## Podsumowanie

Karta I15.3: generator CSV dla Selly dostał **60. kolumnę** `Blokowane-formy-platnosci`, nazwy
kategorii sklepu (`toSellyCategoryName` z obsługą `ł`), **zapis atomowy** i **polecenie CLI**
(`npm run selly:csv`) dla crona produkcji; w `/katalog` przybyła kolumna „Blokowane formy płatności".

**Jedna rzecz poszła inaczej, niż zakładała karta.** Karta kazała wystawić pole
`blokowaneFormyPlatnosci` z API katalogu („I15.1 ukryła je jako stan przejściowy — zdejmij to").
Pomiar na oryginale pokazał, że **produkcja tego pola nie wystawia**, więc ujawnienie byłoby
odstępstwem, nie domknięciem długu. Po przedstawieniu wariantów użytkownikowi kolumna liczy
wartość w froncie — dokładnie jak produkcja. Szczegóły niżej.

## Zmiany

### Generator CSV i CLI
- `rebuild/backend/src/selly/generator-csv.ts` — 60. kolumna `Blokowane-formy-platnosci`
  (z fallbackiem `blokowaneFormyDlaDostawcy`, port `getBlockedPaymentForms`);
  `nazwaKategoriiSklepu` (port `toSellyCategoryName`, z jawnym `ł`→`l`); `zapiszAtomowo`
  (tmp + `rename`, ze sprzątaniem pliku tymczasowego przy błędzie); stdout wyrównany do `88fa31c`.
- **Nowy:** `rebuild/backend/src/selly/csv-cli.ts` — wejście dla crona, woła tę samą
  `wygenerujCsvSelly()` co trasa.
- `rebuild/backend/package.json` — `selly:csv` (`node dist/selly/csv-cli.js`) i `selly:csv:dev` (tsx),
  wzorcem istniejących `migrate`/`migrate:dev`.
- **Nowy:** `rebuild/backend/test/nagrania/selly-csv-naglowek.csv` + `README.md` — linia nagłówkowa
  realnego pliku produkcji z `88fa31c` jako wzorzec dla testu.
- `rebuild/backend/test/selly.generator-csv.test.ts` — 12 → 24 testy.
- **Nowy:** `rebuild/backend/test/selly.csv-cli.test.ts` — 3 testy, CLI odpalane jako osobny proces.

### Kolumna w katalogu
- `rebuild/frontend/src/pages/katalog/formatowanie.tsx` — mapa `BLOKOWANE_FORMY_PLATNOSCI`
  + `blokowaneFormyPlatnosci()` (port `VALUES` z `payment-blocks-injection.js`) i gałąź renderu
  („—" dla MO6/nieznanego, pełna lista w `title`).
- `rebuild/frontend/src/pages/katalog/kolumny.ts` — definicja kolumny (etykieta i szerokość 420
  dosłownie ze skryptu produkcji), wpis w `KOLUMNY_DOMYSLNE`, `uzupelnijBlokowaneFormy()`.
- `rebuild/frontend/src/pages/Katalog.tsx` — złożenie obu retrofitów przy odczycie IndexedDB.
- `rebuild/frontend/test/katalog.formatowanie.test.tsx`, `katalog.filtrowanie.test.ts`,
  `katalog.test.tsx` — 11 nowych testów; licznik kolumn `15/59` → `16/60`.

### Sprostowania (to, co ticket obalił — poprawione W MIEJSCU)
- `rebuild/backend/src/repos/kolumny.ts` — komentarz twierdził, że ukrycie pola to „stan przejściowy,
  o kształcie decyduje I15.3". Zastąpiony wywodem z pomiaru: ukrycie ZOSTAJE, to przypadek `uwagaCena`.
- `rebuild/backend/test/katalog.gate.test.ts`, `test/produkty.mutacje.test.ts` — analogicznie
  (asercje bez zmian, poprawione uzasadnienia).

**Bez zmian, świadomie:** `contract/fixtures/**`, `contract/openapi.yaml`, `rebuild/schema/**`,
`mirror/**`, `docs/rebuild-roadmap.md`.

## Odstępstwa od planu

**Jedno, istotne — plan przewidywał wystawienie pola w API; nie wystawiamy go.**

Plan zapowiadał 72 → 73 klucze i sam postawił warunek: „jeśli nagranie NIE da 73 kluczy — STOP
i zgłoszenie, bo to by znaczyło, że produkcja tego pola nie wystawia". Tak się stało.

**Pomiar** (metoda z ticketu 38, który tak samo rozstrzygnął `uwagaCena`): piaskownica z
`git archive 88fa31c mirror/backend`, `db/snapshot.db` jako baza, doprowadzona do stanu produkcji
**własnym modułem oryginału** — `payment_blocks.ensurePaymentBlocks(<ścieżka>)` → `{ ok: true,
rows: 7405 }`, kolumna obecna, oba triggery założone. Start `index.cjs`, logowanie,
`GET /api/products?limit=5` → **72 klucze, bez `blokowaneFormyPlatnosci`**.

Mechanizm: `grep -c blokowane_formy_platnosci mirror/backend/index.cjs` = **0**. Bundle nie zna
kolumny dokładanej runtime'owym `ALTER TABLE`, a produkty czyta Drizzle bez jawnej listy pól, więc
oddaje pola MODELU. Właśnie dlatego produkcja liczy kolumnę w katalogu w przeglądarce — API nie
miało jej skąd wziąć.

Użytkownik dostał trzy warianty (wystawić jako świadome odstępstwo / odtworzyć 1:1 / zawęzić kartę)
i poprosił o rekomendację. Rekomendacja i decyzja: **odtworzyć 1:1**, bo odstępstwo nie dawałoby
Ani nic widocznego (ta sama kolumna, ta sama wartość), a kosztowałoby pierwszy w projekcie fixture
przeczący nagraniu z oryginału — czyli dokładnie taki, jaki następna sesja „naprawia" w dobrej wierze.

**Dwie pułapki po drodze** (obie warte zapamiętania, opisane w „Do koordynatora" karty):
1. `mirror/` na `develop` jest nieaktualny — **nie ma w nim `payment_blocks.cjs`**, `extensions.cjs`
   jest w wersji sprzed 10.09. `tools/record-write-fixtures.cjs` nagrywa dziś ze **złej wersji
   oryginału**. Pierwsze przenagranie zrobiłem właśnie z niego i musiałem je wycofać.
2. `payment_blocks.cjs` ma zaszytą ścieżkę produkcyjną, więc przy lokalnym starcie oryginału
   `ensurePaymentBlocks()` **po cichu pada** („BŁĄD inicjalizacji blokowanych form płatności:
   Cannot open database because the directory does not exist"). Piaskownica bez ręcznego wywołania
   modułu **nie ma kolumny** — i pomiar „pole nie wychodzi" byłby bezwartościowy, bo pola nie ma
   też w bazie. To jest ten sam gatunek pułapki co `atrybuty`/`pending` z CLAUDE.md.

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt): ✓ zgodne.** Sprawdzone: `GET /api/products`
  (`GET_products.json`, `GET_products_bez-parametrow.json`), `PATCH`/`PUT /api/products/{id}`
  (`PATCH_products_id.json`, `PUT_products_id.json`), `POST /api/selly/generate-csv`,
  `GET /api/selly/csv-status` (`GET_selly_csv-status.json`). **Żaden fixture nie wymagał zmiany** —
  i to jest wynik, nie brak pracy: pierwotny plan zakładał ich zmianę, a pomiar pokazał, że
  produkcja oddaje dokładnie to, co już mamy. Bramki po obu stronach jadą z tych samych plików
  (`rebuild/frontend/test/msw/kontrakt.ts` czyta `contract/fixtures/GET_products.json`).
- **Format CSV:** linia nagłówkowa naszego generatora **bajt w bajt** równa pierwszej linii realnego
  pliku produkcji z `88fa31c`.
- **Unit/integracja backend:** ✓ 1647 zdanych, 3 pominięte, 101 plików.
- **Unit/integracja frontend:** ✓ 949 zdanych, 54 pliki.
- **lint / typecheck / build:** ✓ po obu stronach.
- ⚠ Przy pierwszym biegu, gdy obie suity szły równolegle, 4 testy
  `silnik.charakteryzacja.test.ts` padły na `Test timed out in 20000ms`. Bieg samego backendu:
  komplet zielony. To przeciążenie maszyny, nie regresja — ale te testy mają ciasny limit
  i bywają wrażliwe na równoległość (patrz „Do rozważenia").
- **Mutacja kontrolna:** usunięcie `.replace(/ł/g, "l")` z generatora wywraca 2 testy
  (w tym ten o „Przemysłowe") — test faktycznie łapie regresję z 14.09, a nie tylko utrwala kod.

## Pomiar CSV — wiersze przed i po

| Źródło | Wiersze (z nagłówkiem) | Kolumny |
|---|---|---|
| Odbudowa na kopii `db/snapshot.db` — **przed** zmianą | 6899 (6898 aktywnych) | 59 |
| Odbudowa na kopii `db/snapshot.db` — **po** zmianie | 6899 (6898 aktywnych) | **60** |
| Produkcja, `.bak_20260922T160912Z_availability` (przed #104) | 8209 | 60 |
| Produkcja, plik bieżący @ `88fa31c` | 5461 | 60 |

**Liczba wierszy w odbudowie się NIE zmienia — i to jest poprawny wynik**, wbrew temu, czego
spodziewała się karta (`wejscie-110`: „zmiana zachowania widoczna w liczbie wierszy pliku").
Powód: filtr `WHERE status = 'aktywny'` odbudowa miała **od początku** (I8a). Pośredni stan #77
(„eksport obejmuje też wstrzymane, ze stanem 0", produkcja 14–22.09) nigdy do odbudowy nie wszedł,
więc #104 nie ma tu czego cofać — zostaje z niego sam zapis atomowy. Spadek 8209 → 5461 to zmiana
**produkcji względem samej siebie**, nie różnica między starym a nowym stosem.

Kontrola pliku wygenerowanego przez CLI na kopii snapshotu: 60 kolumn, kategorie zmapowane
(`Opony rolnicze` 4205, `Opony ciężarowe` 1346, **`Opony przemysłowe` 1142**, `Opony leśne` 205 —
pozycja z `ł` mapuje się poprawnie), blokady wypełnione we wszystkich 9 grupach dostawców,
zero pozostałych plików `.tmp-*`.

## Breaking changes

Brak zmian łamiących kontrakt API. Dwie zmiany widoczne dla użytkownika i dla crona:

1. **Plik CSV dla Selly ma 60 kolumn zamiast 59** i inne nazwy w kolumnie `Kategoria`
   („Opony rolnicze" zamiast „Rolnicze"). To jest dogonienie produkcji, nie nowość — produkcja
   wysyła taki plik od 10/14.09.
2. **`/katalog` pokazuje nową kolumnę domyślnie**, także osobom z zapisanym wyborem kolumn
   (retrofit). Zamierzone: bez tego kolumna zniknęłaby Ani po cutoverze.

## Follow-up

- **`mirror/` na `develop` jest o ~2 tygodnie w tyle za `main`** (brak `payment_blocks.cjs`,
  `availability_sync.cjs`, stary `extensions.cjs`, stary plik CSV). Dopóki triaż tego nie dociągnie,
  `tools/record-write-fixtures.cjs` nagrywa ze złej wersji oryginału, **bez ostrzeżenia**.
  Propozycja: nagrywarka niech sprawdza, czy `mirror/` odpowiada `origin/main`, i głośno ostrzega.
  Poza zakresem tej karty (`mirror/` i `tools/` nie są jej własnością) — zgłoszone koordynatorowi.
- **`silnik.charakteryzacja.test.ts` ma limit 20 s na test** i pada przy równoległym biegu obu
  suit na obciążonej maszynie. Warte podniesienia limitu albo oznaczenia jako wolne — poza zakresem.
- **Mapa MO→formy płatności żyje w trzech miejscach** (migracja 011, fallback generatora, front).
  Tak jest w produkcji i tak zostawiam; gdyby kiedyś doszło czwarte, warto rozważyć wspólne źródło.
- **`PATCH` nie pozwala edytować pola** (D6) — zgodnie z produkcją. Gdyby Ania kiedyś chciała
  edycji ręcznej, to osobna decyzja i osobny ticket.

## Aktualizacja dokumentacji

Trzy doc-checkery równolegle. `docs/rebuild-roadmap.md` **nietknięta** (zmienia ją wyłącznie
koordynator); `contract/` **nietknięty** (i to jest wynik pomiaru, nie przeoczenie).

### `docs/karty/I15.3/karta.md` + wejścia dla przyszłych kart
- Stan: ✅ 2026-09-23 · ticket 122. Wpisy backlogu poprawione na `#73, #76, #102, #104 (nie: #77)`.
- **Usunięte jako obalone:** (a) „#73 w API i UI: zmierz, jak produkcja je wystawia" — produkcja
  go nie wystawia; (b) „#77: wstrzymane w eksporcie ze stanem 0" — stan pośredni, cofnięty przez
  #104, nigdy nie wszedł do odbudowy; (c) źródło prawdy `7d6cfc9` → `88fa31c`.
- „Dowiezione": faktyczny zakres + pomiar CSV z wyjaśnieniem, **dlaczego liczba wierszy się nie zmienia**.
- „Do koordynatora": polecenie crona, sygnatura `wygenerujCsvSelly` dla I15.10, fakt o nieaktualnym
  `mirror/` na `develop`, fakt o zaszytej ścieżce w `payment_blocks.cjs`.
- **Nowe:** `docs/karty/I15.10/wejscie-122.md` (sygnatura do wywołania in-process + ostrzeżenie, że
  generowanie jest SYNCHRONICZNE i blokuje pętlę zdarzeń, podczas gdy oryginał odpalał podproces),
  `docs/karty/I15.9/wejscie-122.md` (delta instrukcji dla Ani: nowa kolumna i 60. kolumna CSV,
  z uwagą, że pola nie da się sprawdzić `curl`em — produkcja też go z API nie oddaje).

### `docs/rebuild-backlog.md` — 6 wpisów
- **#73** ✅ zrobione (schemat w 107, katalog i CSV w 122) + pomiar rozstrzygający.
- **#76** ✅ zrobione; pkt 3 (`R/D`) oznaczony jako **potwierdzony testem**, nie założony.
- **#77** — ⚠ **najważniejsza korekta:** część CSV zmieniona z „✅ nanieść" na **„NIE nanosić —
  obalona przez #104"**. Backlog trzymał stan z triażu 18.09; bez tej poprawki następna sesja mogłaby
  w dobrej wierze „dokończyć" #77 i cofnąć #104.
- **#102** ✅ zrobione. **#104** — część CSV ✅, reszta (staging, `availability_sync`, delta) otwarta
  dla I15.4/I15.10. **#101** — status bez zmian (zamknięty przez Anię), dopisany fakt o fallbacku i MO6.

### `docs/spec-backend/wpis-122.md` (nowy) i `docs/cutover.md`
- Wpis: pomiar + mechanizm (trzeci udokumentowany przypadek po `uwagaCena`), dwie pułapki pomiarowe,
  stan generatora po tickecie.
- `cutover.md`: dokładne polecenie crona w rozdz. 2 i w checkliście rozdz. 8, wraz z tym, że wymagany
  jest tylko `DB_PATH`, `JWT_SECRET` świadomie nie, i że polecenie nie rusza `.htaccess`.
  Sprawdzone: plik NIE zawierał zdania o „wstrzymanych ze stanem 0" — nic do prostowania.
- `docs/spec-frontend.md`: „59 kolumn (15 domyślnych)" → „60 (16 domyślnych)", z notą, że u nas to
  natywna kolumna React, a nie wstrzykiwany skrypt.
- `docs/spec-backend.md`: bez zmian — świadomie, nic nie zostało obalone (sprawdzone `grep`em).

### Zgłoszone przy okazji (poza zakresem, nienaprawione)
- `docs/rebuild-backlog.md` ma **dwa wpisy o numerze #103** (z 22.09 i 22.09 17:30) — numeracja
  zdubluje się przy kolejnych wpisach.
- `rebuild/backend/test/alerty-katalogu.gate.test.ts` potrafi paść na limicie 20 s także w izolacji
  (obserwacja reviewera; w moich biegach cała suita przechodziła).
