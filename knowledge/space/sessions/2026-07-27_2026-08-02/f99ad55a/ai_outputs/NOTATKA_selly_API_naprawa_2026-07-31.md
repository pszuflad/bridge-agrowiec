# Notatka — naprawa połączenia API Selly (karta „Codzienna synchronizacja CSV")

**Data:** 2026-07-31
**Autor:** Anna
**Panel:** https://panel.agritires.eu/#/ → zakładka Selly

---

## 1. Jakie były błędy

### Błąd A — karta CSV się nie wyświetlała (naprawione wcześniej, 2026-07-31 rano)
Panel to aplikacja React (SPA). Pliki `selly.html` są **nieużywane** — zakładkę Selly renderuje `assets/selly-injection.js`. Karta nie pojawiała się, bo była dopisywana do nieużywanego `selly.html`. Naprawa: edycja właściwego pliku `selly-injection.js`.

### Błąd B — karta pokazywała „Błąd synchronizacji", puste pola (główny błąd tej notatki)
Po naprawie karta się renderowała, ale wszystkie pola były puste, status = BŁĄD. Przyczyna źródłowa:

> **Działający backend (`index.cjs`, port 5000) NIE miał zarejestrowanych ŻADNYCH tras `/api/selly/*`.**

Każde wywołanie `/api/selly/*` (nawet istniejący `ping`) wpadało w SPA catch-all i zwracało stronę HTML zamiast JSON. Frontend próbował sparsować HTML jako JSON → `status=undefined` → „Błąd" + puste pola.

**Dlaczego trasy nie były podpięte:** `index.cjs` jest zbundlowany (esbuild) i ładuje rozszerzenia wyłącznie przez jeden hak:
```
require('./extensions.cjs').register(app, ctx)
```
Plik `extensions.cjs` rejestrował analytics i pagination, ale **nie rejestrował Selly**. Plik `selly/routes.cjs` z endpointami istniał na dysku, ale **nikt go nie `require`-ował przy starcie**. Wcześniejsze działające „Połączono" pochodziło z ręcznie odpalonego procesu, którego już nie było.

### Błąd C — literówka w rejestracji (znaleziony i naprawiony w trakcie)
Pierwsza próba rejestracji użyła `const { registerSellyRoutes } = require(...)`, ale `selly/routes.cjs` eksportuje funkcję bezpośrednio (`module.exports = registerSellyRoutes`). Skutek: `registerSellyRoutes is not a function`. Poprawka: `const registerSellyRoutes = require('./selly/routes.cjs')`.

---

## 2. Jakie poprawki wdrożono

1. **`extensions.cjs`** — w bloku `if (_bridgeDb)` (obok analytics/pagination) dopisano:
   ```js
   const registerSellyRoutes = require('./selly/routes.cjs');
   registerSellyRoutes(app, { db: _bridgeDb, requireAuth: we });
   ```
   To trwale podpina wszystkie trasy Selly przy każdym starcie (przetrwa restart).

2. **`selly/routes.cjs`** — dodano endpoint ręcznej generacji:
   `POST /api/selly/generate-csv` — uruchamia `generate_selly_export.cjs` przez `child_process.execFile`, zwraca `{ok, czas_ms, wiersze, rozmiar_mb, ostatnia_synchronizacja}`.

3. **`assets/selly-injection.js`** (wersja `v5-csvstatus-genbtn`) — w karcie CSV dodano przycisk **„Wygeneruj CSV teraz"** z potwierdzeniem, wywołujący powyższy endpoint i odświeżający status. Awaryjne ręczne uruchomienie, gdy automat 6:00 zawiedzie.

4. **Restart backendu** — wymagany, bo `extensions.cjs` ładowany jest tylko przy starcie.

**Weryfikacja po restarcie:** log `Fix S: /api/selly/* zarejestrowane`; `/api/selly/csv-status` → JSON (status ok, 6967 wierszy); `POST /api/selly/generate-csv` → wygenerowano 7211 produktów w 0,7 s.

**Backupy na serwerze (znacznik `_pre_..._20260731_...`):** `extensions.cjs`, `selly/routes.cjs`, `assets/selly-injection.js`.

---

## 3. Mechanizm działania połączenia API (jak to teraz działa)

```
Przeglądarka (panel React SPA)
   │  fetch  /panel/api/selly/csv-status   (nagłówek: Authorization: Bearer <JWT>)
   ▼
Apache .htaccess (panel)
   │  RewriteRule ^panel/api/(.*)$  ->  http://127.0.0.1:5000/api/$1   [P] (proxy)
   ▼
Backend Node.js  (index.cjs, pm2 = bridge-backend, port 5000)
   │  przy starcie:  require('./extensions.cjs').register(app, {tk,U,we,be})
   │      └─ registerSellyRoutes(app, {db, requireAuth: we})   ← TU podpięte trasy Selly
   │  middleware `we` weryfikuje JWT (HS256, sekret JWT_SECRET z .env)
   ▼
Trasa  GET /api/selly/csv-status  ->  odczyt pliku CSV (fs.stat + zliczenie wierszy)  ->  JSON
```

### Endpointy Selly (wszystkie pod `/api/selly/`, wymagają JWT)
| Endpoint | Metoda | Opis |
|---|---|---|
| `/ping` | GET | Diagnostyka połączenia z Selly |
| `/status` | GET | Status słownika/konfiguracji |
| `/sync` | POST | Synchronizacja produktów (z trybem dry-run) |
| `/log` | GET | Log synchronizacji |
| `/csv-status` | GET | Status pliku CSV (dzisiejszy? niepusty? liczba wierszy, rozmiar) |
| `/generate-csv` | **POST** | **Ręczna generacja CSV (nowość) — uruchamia generate_selly_export.cjs** |

### Plik CSV dla Selly
- Ścieżka: `/home/admin/domains/agritires.eu/public_html/panel/ex-port-files/sellycsv-vDsrvHnz7jmyqlvtubo4g3JA.csv`
- URL: https://agritires.eu/panel/ex-port-files/sellycsv-vDsrvHnz7jmyqlvtubo4g3JA.csv
- Format: 59 kolumn, separator `;`, BOM UTF-8
- Generowany automatycznie codziennie o **6:00** (cron), pobierany przez Selly.
- Kryterium OK w karcie: plik wygenerowany dzisiaj **i** niepusty.

### KLUCZOWA ZASADA dla kolejnego agenta
- **Trasy backendu Selly dodajemy TYLKO przez `extensions.cjs` → `registerSellyRoutes(...)`.** Sam `selly/routes.cjs` nie jest ładowany, jeśli nie zostanie stamtąd `require`-owany.
- **`index.cjs` jest zbundlowany** — nie edytować go bezpośrednio (grep „selly" = 0 to normalne).
- **Po każdej zmianie `extensions.cjs`/`selly/routes.cjs` wymagany restart:** `bridge-backend` przez pm2.
- **pm2 na serwerze:** binarka pod `/home/admin/pm2-runtime/node_modules/pm2/bin/pm2`, node `v20.20.2`, `PM2_HOME=/home/admin/.pm2`. W czystym SSH `pm2` nie jest w PATH — używać pełnej ścieżki:
  `NODE=/home/admin/.nvm/versions/node/v20.20.2/bin/node; PM2_HOME=/home/admin/.pm2 $NODE /home/admin/pm2-runtime/node_modules/pm2/bin/pm2 restart bridge-backend --update-env`
