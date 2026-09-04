# Mapa kodu Bridge — do zapisania w wiki (wklej do Perplexity)

> **Instrukcja dla Perplexity:** Zapisz poniższą mapę kodu do wiki projektu jako
> trwałą stronę referencyjną (`projects/budowanie-mostu-dla-agrowca-66T_zcugRE20vcBqkNB2nA/knowledge/`,
> np. strona `struktura-kodu` w `projects/` albo `entities/`). Użyj
> `run_subagent(subagent_type="project_wiki_update", ...)`. Dopisz link w `index.md`.
> Cel: **żaden kolejny subagent nie ma szukać drugi raz, gdzie w kodzie co leży.**
> Aktualizuj tę stronę, gdy struktura się zmienia.

---

# Struktura kodu Bridge dla Agrowca — gdzie co jest

## 0. Zasada czytania tej mapy

Rdzeń backendu (`index.cjs`) to **zminifikowany bundle esbuild** — **numery linii są
niestabilne** (zmieniają się przy każdej zmianie). Dlatego wszystko poniżej wskazuje
**plik + nazwę funkcji/zmiennej** (te przetrwały minifikację, bo build szedł z
`--keep-names`). Szukaj przez `grep "nazwaFunkcji" index.cjs`, nie po liniach.

## 1. Ścieżki na serwerze (produkcja)

| Co | Ścieżka |
|---|---|
| **Backend (runtime)** | `/home/admin/private_apps/bridge/` |
| Rdzeń (bundle) | `/home/admin/private_apps/bridge/index.cjs` |
| Baza | `/home/admin/private_apps/bridge/data.db` (SQLite, WAL) |
| Changelog | `/home/admin/private_apps/bridge/CHANGELOG.md` |
| **Frontend (serwowany przez Apache)** | `/home/admin/domains/agritires.eu/public_html/panel/` |
| Fallback (nieużywany) | `/home/admin/private_apps/bridge/public/` (port 5000) |
| Uruchamianie | PM2, proces `bridge-backend` (fork), `ecosystem.config.cjs` |

## 2. Backend — rdzeń `index.cjs`

Bundle zawiera cały rdzeń. Kluczowe funkcje/obiekty (szukaj po nazwie):

| Nazwa w kodzie | Co to jest |
|---|---|
| `tk(dostawca, surowe)` | **Silnik importu** — porównuje z katalogiem, klasyfikuje nowe/zmiana/wycofany, auto-zatwierdza cenę/stan, wpisuje do stagingu i `historia_cen` |
| `U` (obiekt) | **Warstwa dostępu do danych** — ~50 metod na Drizzle (`listProducts`, `acceptStaging`, `upsertOverride`, `addProductsBulk`…) |
| `recalcPricesFromRules()` | **Przeliczanie cen** z reguł narzutów (`markups`) i promocji (`promotions`) |
| `M4(...)` | **Rejestracja tras** rdzenia (auth, produkty, staging, dostawcy, eksport…) — wołana przed `require('./extensions.cjs')` |
| `bw(tabela, kolumna, typ)` | **Idempotentny migrator kolumn** (`ALTER TABLE ... ADD COLUMN`), np. dopina `nieobecnosc_pod_rzad` |
| `ensureAttrKinds`, `seedAttrValuesFromProducts`, `listAtrybuty` | Funkcje atrybutów w rdzeniu |
| `we(req,res,next)` | **Middleware autoryzacji JWT** (Bearer + cookie `bridge_session`) |
| `be(...)` | Helper wpisu do `audit_log` |
| `__gzipMw_bridge__` | Middleware gzip na `res.json` |

### 2a. Mapa zmangowanych zmiennych Drizzle (odkrycie — oszczędza pracę)
W `index.cjs` tabele mają jednoliterowe nazwy:

| Zmienna | Tabela | | Zmienna | Tabela |
|---|---|---|---|---|
| `he` | products | | `Za` | audit_log |
| `He` | staging_items | | `Yt` | manual_overrides |
| `Bt` | markups | | `gn` | spedycja_limity |
| `hn` | promotions | | `Jt` | config |
| `Ot` | suppliers | | `Ki` | alerts |
| `dt` | users | | `Wa` | history |
| `X` | uchwyt Drizzle (db) | | `Qi` | uchwyt better-sqlite3 |

Funkcje pomocnicze importu: `Zc` = klasyfikator „czy opona", `Gq` = zastosowanie
`manual_overrides` (przy konflikcie zachowuje wartość Marty), `Lq` = generator kodu
zastępczego (tylko dla opony), `Hq` = normalizacja pozycji/EAN/rozmiaru.

## 3. Backend — moduły czytelne (obok `index.cjs`)

| Plik | Rola |
|---|---|
| `extensions.cjs` | Import v6 (`/api/import/*`), scheduler auto-pull (tick 60 s, częstotliwość z `suppliers`), **rejestruje moduły: atrybuty, pending, analytics, paginacja, ORAZ Selly** (`registerSellyRoutes`) |
| `analytics_module.cjs` | **27 endpointów** `/api/analytics/*`, tworzy tabelę `historia_cen` |
| `pagination_module.cjs` | `/api/staging/paged`, `/api/history/paged`, `/api/history/meta` |
| `atrybuty_module.cjs` | Słowniki atrybutów — **11 tras** `/api/atrybuty*`, tworzy `atrybuty_rodzaje`/`atrybuty_wartosci` |
| `pending_module.cjs` | Kolejka „do akceptacji" atrybutów (`atrybuty_wartosci_pending`) |
| `bridge_ext.cjs` | Wymiary opon, pamięci (link/nazwa/waga), **`assignKodImportu`** (grupowanie po EAN albo marka+rozmiar+bieznik+nazwa), tabele `*_pamiec` |
| `common.cjs` | Normalizatory: EAN, cena, ilość (przy EAN w notacji naukowej zwraca `lossy:true`) |
| `tire_dims.js` | Formuły wymiarów opon (arkusz firmowy) |
| `uwaga_cena_patch.cjs` | Przykład `patch_*.cjs` doklejanego do `index.cjs` po buildzie: `ALTER TABLE products ADD uwaga_cena`, monkey-patch `U.acceptStaging` **i** `U.addProductsBulk` (propagacja `uwaga_cena`), plus dwie trasy `GET /api/products/{uwagi-cena,hold-reasons}` |

## 4. Backend — parsery (`parsers/`)

Potok: **dispatcher → parser → adapter → `tk()`**.

| Plik | Dostawca | Format / kluczowa logika |
|---|---|---|
| `dispatcher.cjs` | — | mapa MO1–MO10 → parser + `URLS` źródłowe |
| `adapter.cjs` | — | records → `surowe`; **`normalizeLabelSnowValue`** (flaga „Tak"/null, nie 0/1) |
| `tyre_params.cjs` | — | rozmiar, LI/SI, marki techniczne; **`normalizeLabelFlag`** (jw.) |
| `common.cjs` | — | patrz moduły |
| `mo1_bohnenkamp.cjs` | Bohnenkamp | CSV Win-1250, **pozycyjny (bez nagłówka)**: A=kod, B=EAN, C=producent |
| `mo2_jmk.cjs` | JMK | CSV UTF-8 BOM; cena="Cena klient netto"; stan=Magazyn 1 |
| `mo3_grasdorf.cjs` | Grasdorf/kolarolnicze | CSV, **2 formaty** (produkcyjny 16 kol. — pola puste, parsowanie z nazwy; abstore 33 kol.) |
| `mo4_mo5_handlopex.cjs` | Handlopex Wr/Rz | CSV Win-1250; jeden parser `parseMO4`/`parseMO5`; cena="cena hurt netto"; MO4/MO5 osobno |
| `mo6_agrowiec.cjs` | Agrowiec/Uniglory | CSV UTF-8 BOM; kolumny niemieckie (Lagerbestand=stan) |
| `mo7_nokian.cjs` | Nokian | CSV Win-1250; cena="Zakup 1 szt"; LI/SI bywa puste w źródle |
| `mo8_trelleborg.cjs` | Trelleborg | **XLSX** (arkusze Radial/XPly); **stan zawsze 0** (stąd 624 poz. bez stanu) |
| `mo9_agrorami.cjs` + `mo9_agrorami_api.cjs` + `_agrorami_fetch_helper.cjs` | Agrorami (BKT) | **GraphQL API, NIE CSV**; stan z `stock_availability.in_stock_real`; przez `execFileSync`; tożsamość=Magento `entity_id`, kod=`sku` |
| `mo10_gri.cjs` | GRI | CSV **albo** XLSX pod tym samym URL — **wykrywa format po sygnaturze bajtów** (`PK\x03\x04`) |

## 5. Backend — Selly (`selly/`)

| Plik | Rola |
|---|---|
| `selly/client.cjs` | OAuth2 client_credentials, cache tokenu, refresh na 401 |
| `selly/mapper.cjs` | payload produktu, mapy kategorii/zastosowania |
| `selly/routes.cjs` | trasy `/api/selly/*`; tabele `selly_products`, `selly_dict`, `selly_sync_log` |

**Uwaga:** Selly **jest podpięte** — `extensions.cjs` woła `registerSellyRoutes(app, {db, requireAuth: we})` warunkowo (gdy uchwyt DB się otworzy).

## 6. Backend — schemat / migracje

- Schemat = 26 tabel użytkowych (+ `sqlite_sequence`). `products` = 72 kolumny.
- Pliki SQL: `migrations/001_selly.sql`, `migration_zastosowanie.sql`,
  `kategoria_norm_map_pplx.sql`, `zastosowanie_selly_map*_pplx.sql`.
- **Kolumny dopinane w runtime przez `bw()`** w `index.cjs` (nie w CREATE TABLE):
  `link_zdjecia, oznaczenie_bieznika, sezon, ms, snow_3pmsf, wentyl, cfo,
  wysokosc_przesylki, zastosowanie, kod_importu, nieobecnosc_pod_rzad`.

## 7. Frontend (`public_html/panel/`)

| Element | Gdzie |
|---|---|
| Wejście | `index.html` — ładuje żywy bundle React + **3 skrypty injection** |
| Żywy bundle | `assets/index-<ETYKIETA/hash>.js` — **który jest żywy, sprawdź w `index.html`** (nazwa zmienia się przy zmianach, np. `index-PRICEFMT...`) |
| CSS / design tokens | `assets/index-<hash>.css` — fonty Inter + JetBrains Mono; primary bursztyn `hsl(35 70% 45%)`, sidebar `hsl(215 28% 12%)` |
| Injection 1 | `assets/pending-injection.js` — **przejmuje ekran `/atrybuty`** (React Fiber + MutationObserver) |
| Injection 2 | `assets/selly-injection.js` — overlay panelu Selly (`/panel/api/selly`) |
| Injection 3 | `assets/freq-injection.js` — kontrolka częstotliwości importu (PATCH dostawcy) |

**Router (Wouter v3), 12 tras:** `/login`, `/`, `/staging`, `/katalog`, `/narzuty`,
`/alerty`, `/analityka`, `/historia`, `/konfiguracja`, `/waga-gabarytowa`,
`/atrybuty`, `/moje-konto`.

## 8. „Gdzie jest funkcjonalność X" (szybka ściąga)

| Funkcjonalność | Gdzie w kodzie |
|---|---|
| Import cennika / różnicowanie | `tk()` w `index.cjs` + `parsers/` + `adapter.cjs` — żywa wersja to `tk = function` (przesłania martwe `function tk` zdefiniowane wcześniej w bundlu) |
| Import automatyczny — endpointy `/api/import/parse-file`, `/api/import/from-url` | `extensions.cjs:126-286` — **bez fallbacku**, wyjątek parsera kończy się zwykłym 500 |
| Import ręczny per-dostawca — `POST /api/dostawcy/:kod/upload` | rdzeń `index.cjs`, multer, pole `plik`; fallback w `catch` to `Wc()` — stare wbudowane parsery per-dostawca, **nie AI** |
| AI fallback (stub) — `POST /api/ai-fallback/parse` | rdzeń `index.cjs`; ręcznie wołany, nigdy nie wpięty w ścieżkę parsowania i **nigdy nie łączy się z OpenAI**: bez klucza `ai_fallback.klucz_api` w `config` zwraca 5 zmyślonych pozycji „symulacja", z kluczem — pustą listę |
| Ceny (narzuty/promocje) | `recalcPricesFromRules()` w `index.cjs`, tabele `markups`/`promotions` |
| Logowanie / JWT / auth | `we` w `index.cjs` (cookie `bridge_session`) |
| Warstwa danych (CRUD) | obiekt `U` w `index.cjs` (~50 metod) |
| Atrybuty (słowniki) | `atrybuty_module.cjs` + `pending_module.cjs` (kolejka) |
| Analityka | `analytics_module.cjs` (27 endpointów) |
| Selly | `selly/` + rejestracja w `extensions.cjs` |
| Kod importu (wielomagazyn) | `assignKodImportu` w `bridge_ext.cjs` |
| Wymiary opon | `tire_dims.js` |
| Eksport Shoper/Selly CSV | `/api/export/shoper`, `/api/export-shoper` w `index.cjs`; generator `generate_selly_export.cjs` |
| Dopinanie kolumn do bazy | `bw()` w `index.cjs` |

## 9. Kluczowe odkrycia (żeby nie szukać drugi raz)

- **`index.cjs` = zminifikowany bundle**; nazwy funkcji zachowane (`--keep-names`),
  zmienne modułowe zmangowane (patrz §2a). Numery linii niestabilne.
- **Auth częściowy:** ~17 tras GET jest **publicznych** (bez `we`), m.in.
  `/api/export/shoper`, `/api/audit-log`, `/api/history`, `/api/config`,
  `/api/overrides`, `/api/staging`.
- **Selly JEST podpięte** (nie „niepodpięte") — `extensions.cjs`.
- **Wzorzec „flaga vs ilość":** pola etykiety UE (np. `label_snow`) muszą być
  `'Tak'`/`null`, nie liczba. Poprawione w `adapter.cjs`/`tyre_params.cjs` (18.08,
  „sniegfix"). **Do sprawdzenia, czy `label_ice`, `ms`, `reinforced` nie mają tego
  samego błędu.**
- **CORS** odbija dowolny `Origin` z `Allow-Credentials: true` (ryzyko CSRF).
- **≥4 niezależne uchwyty SQLite** do jednej bazy (rdzeń, extensions, atrybuty, pending).
- **Dryf schematu** (obiekty tworzone ręcznie, nie kodem): tabele
  `atrybuty_wartosci_pending/odrzucone`, `selly_kategoria_norm_map`,
  `selly_zastosowanie_category_map`; kolumny `kod_importu`, `zastosowanie`.
- **Rozjazd kontraktu frontend↔backend:** React woła `/api/attributes` i
  `/api/attribute-kinds` (nie istnieją) — poprawne to `/api/atrybuty` i
  `/api/atrybuty/rodzaje`; różnicę łata `pending-injection.js`.
- **Trzy różne kształty odpowiedzi stagingu** (24 / 20 / 21 pól) dla `GET /api/staging`,
  `/paged` i `/{id}` — dwa różne moduły produkcji je obsługują (rdzeń vs
  `pagination_module.cjs`). `/paged` i `/{id}` nie mają `eanCandidates`/`magazynRaw`, mają
  `zatwierdzono` zamiast pary `zatwierdzilUzytkownikId`/`zatwierdzonoData`.
- **`zatwierdzilUzytkownikId`/`zatwierdzonoData` w `staging_items` są martwe** — nic ich
  nigdy nie ustawia w całym kodzie produkcji.
- **Stempel czasu w nazwie pliku archiwum importu jest ucięty:** `archive_module.cjs:57`
  zapowiada w komentarzu `RRRRMMDD__GGMMSS`, ale `slice(0, 15)` obcina ostatnią cyfrę
  sekund (`RRRRMMDD__GGMMS`).
- **`search` w `/api/staging/paged` nie escape'uje wieloznaczników LIKE** — `%` i `_`
  z zapytania użytkownika działają jak wzorce (`pagination_module.cjs:40`).
- **Nieparsowalne `page`/`pageSize` w `/paged` dają `NaN`** → SQLite wiąże je jako `NULL`
  → `LIMIT NULL` = „bez limitu", więc np. `?pageSize=abc` zwraca wszystkie wiersze.
- **`PUT` i `PATCH /api/products/:id` to DWIE osobne funkcje w rdzeniu, nie jeden wspólny
  handler** — kod niemal identyczny, różni się wyłącznie kolejnością audytu względem pętli
  zapisu `manual_overrides`/`history` (stan końcowy bazy identyczny). Łatwo pomylić z
  prawdziwym cieniowaniem nazw (§0) — to po prostu dwie rejestracje z dwiema funkcjami.

---

*Mapa oparta na zweryfikowanej analizie kodu produkcyjnego (stan ~2026-08-18).
Aktualizować przy zmianach struktury.*
