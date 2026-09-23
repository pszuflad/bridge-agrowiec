# Wejście dla I15.9 od ticketu 144 · 2026-09-24 — lista do rozliczenia przed testami I15

**Po co ten plik.** Użytkownik poprosił (2026-09-24), żeby rzeczy zostawione otwarte przy
montażu modułu dostępności (ticket 139, karta I15.10b) czekały na niego **w jednym miejscu**
i wypłynęły dokładnie wtedy, gdy wszystkie karty I15 będą zrobione i będziemy podchodzić do
testów. To jest to miejsce. Szczegóły techniczne montażu: `docs/karty/I15.9/wejscie-139.md`.

Nic z poniższych **nie blokuje** domknięcia I15 — to są pozycje do świadomego rozliczenia,
nie usterki.

---

## 1. Decyzja użytkownika — wpis backlogu `#139.2` (bramka na `SELLY_CSV_DIR`)

**Stan:** ⬜ bez decyzji. Wypływa sam przez `tools/stan-backlogu.sh --do-decyzji`.
Treść: `docs/rebuild-backlog/wpis-139.md`.

**Rzecz w skrócie.** `SELLY_CSV_DIR` ma domyślnie **produkcyjny** katalog
(`/home/admin/domains/agritires.eu/public_html/panel/ex-port-files`) i jest to domyślka
świadoma — pusty `.env` ma zachowywać się jak oryginał (`rebuild/backend/src/config/env.ts`).
Odbudowa nie ma dla generatora CSV żadnej własnej bramki; jedyną ochroną poza produkcją jest
poprawny `.env`. Oryginał miał tu bramkę twardą — `mirror/backend/staging_policy.cjs:131-134`
wychodzi, gdy `path.resolve(db.name)` to nie produkcyjna `data.db`.

**Czego to NIE jest:** długu wniesionego przez ticket 139. Ta ścieżka jest otwarta od I15.3
przez trasę `POST /api/selly/generate-csv`. Ticket 139 zmienił tylko to, że da się w nią wejść
**automatycznie** (z importu), a nie wyłącznie ręcznie, zza `requireAuth`.

**Do rozstrzygnięcia:** czy dokładamy bramkę analogiczną do produkcyjnej (np. porównanie
`DB_PATH` do produkcyjnej bazy), czy zostawiamy ochronę wyłącznie w konfiguracji `.env`.
W tickecie 139 odrzucone jako spoza zakresu karty (decyzja D1,
`docs/tickets/139-FEATURE-montaz-dostepnosci/plan.md`) — nie jako zła opcja.

## 2. Konfiguracja do sprawdzenia, zanim ktokolwiek zacznie testować

**`SELLY_TRYB` w `.env` środowiska, na którym testujemy.** Montaż modułu dostępności stoi za
bramką `SELLY_TRYB !== "wylaczony"`. Domyślka i dzisiejszy staging mają `wylaczony`, więc
**łańcuch import → odświeżenie dostępności → CSV/Tor 1 milczy — cicho, bez błędu i bez ostrzeżenia
w UI.** Jedynym śladem jest linia w logu startu:
`[dostepnosc] niezamontowana (SELLY_TRYB=wylaczony) — zgłoszenia odświeżenia są no-opem`.

Skutek praktyczny: jeśli plan testów ma objąć odświeżanie dostępności po imporcie, trzeba
świadomie ustawić `SELLY_TRYB` na `tylko-odczyt` albo `pelny` **i równocześnie** upewnić się,
że `SELLY_CSV_DIR` na tym środowisku nie wskazuje katalogu produkcyjnego (punkt 1).
Odnotowane w `docs/cutover.md` §4, w wierszach `SELLY_TRYB` i `SELLY_CSV_*`.

## 3. Trzy nieaktualne zdania w plikach, których ticket 139 nie miał prawa edytować

Wszystkie trzy to zapisy obalone przez ticket 139, siedzące w plikach należących do innych
ticketów. Regulaminy (`docs/spec-backend/README.md`, `docs/rebuild-backlog/README.md`) zabraniają
obcym ticketom ich przepisywania, więc zostały **zgłoszone, nie poprawione**. Sprostowania stoją
w `docs/spec-backend/wpis-139.md` i `docs/rebuild-backlog/wpis-139.md`.

| Gdzie | Co jest nieprawdą | Od kiedy |
|---|---|---|
| `docs/spec-backend/wpis-119.md:57-58` | „moduł jest CELOWO niewpięty, wpięcie to karta I15.4" — moduł jest wpięty, i zrobiła to I15.10b, nie I15.4 | ticket 139 |
| `docs/rebuild-backlog.md`, wpis `#104`, pole „Do nowej wersji?" | „staging/auto-wstrzymania zostają do I15.4b" — dowiezione ticketem 130 (widać to w polu „Status" tego samego wiersza) | ticket 130 |
| `docs/rebuild-backlog/wpis-129.md`, wiersz `#104` | „Import i `availability_sync` → I15.4b / I15.10" — prawdziwe, ale nie wspomina montażu (I15.10b, ticket 139) | ticket 139 |

**Decyzja dla koordynatora:** czy poprawiamy je przed testami (jedna mała karta DOCS, bo trzeba
wejść w trzy cudze pliki), czy zostawiamy jako znany szum i polegamy na sprostowaniach
w `wpis-139.md`. Ryzyko zostawienia: sesja, która przed cutoverem sięgnie po `wpis-119.md`,
przeczyta, że modułu nie ma w procesie.

## 4. Znany brak pokrycia testowego (świadomy, do wiadomości)

`test/server.montaz-dostepnosci.test.ts` **nie wykrywa** podmiany `discovery: discoverySelly`
na świeżą instancję `stworzDiscovery(...)`. Z zewnątrz procesu obie zachowują się identycznie —
różnica (zimny cache kodów, utracone `feature_id`) jest nieobserwowalna w skutku. Wymóg „jedna
instancja na proces" (`docs/karty/I15.10/wejscie-121.md`) chroni więc komentarz w `server.ts`
i przegląd kodu, nie test. Jeśli ktoś będzie ruszał `server.ts` przed cutoverem — to jest miejsce,
w którym regresja przejdzie przez zieloną suitę.
