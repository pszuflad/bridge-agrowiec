# 06. Konfiguracja i runtime

## Zmienne środowiskowe

Z kopii `.env` odczytano **wyłącznie nazwy**: `AGRORAMI_CATEGORY_ID`, `AGRORAMI_EMAIL`, `AGRORAMI_GRAPHQL_URL`, `AGRORAMI_PASSWORD`, `JWT_SECRET`, `NODE_ENV`, `PORT`, `SELLY_CLIENT_ID`, `SELLY_CLIENT_SECRET`, `SELLY_SCOPE`, `SELLY_SHOP_URL`. Wartości nie są dokumentowane.

Kod używa `JWT_SECRET` i ma zahardkodowany fallback, którego **nie cytujemy ani nie podajemy** (`/tmp/bridge_be/be.cjs:47853-47866`). `PORT` jest odczytywany przy `listen` (`/tmp/bridge_be/be.cjs:48996-49003`). Selly czyta `SELLY_*` (`/home/admin/private_apps/bridge/selly/client.cjs:21-30`), a Agrorami używa `AGRORAMI_GRAPHQL_URL` (`parsers/mo9_agrorami_api.cjs:376`) oraz uwierzytelnienia dostarczanego przez zmienne środowiskowe (nazwy wyżej).

Nie znaleziono `BRIDGE_DB*` ani w `.env`, ani jako `process.env.BRIDGE_DB*` w kopiach plików runtime: **NIEZNANE / nieobecne w zweryfikowanym kodzie**.

## `config` w żywej bazie

Odczyt `SELECT klucz FROM config` zwrócił: `ai_fallback.aktywny`, `ai_fallback.klucz_api`, `ai_fallback.model`, `shoper.adres_sklepu`, `shoper.format_eksportu`, `shoper.token_api`, `waga_gab.opis_wspolczynnik`, `waga_gab.szer_paleta`, `waga_gab.szer_polpaleta`, `waga_gab.wspolczynnik`, `waga_gab.wys_palety`. Wartości nie zostały odczytane do dokumentacji. Struktura tabeli: `schema.sql:192-195`.

## CORS i HTTP

Middleware odczytuje dowolny nagłówek `Origin` i odbija go w `Access-Control-Allow-Origin`; jednocześnie ustawia `Access-Control-Allow-Credentials: true`, metody `GET,POST,PUT,DELETE,PATCH,OPTIONS` i obsługuje preflight 204 (`/tmp/bridge_be/be.cjs:48926-48930`). Nie ma tu listy dozwolonych originów — ryzyko: poświadczenia mogą być użyte z każdego originu przekazanego przez klienta.

JSON i URL-encoded mają limit 50 MB (`/tmp/bridge_be/be.cjs:48931-48940`); odpowiedzi JSON >1024 B są gzipowane, gdy klient deklaruje gzip (`48893-48924`).

## PM2 i start

Żywy `pm2 list` potwierdził proces `bridge-backend`, tryb `fork`, PID 1385800, status `online`; demon PM2 miał wersję 5.4.2 (odczyt 2026-08-17). To rozstrzyga rozbieżność z dawnym audytem: PM2 działa.

`ecosystem.config.cjs` ustawia nazwę `bridge-backend`, `script: ./index.cjs`, `cwd: __dirname`, `instances:1`, `fork`, `autorestart:true`, maks. 10 restartów i delay 3000 ms (`/home/admin/private_apps/bridge/ecosystem.config.cjs:4-29`). Rdzeń uruchamia nasłuch na `0.0.0.0` z `reusePort:true` (`/tmp/bridge_be/be.cjs:48996-49003`).

## Uchwyty SQLite

W normalnym udanym runtime potwierdzono **co najmniej 4 niezależne uchwyty** `better-sqlite3` do tego samego `data.db`:

1. rdzeń `Qi` (`/tmp/bridge_be/be.cjs:44101-44103`);
2. Extensions `_bridgeDb` (`extensions.cjs:370-375`);
3. Atrybuty (`atrybuty_module.cjs:86-95`);
4. Pending (`pending_module.cjs:198-207`);
5. Analytics — **nie otwiera nowego uchwytu w zwykłym runtime**, bo dostaje `_bridgeDb` z Extensions albo `Qi` z rdzenia; jego własne `new Database(DB_PATH)` występuje wyłącznie jako ścieżka zapasowa w kodzie pomocniczym (`analytics_module.cjs:1-21`). Nie doliczono go do czterech uchwytów zwykłego uruchomienia.

Paginacja i `bridge_ext` nie otwierają własnego uchwytu; dostają handle argumentem (`pagination_module.cjs:9-12`; `bridge_ext.cjs:62`). `PRAGMA journal_mode` żywej bazy zwróciło `wal`. WAL umożliwia wielu czytelników i jednego pisarza naraz; wiele niezależnych writerów może więc powodować oczekiwanie/blokady zapisu. To jest ocena właściwości SQLite WAL, a nie obserwacja incydentu.

## Obsługa błędów

Globalny 4-argumentowy handler jest zarejestrowany **przed** Extensions (`/tmp/bridge_be/be.cjs:48965-48981`) i wysyła `{message:s}` z kodem `error.status || error.statusCode || 500` (`48966-48971`). Ponieważ trasy modułów są dodawane po nim, błąd przekazany z modułowej trasy przez `next(err)` nie cofnie przebiegu do wcześniejszego handlera Express; zatem nie można potwierdzić, że ten handler złapie błędy modułów — **nie łapie ich na podstawie kolejności warstw**. Moduły zwykle obsługują błędy lokalnie `try/catch` i `res.status(500).json(...)`, co widać np. w Extensions (`extensions.cjs:124-169`) i Selly (`selly/routes.cjs:89-125`).
