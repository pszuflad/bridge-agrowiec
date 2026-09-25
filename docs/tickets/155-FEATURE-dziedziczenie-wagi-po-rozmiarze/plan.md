# 155-FEATURE-dziedziczenie-wagi-po-rozmiarze — dziedziczenie wagi po marce+rozmiarze+bieżniku

> Status: Draft
> Branch: `feature/155-dziedziczenie-wagi-po-rozmiarze`
> Worktree: `.worktrees/155-FEATURE-dziedziczenie-wagi-po-rozmiarze`

## Ticket description

Gdy do katalogu trafia nowy produkt (import albo ręczne dodanie) bez wagi, a w bazie istnieje
już inny produkt tej samej marki, rozmiaru (szerokość+profil+średnica+konstrukcja) i bieżnika
z wypełnioną wagą — nowy produkt ma dziedziczyć tę wagę automatycznie. Ma też działać wstecznie
dla produktów już w katalogu z pustą lub zerową wagą (waga nigdy nie może wynosić 0). Ręcznie
wpisana waga zawsze wygrywa. Dziedziczona waga ma być widocznie oznaczona w UI (tooltip/ikona).

**To NIE jest odtworzenie zachowania oryginału** — potwierdzone w kroku research: ani produkcja
(`deminified/`, `mirror/backend/`), ani dotychczasowy backlog/karty odbudowy nie mają żadnego
mechanizmu dziedziczenia wagi po podobieństwie produktów. Jedyny istniejący, pokrewny mechanizm
to `waga_pamiec` (`rebuild/backend/src/import/silnik/bridge-ext.ts`, port `applyWagaPamiec`) —
ten pamięta wagę PO TYM SAMYM `kod` przy ponownym imporcie, nie po podobieństwie marka+rozmiar.
To świadoma nowa logika biznesowa, zaakceptowana przez użytkownika.

## Context

- **Schemat `products`** (`rebuild/backend/src/db/schema.ts:20-100+`): `marka` (`text notNull`),
  `szerokosc` (`text`, celowo TEXT nie REAL — migracja 003, zachowuje zera końcowe typu
  `"10.00"`), `profil` (`real`), `srednica` (`real`), `konstrukcja` (`text`), `bieznik` (`text`),
  `waga` (`real`, nullable, brak ograniczenia `>0` — `0` jest dziś legalną wartością na poziomie
  bazy/fixtures, więc żadnego CHECK constraint nie dodajemy, tylko logikę aplikacyjną).
- **`waga_pamiec`** (`schema.ts:489-494`, mechanizm w `bridge-ext.ts`/`bridge_ext.cjs:207-247`):
  klucz = `kod` produktu, `isEmptyWaga(v)` traktuje `null|undefined|''|0|NaN` jako puste — ten
  sam próg pustości, jaki ma mieć nasza nowa logika. `applyWagaPamiec` woła się w dwóch
  miejscach zapisu (patrz niżej) i ma pierwszeństwo: jeśli już ustawi `rekord.waga`, nasza nowa
  funkcja nic nie robi.
- **`manual_overrides`** (`schema.ts:148-158`, `repos/overrides.ts`): ręczna edycja pola przez
  `PUT/PATCH /api/products/:id` zapisuje wiersz kluczowany (`dostawca`, `kodDostawcy`,
  `fieldName`). Skoro nasza logika działa TYLKO, gdy `rekord.waga` jest nadal puste/0 po
  `applyWagaPamiec`, a ręcznie wpisana waga >0 nigdy nie jest pusta — priorytet "ręczna wygrywa"
  jest zachowany przez samą kolejność wywołań, bez specjalnego sprawdzania `manual_overrides`
  w ścieżce importu. W skrypcie wstecznym (backfill) DODATKOWO pomijamy produkty, dla których
  istnieje wiersz `manual_overrides` z `fieldName = 'waga'` — nawet jeśli dziś mają `waga = 0`,
  bo to oznacza świadomą decyzję kogoś, kto edytował to pole ręcznie (choć rzadki przypadek:
  override zwykle nie zapisze `0`, skoro `0` samo w sobie ma być niedozwolone od teraz).
- **Miejsca zapisu produktu** — dwa, identyczna sekwencja rozszerzeń:
  - `rebuild/backend/src/import/akceptacja.ts:187-209` (`zatwierdzPozycjeStagingu`) —
    `applyWagaPamiec(sqlite, rekord, istniejacy)` w linii 209, tuż przed
    `tylkoKolumnyProduktu(rekord)` (linia 215).
  - `rebuild/backend/src/import/bulk.ts:80-137` (`dodajProduktyBulk`) — `applyWagaPamiec` w
    linii ok. 126, tuż przed `tylkoKolumnyProduktu` (linia ok. 132) i `db.update/db.insert`.
  - `POST /api/products` (`routes/products.ts:174-193`) woła `dodajProduktyBulk`, czyli ręczne
    dodawanie z UI przechodzi tą samą ścieżką co bulk-import — jedno wpięcie pokrywa oba
    przypadki z pytania 1 ("import albo ręczne dodanie").
- **`bridge-ext.ts` jest mostem do portu verbatim** pilnowanym testem charakteryzacyjnym
  (sha256) — NOWEJ logiki tam nie dokładamy. Nowa funkcja dziedziczenia idzie do osobnego
  pliku `rebuild/backend/src/import/dziedziczenieWagi.ts`, wołanego z `akceptacja.ts` i
  `bulk.ts` zaraz PO `applyWagaPamiec`, z komentarzem wprost mówiącym "to nie jest port —
  nowa logika biznesowa, ticket 155".
- **Normalizacja rozmiaru**: `rebuild/backend/src/import/silnik/rozmiar.ts`
  (`parametryZRozmiaru`) zwraca skolumnowane `szerokosc/profil/srednica/konstrukcja` jako
  liczby z notacji tekstowej — te trafiają do `products` PRZED naszym punktem wpięcia (po
  `applyDims`). Dopasowanie kandydatów idzie więc po already-znormalizowanych kolumnach
  `products.szerokosc/profil/srednica/konstrukcja`, NIE po surowym stringu `rozmiar` — zgodnie
  z ostrzeżeniem CLAUDE.md o niejednoznacznej notacji `AxB`. `szerokosc` jest `TEXT` — dopasowanie
  równością stringów (nie liczby), żeby nie pogubić zer końcowych zapisanych już w bazie.
- **UI**: kolumna wagi (`rebuild/frontend/src/pages/katalog/kolumny.ts`, `key: "waga"`) nie ma
  dziś dedykowanego formattera w `formatowanie.tsx` — trafia w domyślną gałąź. Wzorzec do
  naśladowania dla informacyjnej ikonki/tooltipa: gałąź `promocja` w `formatujKomorke()`
  (`formatowanie.tsx:190-210`), która renderuje `Badge` + `<span title="...">`. Zamiast Badge —
  do wagi wystarczy mała ikona `Info` (lucide-react, już używana gdzie indziej w froncie —
  sprawdzić importy) z `title`/Tooltip, zgodnie z decyzją użytkownika ("tylko tooltip/ikona,
  bez stałego badge").
- **Kontrakt**: `contract/openapi.yaml` (schemat produktu, ok. l. 17575/18580) ma dziś `waga:
  number|null`. Dodanie opcjonalnego `wagaAutoUzupelniona: boolean` (domyślnie pominięte/`false`
  dla istniejących produktów) jest czystym rozszerzeniem — nie łamie `contract/fixtures/`, bo
  fixtures nie testują NIEOBECNOŚCI dodatkowych pól. Trzeba dopisać pole do schematu OpenAPI i
  (jeśli GATE tego wymaga) upewnić się, że istniejące fixtures nadal przechodzą walidację
  (dodatkowe pole nie jest wymagane w `required`).
- **Migracje**: najwyższy numer w `rebuild/schema/` to `013_selly_products_warianty.sql` →
  nowa migracja `014_waga_auto_uzupelniona.sql` (kolumna `waga_auto_uzupelniona INTEGER` w
  trybie boolean, domyślnie `0`/`false`).
- Sprawdzono `docs/rebuild-backlog.md`, `docs/rebuild-backlog/*.md`, `docs/karty/` — brak
  jakiegokolwiek wcześniejszego wpisu o dziedziczeniu wagi po podobieństwie (wszystkie
  wystąpienia "waga" dot. niepowiązanej "wagi gabarytowej" przesyłek). Brak ryzyka kolizji z
  inną kartą w toku dot. tego samego zakresu.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

Ticket DOTYKA kontraktu, ale jako rozszerzenie, nie zmianę istniejącego zachowania:
- `GET /api/products` (i warianty z filtrami) — dokłada opcjonalne pole `wagaAutoUzupelniona`
  do obiektu produktu. Istniejące `contract/fixtures/GET_products.json` (i pochodne) muszą
  nadal przechodzić bez zmian w PRZEWIDZIANYCH dotąd polach — nowe pole nie jest w nich
  uwzględnione, to jest OK (fixtures nie asercjują "dokładnie te klucze i żadne więcej").
- `POST /api/products`, `POST /api/staging/{id}/accept` (albo odpowiednik akceptacji) — logika
  wewnętrzna (dziedziczenie), kontrakt request/response się nie zmienia poza dociągniętym polem
  w zwracanym produkcie.
- Endpoint dodania kolumny `waga_auto_uzupelniona` do OpenAPI: dopisek w schemacie `Produkt`,
  nieobowiązkowy (`required` bez zmian).
- Skrypt backfill NIE jest częścią kontraktu API (uruchamiany z CLI), gate go nie obejmuje.

## Decisions

(Z Q&A z użytkownikiem, 2026-09-25)

1. **Klucz dopasowania**: marka + szerokość + profil + średnica + konstrukcja + bieżnik, po
   ZNORMALIZOWANYCH kolumnach `products`, nie po surowym `rozmiar`.
2. **Rozjazd wag wśród kandydatów**: bierz NAJWYŻSZĄ wagę spośród pasujących kandydatów
   (`MAX(waga)` przy `WHERE` dopasowującym klucz, `waga IS NOT NULL AND waga <> 0`).
3. **Zakres**: działa dla NOWYCH produktów (import + ręczne dodanie, jedna ścieżka zapisu) ORAZ
   wstecznie dla istniejących produktów z pustą/zerową wagą (osobny skrypt backfill, uruchamiany
   ręcznie z CLI — `npm run dziedzicz-wage` w `rebuild/backend/`).
4. **Bieżnik**: TOLEROWANY, gdy brak danych — jeśli nowy produkt (albo kandydat) ma pusty/`null`
   bieżnik, dopasowanie po marka+rozmiar mimo to działa (nie wymaga identyczności `bieznik` po
   obu stronach, gdy jedna ze stron go nie ma). Gdy OBIE strony mają wypełniony `bieznik` —
   muszą się zgadzać.
5. **Relacja do `waga_pamiec`/`manual_overrides`**: `applyWagaPamiec` (istniejący port) ma
   pierwszeństwo — nowa funkcja działa TYLKO, gdy `rekord.waga` jest nadal puste/0 po nim. Waga
   `0` jest zawsze traktowana jak pusta (nigdy nie ma zostać zapisana `0`) — jeśli po
   `applyWagaPamiec` `rekord.waga === 0`, dziedziczenie i tak próbuje ją zastąpić.
6. **Oznaczenie w UI**: mała ikona informacyjna (nie stały Badge) z tooltipem "Waga uzupełniona
   automatycznie na podstawie podobnego produktu (marka, rozmiar, bieżnik)" przy wartości w
   kolumnie "Waga" tabeli katalogu, widoczna TYLKO gdy `wagaAutoUzupelniona === true`.
7. **Backfill**: ma działać STALE, tzn. dwuczęściowo — (a) jednorazowy skrypt CLI, który
   dociąga braki w istniejącej bazie (uruchamiany ręcznie, kiedy użytkownik chce), (b) logika w
   ścieżce zapisu (import/ręczne dodanie) działa na przyszłość, TRWALE, przy każdym zapisie —
   to jest ta "zawsze działająca" część. NIE uruchamiamy automatycznego skanu przy starcie
   serwera (odrzucona opcja) — wydłużałoby to start i działałoby bez kontroli.

## Implementation plan

### Backend

1. **Migracja** `rebuild/schema/014_waga_auto_uzupelniona.sql` — `ALTER TABLE products ADD
   COLUMN waga_auto_uzupelniona INTEGER NOT NULL DEFAULT 0`. Dopisać opis do
   `rebuild/schema/README.md` (tabela migracji).
2. **Schema Drizzle** — `rebuild/backend/src/db/schema.ts`: dodać
   `wagaAutoUzupelniona: integer("waga_auto_uzupelniona", { mode: "boolean" }).notNull().default(false)`
   przy kolumnie `waga` (l. ~85).
3. **Nowy moduł** `rebuild/backend/src/import/dziedziczenieWagi.ts`:
   - `isEmptyWaga(v)` (ten sam próg co `waga_pamiec`: `null|undefined|''|Number(v)===0|NaN`) —
     wydzielona funkcja pomocnicza (można zaimportować/przekopiować z portu, jeśli eksportowana;
     jeśli nie jest eksportowana z `bridge-ext.ts`, zdefiniować lokalnie z komentarzem, że próg
     jest świadomie identyczny jak w porcie `waga_pamiec`, dla spójności zachowania).
   - `znajdzWageDoDziedziczenia(db: Baza, rekord): number | null` — SQL: `SELECT MAX(waga) FROM
     products WHERE marka = ? AND szerokosc IS <=> ? AND profil IS <=> ? AND srednica IS <=> ?
     AND konstrukcja IS <=> ? AND (bieznik = ? OR bieznik IS NULL OR ? IS NULL) AND waga IS NOT
     NULL AND waga <> 0` (SQLite nie ma `<=>`, użyć `(kolumna = ? OR (kolumna IS NULL AND ? IS
     NULL))` dla każdego pola rozmiaru — dopasowanie NULL=NULL też ma działać dla spójności, ale
     główny przypadek to obie strony wypełnione). Wykluczyć sam siebie przy backfillu (`id <>
     ?`), przy imporcie `existing` może być `null` więc naturalnie się nie wyklucza.
   - `applyWagaDziedziczona(db: Baza, rekord: Record<string, unknown>): void` — jeśli
     `isEmptyWaga(rekord.waga)`, szuka kandydata; jeśli znajdzie — ustawia `rekord.waga =
     kandydat`, `rekord.wagaAutoUzupelniona = true`; jeśli `rekord.waga` NIE jest puste (czyli
     przyszło z importu albo z `applyWagaPamiec`) — nic nie robi (i nie zeruje flagi — patrz
     punkt niżej o resetowaniu flagi przy ręcznej korekcie, obsłużonym w routes/products.ts).
4. **Wpięcie w `akceptacja.ts`** — po bloku `applyWagaPamiec` (l. ok. 209), nowy
   `try { applyWagaDziedziczona(db, rekord); } catch { /* nie blokuj zapisu */ }`.
5. **Wpięcie w `bulk.ts`** — analogicznie, po bloku `applyWagaPamiec` (l. ok. 126).
6. **Reset flagi przy ręcznej edycji** — `routes/products.ts`, handler `PUT/PATCH
   /api/products/:id`: gdy edytowane pole to `waga` (ciało zawiera klucz `waga`), zapis MUSI
   też ustawić `wagaAutoUzupelniona = false` (ręczna edycja przestaje być "automatyczna").
   Sprawdzić dokładne miejsce zapisu (ok. l. 174-260) i dopisać to jako część tego samego
   `UPDATE`, nie osobnym zapytaniem.
7. **Kontrakt** — `contract/openapi.yaml`: dodać `wagaAutoUzupelniona: {type: boolean}` do
   schematu `Produkt` (oba miejsca, l. ~17575 i ~18580, tak jak `waga` występuje dwukrotnie).
8. **Skrypt backfill** — `rebuild/backend/scripts/dziedzicz-wage.ts` (albo `.cjs`, zgodnie z
   konwencją istniejących skryptów w `rebuild/backend/` — sprawdzić `package.json` scripts na
   start implementacji), dodać `"dziedzicz-wage": "tsx scripts/dziedzicz-wage.ts"` do
   `package.json`. Skrypt: otwiera bazę (ta sama ścieżka co backend), iteruje `products` z
   `waga IS NULL OR waga = 0` (i bez wiersza `manual_overrides` z `fieldName='waga'` dla ich
   `dostawca`+`kodDostawcy`), dla każdego woła `znajdzWageDoDziedziczenia`, jeśli trafi —
   `UPDATE products SET waga = ?, waga_auto_uzupelniona = 1 WHERE id = ?`. Loguje liczbę
   zaktualizowanych/pominiętych wierszy na końcu.

### Frontend

9. **Typ `Produkt`** (`rebuild/frontend/src/pages/katalog/filtrowanie.ts` albo gdzie zdefiniowany)
   — dodać opcjonalne pole `wagaAutoUzupelniona?: boolean`.
10. **`formatowanie.tsx`** — nowa gałąź `if (klucz === "waga")` w `formatujKomorke()`, PRZED
    domyślnym renderowaniem: renderuje wartość liczbową + (gdy `produkt.wagaAutoUzupelniona`)
    małą ikonę info z `title="Waga uzupełniona automatycznie na podstawie podobnego produktu
    (marka, rozmiar, bieżnik)"`. Komentarz wprost: "NOWA logika (ticket 155), nie port —
    dziedziczenie wagi to nowa funkcja biznesowa, nie zachowanie oryginału".

## Testing strategy

- **Gate odbudowy**: N/D w sensie "łamania" — rozszerzenie kontraktu. Sprawdzić, że
  `contract/fixtures/GET_products.json` nadal przechodzi walidację po dodaniu pola do
  `openapi.yaml` (dodatkowe pole nieobecne w fixture nie jest błędem, bo nie jest `required`).
  Odnotować w raporcie jako "sprawdzone, zgodne — rozszerzenie nie łamie".
- **Unit**: `dziedziczenieWagi.ts` — testy `isEmptyWaga` (0, null, undefined, '', NaN, liczba >0),
  `znajdzWageDoDziedziczenia` (dopasowanie pełne, brak dopasowania po marce/rozmiarze/bieżniku,
  wybór MAX przy kilku kandydatach, tolerancja pustego bieżnika po jednej stronie, WYKLUCZENIE
  siebie samego przy backfillu, ignorowanie kandydatów z `waga = 0`).
- **Integration**: test na realnej (tymczasowej) bazie SQLite — `akceptacja.ts` i `bulk.ts`:
  nowy produkt bez wagi dziedziczy po istniejącym; nowy produkt z wagą z importu NIE jest
  nadpisywany; produkt z `waga_pamiec` ma pierwszeństwo przed dziedziczeniem; edycja ręczna
  `PUT /api/products/:id` na polu `waga` resetuje `wagaAutoUzupelniona`.
- **Skrypt backfill**: test integracyjny lub ręczne uruchomienie na bazie testowej z
  przygotowanymi wierszami (pusta/0 waga, override chroniący `waga=0`) — sprawdzić liczby.
- **Frontend**: nie planujemy E2E; jeśli w projekcie są testy komponentowe `formatowanie.tsx`
  (sprawdzić `rebuild/frontend/test/`), dopisać przypadek dla `wagaAutoUzupelniona`.

## Out of scope

- Zmiana progu "waga=0 jest niedozwolona" na poziomie bazy (CHECK constraint) — złamałoby
  istniejące fixtures/produkty z `waga=0`, wymaganie realizujemy logiką aplikacyjną.
- Dociąganie wagi dla innych pól niż `products.waga` (np. wymiary paczki) — poza zakresem.
- Zmiana zachowania `waga_pamiec` (portu) — zostaje bez zmian, tylko wywoływana przed nową logiką.
- Automatyczny skan przy starcie serwera (odrzucona opcja użytkownika).

## Definition of done

- [ ] Migracja `014_waga_auto_uzupelniona.sql` dodana i opisana w `rebuild/schema/README.md`.
- [ ] Nowa kolumna w `schema.ts`, nowy moduł `dziedziczenieWagi.ts` z testami jednostkowymi.
- [ ] Wpięcie w `akceptacja.ts` i `bulk.ts` (obie ścieżki zapisu, w tym ręczne dodanie przez
      `POST /api/products`).
- [ ] Reset flagi przy ręcznej edycji wagi (`PUT/PATCH /api/products/:id`).
- [ ] `contract/openapi.yaml` rozszerzony o `wagaAutoUzupelniona`, fixtures nadal przechodzą.
- [ ] Skrypt CLI `npm run dziedzicz-wage` działający i przetestowany.
- [ ] Frontend: tooltip/ikona przy wadze uzupełnionej automatycznie.
- [ ] Testy jednostkowe + integracyjne zielone, `npm run lint && npm run typecheck && npm run
      build && npm test` w `rebuild/backend/` zielone.
- [ ] Gałąź zsynchronizowana z `origin/develop`, bramki zielone PO synchronizacji, PR `MERGEABLE`.
