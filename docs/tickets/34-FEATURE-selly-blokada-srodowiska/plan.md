# 34-FEATURE-selly-blokada-srodowiska — twarda blokada integracji Selly na stagingu

> Status: Draft → **Approved** (decyzja użytkownika 2026-09-04)
> Branch: `feature/34-selly-blokada-srodowiska`
> Worktree: `.worktrees/34-FEATURE-selly-blokada-srodowiska`

## Opis ticketa

Pytanie użytkownika: *„czy możemy się zabezpieczyć, żeby na środowisku testowym nie było
możliwości integracji z Selly — żeby to było zablokowane?"*

Odpowiedź: tak — ale przy analizie wyszło, że **groźniejsza jest inna ścieżka niż samo API
Selly**, i ona też wchodzi w zakres tego ticketa.

## Kontekst — co ustaliła analiza

### ⚠ ZNALEZISKO 1 (poważniejsze): staging nadpisuje PRODUKCYJNY plik CSV

Staging i produkcja stoją **na tym samym VPS, na tym samym userze `admin`**
(`docs/deploy-setup.md:4`). Domyślna ścieżka pliku CSV w kodzie to katalog **produkcyjny**:

```
SELLY_CSV_DIR = /home/admin/domains/agritires.eu/public_html/panel/ex-port-files
                                                 ^^^^^ panel = PRODUKCJA
```

`tools/deploy-staging.sh` tej zmiennej **nie ustawia**, więc staging używa wartości domyślnej.
Skutek: kliknięcie **„Wygeneruj CSV teraz"** na `/selly` na stagingu nadpisuje plik produkcyjny
**treścią wygenerowaną z bazy stagingowej**, a Selly zaciąga go o 6:00 jako prawdziwy katalog.

Dwie okoliczności obciążające:
- `POST /api/selly/generate-csv` jest trasą **lokalną** — działa **bez sekretów `SELLY_*`**,
  więc blokada oparta na braku sekretów w ogóle jej nie dotyczy.
- `docs/instrukcja-testow-I8.md` (PR #44) opisuje ten tryb jako „ryzyko: zero" i „klikaj bez
  obaw" — **to jest błędne i musi zostać poprawione w tym tickecie.**

### ZNALEZISKO 2: samo API Selly jest dziś odcięte, ale przez BRAK, nie przez ZAKAZ

Stan faktyczny (zweryfikowany):
- `sprawdzKonfiguracje()` (`src/selly/klient.ts:169`) rzuca **przed pierwszym żądaniem
  sieciowym** — bez sekretów nic nie wychodzi do Selly.
- Klient powstaje w **jednym miejscu** (`src/app.ts:153`) — nie ma drugiej instancji.
- **Żaden cron ani scheduler nie dotyka Selly** — jedyny automat (`IMPORT_SCHEDULER`) odpytuje
  dostawców i jest domyślnie wyłączony.

Słabość: to **nieobecność konfiguracji, a nie zakaz**. Skopiowanie `.env` z produkcji „żeby coś
sprawdzić" po cichu czyni staging żywym i **nic tego nie sygnalizuje**.

### Precedens w projekcie

`IMPORT_SCHEDULER` (`src/config/env.ts:44-52`) został dodany **dokładnie z tego powodu** —
żeby staging nie odpytywał realnych serwerów dostawców. Jest świadomym odstępstwem od 1:1,
domyślnie wyłączonym, a produkcja włącza go jawnie. `SELLY_TRYB` powiela ten wzorzec.

## Kontrakt i fixtures (zakres)

**Ticket nie zmienia kontraktu.** Żadna ścieżka nie znika, nie zmienia metody ani kształtu
odpowiedzi. Zmienia się wyłącznie **treść błędu 500** na sześciu trasach zewnętrznych, gdy
środowisko jest zablokowane — a `contract/openapi.yaml` nie opisuje treści błędów.

Pięć fixture'ów Selly (`GET_selly_*`) dotyczy tras odczytowych i **pozostaje bez zmian**;
GATE 8a/8b musi przechodzić dalej bez modyfikacji.

⚠ Testy GATE wstrzykują własną atrapę klienta (`test/gate/selly-atrapa.ts`) i muszą działać
z pełnymi uprawnieniami — domyślne `wylaczony` nie może ich wywrócić. Rozwiązanie w planie
implementacji, krok 3.

## Decisions

- **D1 — Naprawiamy ścieżkę CSV w REPO, nie ręcznie na serwerze.** `tools/deploy-staging.sh`
  eksportuje bezpieczne wartości `SELLY_CSV_*` przed wczytaniem `.env` (linia 28), więc:
  poprawka jest wersjonowana, działa przy każdym deployu i **nie zależy od pamięci człowieka**.
  `.env` nadal może ją nadpisać świadomie (`set -a; . .env` jest PO eksportach).
  *Odrzucone:* zmiana wartości domyślnej w `env.ts` — to złamałoby wierność 1:1 wobec produkcji,
  gdzie ta ścieżka jest poprawna.

- **D2 — `SELLY_TRYB` z trzema poziomami, domyślnie `wylaczony`** (decyzja użytkownika):

  | Wartość | Odczyty | Zapisy | Zastosowanie |
  |---|---|---|---|
  | `wylaczony` (**domyślna**) | ❌ | ❌ | staging, każde środowisko nieprodukcyjne |
  | `tylko-odczyt` | ✅ | ❌ | test połączenia i dry-run bez ryzyka zapisu |
  | `pelny` | ✅ | ✅ | produkcja — zachowanie 1:1 z oryginałem |

  *Dlaczego domyślnie `wylaczony`:* pomyłka daje wtedy **widoczny błąd** („nie działa"), a nie
  **cichy zapis do cudzego sklepu**. Asymetria skutków rozstrzyga. Produkcja włączy jawnie —
  tak samo jak `IMPORT_SCHEDULER`.

- **D3 — Blokada w OBWOLUCIE klienta, nie w trasach.** `KlientSelly` ma czysty podział
  (`src/selly/klient.ts:59-78`): 5 metod odczytu (`ping`, `listProducers`, `listCategories`,
  `listVatRates`, `listWarehouses`) i 6 zapisu (`createProducer`, `createCategory`,
  `createProduct`, `updateProduct`, `upsertProductWarehouse`, `setProductMultiCat`).
  Opakowanie tego interfejsu daje blokadę w **jednym miejscu**, bez dotykania dziesięciu tras.
  *Skutek uboczny, pożądany:* `sync-supplier` z `dry_run: true` działa w trybie `tylko-odczyt`
  **sam z siebie**, bo nigdy nie woła metody zapisującej — nie trzeba tego nigdzie kodować.

- **D4 — Frontend rozpoznaje blokadę i mówi o niej po ludzku.** Analogicznie do D4 z 8b
  („Selly nieskonfigurowane"). Bez tego Ania zobaczy surowy błąd 500 i zgłosi awarię, która
  awarią nie jest. Komunikat ma mówić, że to **celowe ustawienie tego środowiska**.

- **D5 — Warstwa sieciowa poza zakresem.** Blokada egress na VPS byłaby najmocniejsza (nie
  zależy od poprawności naszego kodu), ale wymaga uprawnień, których na cyber_Folks bez roota
  prawdopodobnie nie ma (`docs/deploy-setup.md:26`). Użytkownik: „nie wiem". Zostaje jako
  follow-up do sprawdzenia, nie blokuje tego ticketa.

## Implementation plan

### Krok 1 — `SELLY_TRYB` w konfiguracji
`src/config/env.ts`: `z.enum(["wylaczony","tylko-odczyt","pelny"]).default("wylaczony")`,
z komentarzem wyjaśniającym odstępstwo i powód (wzorem `IMPORT_SCHEDULER`).

### Krok 2 — obwoluta blokująca
Nowy plik `src/selly/tryb.ts`:
- `TrybSelly` (typ), `METODY_ZAPISUJACE` (zamrożona lista 6 nazw),
- `opakujKlientaTrybem(klient, tryb): KlientSelly` — zwraca `klient` bez zmian dla `pelny`,
  inaczej proxy rzucające `BlokadaSelly` na odpowiednich metodach.
- Komunikaty: `[Selly] Integracja wyłączona na tym środowisku (SELLY_TRYB=wylaczony)` oraz
  `[Selly] Zapis do Selly zablokowany na tym środowisku (SELLY_TRYB=tylko-odczyt)`.
  Prefiks `[Selly]` zgodnie z konwencją istniejących błędów.

### Krok 3 — wpięcie w `app.ts`
Opakować **tylko klienta budowanego z env** (`app.ts:153`), a klienta **wstrzykniętego
z zewnątrz zostawić nietkniętego** — atrapa testowa (`test/gate/selly-atrapa.ts`) ma działać
bez zmian, bo test sam decyduje, co sprawdza. To także zachowuje możliwość testowania obwoluty
osobno, na jej własnych testach.

### Krok 4 — bezpieczne wartości dla stagingu w `deploy-staging.sh`
Po linii 28, przed wczytaniem `.env`:
`SELLY_TRYB=wylaczony`, `SELLY_CSV_DIR="$DOCROOT/ex-port-files"`,
`SELLY_CSV_PLIK=sellycsv-staging.csv`, `SELLY_CSV_URL=https://test.agritires.eu/ex-port-files/…`

### Krok 5 — frontend: rozpoznanie blokady
`src/pages/selly/api.ts`: `czyIntegracjaZablokowana(blad)` obok istniejącego
`czyBrakKonfiguracjiSelly`. `BladSekcji.tsx`: trzeci wariant — „Integracja Selly wyłączona
na tym środowisku", z wyjaśnieniem, że to celowe ustawienie, nie awaria.

### Krok 6 — dokumentacja
- `.env.example` — nowa zmienna z ostrzeżeniem;
- `docs/deploy-setup.md` — przypis o Selly rozszerzony o `SELLY_TRYB` i o pułapkę ze ścieżką CSV;
- **`docs/instrukcja-testow-I8.md` — POPRAWKA**: „tryb A = ryzyko zero" jest nieprawdziwe,
  dopóki `SELLY_CSV_DIR` wskazuje produkcję; opisać nowy stan (staging zablokowany z automatu);
- `docs/rebuild-backlog.md` — wpis o znalezisku CSV (zamknięty tym ticketem);
- `docs/rebuild-roadmap.md` — nota w bloku I8.

## Testing strategy

**Backend, `test/selly.tryb.test.ts` (nowy plik):**
- `pelny` → obwoluta zwraca ten sam obiekt (brak narzutu), wszystkie metody przechodzą;
- `tylko-odczyt` → 5 metod odczytu przechodzi, **każda z 6 metod zapisu rzuca**;
- `wylaczony` → **wszystkie 11 metod rzuca**;
- komunikat błędu zawiera nazwę zmiennej i jej wartość (żeby dało się zdiagnozować z logu);
- ⭐ **test kompletności:** lista `METODY_ZAPISUJACE` pokrywa się z faktycznymi kluczami
  `KlientSelly` — inaczej dopisanie w przyszłości nowej metody zapisu po cichu ominie blokadę.
  To najważniejszy test w tym pliku.

**Backend, integracyjnie:** `sync-supplier` z `dry_run: true` **działa** w trybie
`tylko-odczyt` (dowód, że D3 daje darmowy dry-run), a z `dry_run: false` — **nie**.

**GATE 8a/8b musi przejść bez zmian** — dowód, że ticket nie rusza kontraktu.

**Frontend:** rozpoznanie komunikatu blokady + kontrtest (inny błąd leci surowo), analogicznie
do testów `selly.brak-konfiguracji.test.tsx`.

## Out of scope

- Blokada sieciowa na VPS (D5) — follow-up.
- Zmiana domyślnej wartości `SELLY_CSV_DIR` w `env.ts` — produkcja ma ją poprawną (D1).
- Jakiekolwiek zmiany w kontrakcie i fixture'ach.
- Ustawianie sekretów `SELLY_*` na stagingu — osobna decyzja, poza kodem.

## Definition of done

- [ ] `SELLY_TRYB` działa w trzech poziomach, domyślnie `wylaczony`.
- [ ] Blokada siedzi w obwolucie klienta; trasy nietknięte.
- [ ] Test kompletności listy metod zapisujących przechodzi.
- [ ] `dry_run: true` działa w `tylko-odczyt`, `dry_run: false` nie.
- [ ] `deploy-staging.sh` ustawia bezpieczne `SELLY_TRYB` i `SELLY_CSV_*` — staging nie ma
      fizycznej możliwości nadpisać produkcyjnego CSV ani wysłać czegokolwiek do Selly.
- [ ] Frontend pokazuje czytelny komunikat o blokadzie zamiast surowego 500.
- [ ] GATE 8a/8b przechodzi bez modyfikacji.
- [ ] `instrukcja-testow-I8.md` sprostowana — bez zdania „ryzyko: zero”.
- [ ] Cztery bramki backendu i cztery frontendu czyste.
