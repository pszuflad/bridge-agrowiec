# Notatka dla programisty — przeniesienie kodu panelu Bridge do repozytorium

Data sporządzenia: 2026-07-25
Autor: podsumowanie stanu produkcyjnego na podstawie dokumentacji projektowej Space
Uwaga: dokument NIE zawiera danych logowania, adresów SSH, IP dostawców ani nazwy klienta końcowego. Wszystko, co dotyczy dostępu i sekretów, dostawca danych przekaże osobno.

---

## 1. Czym jest Bridge (skrót dla programisty)

Bridge to monolityczna aplikacja webowa typu „PIM + ETL" do zarządzania katalogiem produktów (branża opon rolniczych/przemysłowych/ciężarowych) z 10 dostawców CSV, buforem zmian z ręcznym zatwierdzaniem, historią cen, analityką i eksportem do platform e-commerce.

Przepływ danych:
`CSV od dostawców → parser per dostawca → normalizacja (adapter) → tabela stagingitems (bufor) → akceptacja operatora → tabela products → history + historia_cen → eksporty (Shoper / BaseLinker) + analityka w panelu`.

Kluczowe cechy:
- Baza SQLite w trybie WAL (jeden plik, embedded, bez osobnego serwera DB).
- Bufor `stagingitems` — nic nie trafia do produktów bez akceptacji operatora.
- `history` + `historia_cen` — pełny audyt każdej zmiany pola i historia cen w czasie.
- `manual_overrides` — ręczne edycje operatora są chronione przed nadpisaniem przez kolejny import z tego samego dostawcy.
- `auditlog` — audyt akcji użytkowników (login, zatwierdzenia, edycje konfiguracji).

---

## 2. Stack technologiczny

| Warstwa | Technologia | Uwagi |
|---|---|---|
| Runtime | Node.js 18 | zarządzany przez PM2 (`pm2 start ecosystem.config.cjs`) |
| Backend framework | Express | zminifikowany w bundlu, jedyny entry point: `index.cjs` (~1,46 MB) |
| Baza danych | SQLite 3 przez `better-sqlite3` 11.7.0 | synchroniczna, natywne bindings, tryb WAL |
| Parsowanie CSV | `csv-parse` 5.5.6 | |
| Kodowanie znaków | `iconv-lite` 0.6.3 | konwersja windows-1250 / iso-8859-2 → UTF-8 |
| Konfiguracja | `dotenv` 16.4.5 | `.env` w katalogu backendu |
| Autoryzacja | JWT sesyjne + middleware `requireAuth` | wszystkie endpointy `/api/*` poza `/api/login` chronione |
| Frontend | React + Vite | budowany POZA serwerem, deployowany jako gotowy zminifikowany bundle |
| Process manager | PM2 (`bridge-backend`) | `--max-old-space-size=2048`, `maxmemoryrestart 2500M` |
| Hosting | VPS cyber-folks | Apache + Node.js za `.htaccess` proxy |
| Zasoby VPS | 1 vCPU (AMD EPYC 7313), 4 GB RAM, ~30 GB dysk, brak swapa (do naprawy) | |

---

## 3. Struktura katalogu backendu (produkcja)

Ścieżka na serwerze: `/home/admin/private_apps/bridge/`

```
bridge/
├── index.cjs                    # ~1,46 MB, ZMINIFIKOWANY entry-point Expressa
├── extensions.cjs               # NIEzminifikowany — endpointy importu, admin, scheduler
├── atrybuty_module.cjs          # NIEzminifikowany — CRUD atrybutów
├── pending_module.cjs           # moduł "pending" (faza B)
├── analytics_module.cjs         # /api/analytics/*
├── pagination_module.cjs        # /api/staging/paged, /api/history
├── tiredims.js                  # parser wymiaru opony (wzór "Mielczarek 23.02.2021")
├── ecosystem.config.cjs         # konfiguracja PM2
├── package.json                 # name: bridge-server, v1.0.0
├── db_schema.sql                # schemat bazy (referencja)
├── data.db                      # baza SQLite (WAL) — NIE do repo
├── data.db-shm, data.db-wal     # pliki WAL — NIE do repo
├── data.db.bak_*                # backupy — NIE do repo
├── public/                      # ZAPASOWA/testowa kopia frontendu (patrz sekcja 6)
│   └── assets/index-*.js
├── parsers/
│   ├── dispatcher.cjs           # router: kod MO1..MO10 → parser, mapa URL źródeł
│   ├── adapter.cjs (~15,6 KB)   # wspólna normalizacja: EAN, magazyn, stan, cena
│   ├── tyreparams.cjs (~35,7 KB)# parser parametrów opony ze stringa rozmiaru
│   ├── testtyres.cjs (~29,5 KB) # parser testowy / fallback
│   ├── mo1_bohnenkamp.cjs
│   ├── mo2_jmk.cjs
│   ├── mo3_grasdorf.cjs
│   ├── mo4_mo5_handlopex.cjs    # jeden plik, dwie funkcje (Wrocław MO4, Rzeszów MO5)
│   ├── mo6_agrowiec.cjs
│   ├── mo7_nokian.cjs
│   ├── mo8_trelleborg.cjs
│   ├── mo9_agrorami.cjs
│   └── mo10_gri.cjs
├── node_modules/                # NIE do repo
├── logs/                        # NIE do repo
└── .env                         # NIE do repo (sekrety)
```

Kontrakt parsera: każdy `parsers/moX_*.cjs` po wczytaniu CSV zwraca obiekt
`{ records, errors, dostawca, odrzucone? }`.

---

## 4. Struktura katalogu frontendu (produkcja) — WAŻNE

Frontend NIE jest budowany na serwerze — na dysk trafia tylko gotowy bundle.
Na serwerze istnieją **DWA** oddzielne katalogi frontendu, obsługiwane przez różne serwery WWW. To jest częste źródło pomyłek — patrz sekcja 6.

**Środowisko produkcyjne (publiczne, obsługiwane przez Apache):**
```
/home/admin/domains/<domena>/public_html/panel/
├── index.html                   # z ręcznie wstrzykniętymi <script> i <style>
├── .htaccess                    # proxy /api/* → 127.0.0.1:5000, SPA fallback, HTTPS
├── assets/
│   ├── index-<HASH>.js          # aktywny bundle (nazwa: index-KODIMP<TIMESTAMP>.js itp.)
│   ├── index-<HASH>.css
│   ├── pending-injection.js     # ręczne patche UI
│   ├── selly-injection.js
│   ├── freq-injection.js
│   └── (starsze buildy jako .bak / historyczne)
└── (inne pliki statyczne)
```

Warto zauważyć:
- Nazwy JS mają opisowe prefiksy z timestampem (`index-KODIMP20260717124457.js`, `index-BOOLEXP*.js`, `index-DOSTCOL*.js`) — historia większych zmian jest zakodowana w nazwach plików.
- W `index.html` doklejane są ręcznie skrypty i CSS z komentarzami typu `POPRAWKA 2026-07-07`, `POPRAWKA 2026-07-13` (sticky nagłówki tabeli, szerszy scrollbar, tryb ciemny). Te patche trzeba przenieść do źródła Reacta.

**Środowisko zapasowe/testowe (nieprodukcyjne):**
`/home/admin/private_apps/bridge/public/` — serwowane przez wbudowany Express na porcie 5000, dostępne tylko lokalnie. Zawiera starszy bundle, BEZ patchy z środowiska produkcyjnego. Do usunięcia lub udokumentowania jako "dev-only".

---

## 5. Baza danych — schemat wysoki poziom

Baza `data.db` (SQLite, WAL). **18 tabel**. Pełny schemat: patrz `db_schema.sql` w backendzie.

### A. Tabele danych biznesowych
| Tabela | Kolumny | Funkcja |
|---|---|---|
| `products` | 69 | Główny katalog: kod, nazwa, marka, kategoria, dostawca, magazyn, stan, ceny, marża, VAT, EAN + ~47 pól specyficznych dla opon (rozmiar, szerokość, profil, średnica, konstrukcja, indeksy nośności/prędkości, PR, TL/TT, bieżnik, model, DOT, waga, zastosowanie, etykiety EU itd.) |
| `stagingitems` | 24 | Bufor zmian PRZED zatwierdzeniem: `typ_zmiany` (new/upd/del), stan stary/nowy, cena stara/nowa, `snapshot_json` (TEXT), ostrzeżenie, status akceptacji |
| `manual_overrides` | 8 | Klucz: `(supplier_kod, supplier_product_id, field_name)`. Ochrona ręcznych edycji przed nadpisaniem importem |
| `history` | 9 | Log zmian każdego pola: `data, kod_produktu, nazwa, pole, stara_wartosc, nowa_wartosc, zrodlo, kto` |
| `historia_cen` | 14 | Ślad cen w czasie, 5 indeksów (kod+data, ean+data, dostawca+data, marka, rozmiar) do analityki |
| `alerts` | 7 | Alerty systemowe (poziom, typ, opis, dostawca, status) |

### B. Tabele konfiguracyjne
| Tabela | Funkcja |
|---|---|
| `suppliers` | Konfiguracja 10 dostawców: kod MO1–MO10, nazwa, URL źródła, częstotliwość sync (minuty), status, ostatnia sync, liczba produktów |
| `markups` | Reguły marży (typ, zakres, warunki, wartość, jednostka, priorytet) |
| `promotions` | Promocje cenowe (rabat, zasięg, warunki, daty start/koniec) |
| `spedycja_limity` | Progi netto i koszty spedycji per dostawca |
| `config` | Klucz-wartość: globalna konfiguracja aplikacji |

### C. Tabele atrybutów (faza 1, czerwiec 2026)
| Tabela | Funkcja |
|---|---|
| `atrybuty_rodzaje` | Słownik rodzajów: `value` (PK), `label`, `opis`, `core` (chronione przed usunięciem), `utworzony`. Core: marka, kategoria, konstrukcja, vf_if, bieznik, rodzaj |
| `atrybuty_wartosci` | Wartości w ramach rodzaju. FK do `atrybuty_rodzaje.value` z `ON DELETE CASCADE`, indeks po `rodzaj`, unique `(rodzaj, wartosc)` |

### D. Tabele systemowe
| Tabela | Funkcja |
|---|---|
| `users` | Konta operatorów: `id, email, haslo_hash, imie_nazwisko, utworzono, ostatnie_logowanie` |
| `auditlog` | Audyt akcji użytkowników: kto, jaka akcja, jaka encja, JSON szczegółów, kiedy |
| `sqlite_sequence` | Liczniki AUTOINCREMENT (systemowa) |

### Indeksy (5 zdefiniowanych)
- `idx_atrybuty_wartosci_rodzaj` na `atrybuty_wartosci(rodzaj)`
- `idx_historia_cen_kod_data`, `idx_historia_cen_ean_data`, `idx_historia_cen_dostawca_data`
- `idx_historia_cen_marka`, `idx_historia_cen_rozmiar`

Brakuje indeksów na `products.dostawca, products.marka, products.kategoria, products.ean` oraz na `stagingitems(typ_zmiany, utworzono DESC)` — do dodania (jest gotowa lista 11 indeksów w notatce `wydajnosc_bridge.md`).

### PRAGMA do wdrożenia przy starcie
```js
db.pragma('journal_mode = WAL');       // już jest
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -65536');      // 64 MB
db.pragma('temp_store = MEMORY');
db.pragma('mmap_size = 268435456');    // 256 MB
db.pragma('foreign_keys = ON');
```

---

## 6. Endpointy backendu (znane)

Wszystkie chronione przez `requireAuth` poza `POST /api/login`.

**Auth i użytkownicy**
- `POST /api/login` — email + hasło → JWT
- `POST /api/password/change` — zmiana hasła zalogowanego użytkownika (wymaga starego)

**Katalog i staging**
- `GET/POST/PUT /api/products` — CRUD katalogu
- `GET /api/staging/paged` — bufor zmian, paginowany
- `GET /api/history/meta`, `GET /api/history/paged` — historia zmian

**Konfiguracja i słowniki**
- `GET/POST/PUT/DELETE /api/atrybuty/*` — rodzaje i wartości atrybutów
- `GET/PATCH /api/admin/supplier-config`, `GET /api/admin/suppliers-list`
- `GET/POST/PUT /api/suppliers`
- `GET/POST/PUT /api/markups`, `GET/POST/PUT /api/promotions`

**Import**
- `POST /api/import/from-url` — pobiera CSV z URL dostawcy (body: `dostawcaKod`)
- `POST /api/import/parse-file` — multipart upload (drag&drop w panelu)
- Legacy: `POST /api/staging/import`

**Analityka**
- `GET /api/analytics/overview`
- `GET /api/analytics/price-trends`
- `GET /api/analytics/imports`
- `GET /api/analytics/ean-comparison`

**Audyt**
- `GET /api/audit-log`

**Strony admina (HTML zwracany bezpośrednio z backendu)**
- `GET /admin/import-now` — ręczny import per dostawca
- `GET /admin/supplier-config` — edycja URL i częstotliwości per dostawca

---

## 7. Dostawcy (kody MO1–MO10)

Dane techniczne dostawców (mapowanie kod → parser, URL, częstotliwość sync) są w tabeli `suppliers` + fallback w `parsers/dispatcher.cjs`. Formaty CSV różnią się kodowaniem i separatorami — `iconv-lite` obsługuje konwersje.

Kody i przypisanie parserów:
`MO1 → mo1_bohnenkamp.cjs`, `MO2 → mo2_jmk.cjs`, `MO3 → mo3_grasdorf.cjs`, `MO4 + MO5 → mo4_mo5_handlopex.cjs`, `MO6 → mo6_agrowiec.cjs`, `MO7 → mo7_nokian.cjs`, `MO8 → mo8_trelleborg.cjs`, `MO9 → mo9_agrorami.cjs`, `MO10 → mo10_gri.cjs`.

Konkretne nazwy firm dostawców, URL-e i dane wrażliwe — przekazane osobno przez właściciela projektu.

---

## 8. Co JEST w kodzie na serwerze

- Kompletny backend Node/Express (opis w sekcji 3).
- Kompletny frontend jako gotowy bundle (produkcyjny w domenie klienta + zapasowy w `private_apps/bridge/public/`).
- Konfiguracja PM2 (`ecosystem.config.cjs`).
- Konfiguracja Apache (`.htaccess`) obsługująca dwie subdomeny/hosty, proxy do backendu, SPA fallback, wymuszenie HTTPS, wyłączenie cache dla HTML/JS/CSS.
- Skrypty pomocnicze/naprawcze w formie doraźnych plików `.cjs` (uruchamiane ad-hoc przez `node`).
- Backupy bazy w tym samym katalogu co baza (`data.db.bak_<opis>_<YYYYMMDDHHMMSS>`).
- Historyczne wersje bundlu frontendu jako `.bak` w `assets/`.

---

## 9. Czego NIE MA (do zaplanowania po migracji)

**Rzeczy niezbędne do "prawdziwego" repo:**
- Źródła frontendu (Reacta) — na serwerze jest tylko zminifikowany bundle. Trzeba odzyskać `src/`, `vite.config.*`, `package.json` frontendu z lokalnego środowiska osoby, która budowała bundle. Bez tego każda zmiana UI wymaga edycji zminifikowanego pliku (obecny stan, ryzykowny).
- `.env.example` (obecnie brak — trzeba stworzyć na podstawie realnych zmiennych z `.env`).
- Dockerfile / docker-compose (obecnie brak konteneryzacji).
- CI/CD (obecnie brak — deploy ręczny przez SCP).
- Testy jednostkowe i integracyjne (obecnie brak w widocznej strukturze).
- `README.md`, `CHANGELOG.md`, dokumentacja API (OpenAPI/Swagger).
- Skrypty migracji bazy (obecnie migracje są ad-hoc `.cjs` uruchamiane ręcznie).
- Zestaw fixture'ów CSV do testowania parserów (obecnie testuje się na realnych CSV).

**Braki funkcjonalne (znane TODO, wstrzymane):**
- Reset hasła przez e-mail — WSTRZYMANE. Backend nie ma biblioteki mailowej (brak `nodemailer`/`sendgrid`/`resend`/`mailgun` w `package.json`), brak zmiennych SMTP w `.env`. Tabela `users` nie ma kolumn `reset_token`, `reset_token_wygasa`. Do decyzji: lokalny `sendmail` vs zewnętrzny SMTP + UX z linkiem 30-min.
- Synchronizacja parsera nazwa → atrybuty przy ręcznej edycji nazwy — WSTRZYMANE (Etap 1 fundament, planowany endpoint `POST /api/produkt/:kod/parse-nazwa` + modal diff w UI).
- Automatyczny checkpoint WAL w cronie (obecnie WAL rośnie do dziesiątek MB między checkpointami).
- Automatyczne, poza-VPS backupy bazy (obecnie tylko lokalne snapshoty).
- Swap systemowy (brak swapa — ryzyko OOM przy imporcie + jednoczesnym backupie).

---

## 10. Zasady operacyjne bazy (KRYTYCZNE dla migracji i dev)

**Backupy WAL-safe.** Baza działa w trybie WAL. `cp data.db` gubi niescommitowane dane z pliku `data.db-wal` — backup jest niekompletny. Właściwa metoda:
```js
const Database = require('better-sqlite3');
const db = new Database('data.db');
const ts = new Date().toISOString().replace(/[-T:]/g,'').slice(0,14);
db.exec(`VACUUM INTO 'data.db.bak_full_${opis}_${ts}'`);
```
Alternatywnie: kopia wszystkich trzech plików `data.db`, `data.db-wal`, `data.db-shm` razem.

**Konwencja nazw backupów:** `data.db.bak_full_<krotki_opis>_<YYYYMMDDHHMMSS>`.

**Środowisko serwera — ograniczenia (do uwzględnienia w devopsie):**
- NIE ma Pythona na serwerze — narzędzia do bazy tylko przez `node` + `better-sqlite3`.
- Inline `node -e "..."` po SSH psuje SQL z cudzysłowami — pisać skrypty `.cjs` lokalnie i przez SCP na serwer.
- `scp` z klamrami `{a,b}` nie działa — albo `tar` na serwerze, albo plik po pliku.
- Zmiany tylko na danych (UPDATE/INSERT/DELETE) nie wymagają restartu backendu.
- Zmiany kodu backendu wymagają `pm2 restart bridge-backend`. Zmiany frontendu — nie (nowy bundle w Apache).

**Nadpisywanie manual_overrides:** ręcznie uruchamiane skrypty `.cjs` NIE są auto-chronione — jeśli edytujesz pole produktu poza standardowym flow API, musisz sam wstawić rekord do `manual_overrides`, żeby kolejny import nie cofnął zmiany.

---

## 11. Deploy — jak to obecnie działa (żeby wiedzieć, co usprawnić)

1. Backend: kod trafia przez SCP do `/home/admin/private_apps/bridge/`, następnie `pm2 restart bridge-backend`.
2. Frontend: bundle budowany lokalnie (Vite), gotowe pliki `index-*.js/css` trafiają przez SCP do `/home/admin/domains/<domena>/public_html/panel/assets/`, następnie ręcznie aktualizuje się referencję w `index.html`.
3. Apache serwuje frontend z domeny publicznej, `.htaccess` proxy'uje `/api/*` → `127.0.0.1:5000` do Node.js.
4. Space (repozytorium projektu) trzyma podsumowania wdrożeń i backupy kodu produkcyjnego oznaczone datą — po każdej istotnej zmianie w panelu.

**Rekomendowany docelowy flow po migracji do repo:**
- Osobne repo/mono-repo z `backend/` i `frontend/`.
- Frontend: `npm run build` → `dist/` → deploy (docelowo CI/CD, np. GitHub Actions + rsync/SCP).
- Backend: repo źródłowe (rozminifikowany `index.cjs` albo odbudowa modułowa), migracje bazy w `migrations/`.
- Osobny plik `.env.example` w repo, prawdziwy `.env` tylko na serwerze.
- Jeden katalog frontendu na serwerze (zlikwidować dublet `private_apps/bridge/public/`).

---

## 12. Zalecana struktura repozytorium

```
bridge/
├── README.md
├── CHANGELOG.md
├── .gitignore                   # data.db*, node_modules, .env, logs, dist, *.bak
├── .env.example
├── backend/
│   ├── package.json
│   ├── ecosystem.config.cjs
│   ├── src/
│   │   ├── index.cjs            # PRIORYTET: rozminifikować lub odbudować modułowo
│   │   ├── extensions.cjs
│   │   ├── modules/
│   │   │   ├── atrybuty.cjs
│   │   │   ├── pending.cjs
│   │   │   ├── analytics.cjs
│   │   │   └── pagination.cjs
│   │   ├── parsers/             # dispatcher, adapter, tyreparams, mo1..mo10
│   │   └── lib/tiredims.js
│   ├── migrations/              # SQL migracje (numerowane)
│   ├── scripts/                 # jednorazowe .cjs (utrzymywane w repo)
│   └── tests/                   # fixture'y CSV + testy parserów
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── src/                     # źródła Reacta (do odzyskania od buildera)
│   ├── public/
│   └── patches/                 # historyczne pending-injection.js, selly-injection.js, freq-injection.js do wchłonięcia w src/
├── deploy/
│   ├── .htaccess                # produkcyjne reguły Apache (bez wrażliwych IP)
│   └── nginx.conf (opcjonalnie)
└── docs/
    ├── architektura.md
    ├── baza_danych.md
    ├── parsery.md
    ├── api.md
    └── runbooki/
        ├── backup_wal.md
        ├── restart_backendu.md
        └── deploy.md
```

---

## 13. Priorytety migracji (proponowana kolejność)

1. **Odzyskać źródła frontendu** — bez tego repo jest niekompletne. Dopóki nie ma `src/`, edycje UI będą dalej robione na zminifikowanym bundlu.
2. **Zainicjować repo z tym, co jest** — backend + gotowy bundle frontendu + dokumentacja. Nawet niedoskonałe repo jest lepsze niż brak repo.
3. **Osadzić patche UI (`*-injection.js`, CSS `POPRAWKA-*`) w źródłach Reacta.** Docelowo w `index.html` nie powinno być ręcznie doklejonych skryptów.
4. **Rozminifikować / odbudować `index.cjs`** — 1,46 MB jednego pliku to długu technicznego. Rozdzielić na moduły (auth, products, staging, history, analytics, admin).
5. **Dodać migracje bazy** — start od zrzutu obecnego `db_schema.sql` jako migracja 001. Kolejne migracje dodają brakujące indeksy (11 pozycji z `wydajnosc_bridge.md`) i kolumny pod reset hasła.
6. **CI/CD + .env.example + Dockerfile** — dopiero jak repo się ustabilizuje.
7. **Testy parserów** — na fixture'ach CSV (każdy dostawca ma swoje kwiatki formatu, testy złapią regresje).
8. **Zlikwidować dublet katalogów frontendu** — jeden produkcyjny katalog Apache, `private_apps/bridge/public/` do usunięcia albo świadome udokumentowanie jako dev-only.

---

## 14. Sygnały ostrzegawcze (żeby nie stracić czasu)

- **Backend uruchamia w extensions.cjs DRUGI handle do tej samej bazy** (`new Database(path.join(__dirname, 'data.db'))` dla `analytics_module` i `pagination_module`). `better-sqlite3` obsługuje wiele handle'i, ale przy refaktoringu warto ujednolicić do jednego handle wstrzykiwanego przez DI.
- **Historia buildów frontendu żyje w nazwach plików** (`index-KODIMP*.js`, `index-BOOLEXP*.js`, `index-DOSTCOL*.js`). Nie usuwać starych plików bez potwierdzenia — mogą być referenceowane w linkach/notatkach.
- **`.htaccess` w domenie ma reguły ograniczenia dostępu do konkretnych plików eksportu CSV po IP.** Przy migracji infra sprawdzić, czy IP-locki są nadal potrzebne i gdzie mają wylądować (Apache/nginx/aplikacja).
- **Bufor `stagingitems` potrafi urosnąć do setek MB** jeśli operator nie zatwierdza importów (historyczny przypadek: 229 824 rekordy pending zajęły 242 MB z 350 MB bazy). Warto dodać monitoring rozmiaru staging + alert.
- **PM2 max heap = 2048 MB, restart przy 2500 MB** — było OOM przy `apistagingpaged` z setkami snapshotów JSON. Zachować te limity albo poprawić serializację przed obniżeniem.

---

## 15. Kontakt / handover checklist

Do przekazania osobno (poza tą notatką):
- [ ] Adresy SSH, port, dane logowania do serwera
- [ ] Zawartość `.env` (klucz JWT, ewentualne zmienne SMTP jeśli będą dodane)
- [ ] Nazwy domen produkcyjnych i subdomen
- [ ] Mapowanie kodów MO1–MO10 na realne nazwy i URL-e dostawców (są w tabeli `suppliers` w bazie)
- [ ] Dostęp do panelu hostingu (cyber-folks)
- [ ] Źródła frontendu (`src/` Reacta) od osoby, która buduje bundle lokalnie
- [ ] Lista IP dozwolonych w `.htaccess` do plików eksportu CSV
- [ ] Konta admina w tabeli `users` (lista maili operatorów bez haseł)

---

Koniec notatki.
