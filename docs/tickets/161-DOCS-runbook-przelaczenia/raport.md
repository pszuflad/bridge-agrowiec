# 161-DOCS-runbook-przelaczenia — raport

**Data:** 2026-09-24 · **Baza:** `origin/develop` @ `05b304d`

## Dowiezione
- **`docs/cutover-runbook.md` (nowy)** — 13 kroków od wyłączonego starego stosu do działającej
  produkcji: decyzja bramowa o docroocie, zatrzymanie automatów CD, wybór i migracja bazy, plik
  środowiska, dostosowanie skryptu wdrożenia, build i start, proxy `/panel`, katalog CSV z białą
  listą IP, cron 6:00, smoke-testy, dwufazowe włączenie Selly, dobicie starego stosu, pierwsza
  doba. Do tego: czego nie robić, co uprzedzić Anię, trzy typowe awarie z przyczyną.
- **`docs/cutover.md`** — jedno zdanie na końcu rozdziału 0 z odsyłaczem do runbooka.

## Weryfikacja twierdzeń (wszystkie sprawdzone w kodzie, nie z pamięci)

| Twierdzenie runbooka | Dowód |
|---|---|
| `.env` wygrywa z twardymi ustawieniami stagingowymi | `tools/deploy-staging.sh:42-45` (export) vs `:49` (`set -a; . .env`) |
| `DB_PATH` jest wyjątkiem — `.env` go nie zmieni | `:125` `DB_PATH="$DATA_DB"` przy `pm2 start`; `$DATA_DB` z `:23` |
| `pm2 restart` nie przeczyta `.env` | `:124-126` — `pm2 delete` + `pm2 start --update-env` ze środowiska powłoki |
| `SELLY_TRYB=pelny` otwiera zapis bez schedulera | `server.ts:90` (montaż dla trybu ≠ `wylaczony`) + `selly/dostepnosc.ts:1-20` (`syncDelta` w pętli) |
| `generate-csv` działa mimo blokady | `routes/selly.ts:372,389` — tylko `requireAuth` |
| `deploy/staging/htaccess` jest na 5001 i bez `/panel` | nagłówek pliku, `:1-3`; kopiowany przez `deploy-staging.sh:135` |
| dwa wyzwalacze CD, oba czynne | `docs/deploy-setup.md`, „Wyzwalacz CD — dwie opcje" (obie oznaczone UŻYWANA) |
| biała lista IP `212.91.27.191 46.170.251.129` | `docs/cutover.md` §3a, wynik audytu 24.09 |
| CLI CSV nie potrzebuje `JWT_SECRET` | `src/selly/csv-cli.ts` — podstawia wartość zastępczą świadomie |
| ścieżki CSV = domyślki produkcyjne | `src/config/env.ts:138-146` |

## Czego runbook świadomie NIE rozstrzyga
- **Konfiguracji Apache/DirectAdmin.** Krok 1 stawia to jako decyzję z dwoma wariantami i ich
  konsekwencjami dla adresu feedu w Selly. Nie mam wglądu w vhosty na VPS i zgadywanie tutaj
  kosztowałoby albo 404 dla Selly, albo zmianę konfiguracji cudzego sklepu.
- **Czy po przełączeniu stawiamy nowy staging** i czy zostaje automatyczny deploy z `develop`.
  Krok 2 wyłącza automaty na czas okna i odsyła decyzję poza runbook (roadmapa §6a).

## Warunek wstępny, który odpadł
Ticket `159-FEATURE-gri-upload-csv-xlsx` (PR #178, zmergowany) potwierdził to, co ten sam pomiar
statyczny pokazał przy tickecie 160: **upload CSV i XLSX dla MO10 już działał**, brakowało
wyłącznie testu i próbki `MO10.csv`. Zmian w kodzie produkcyjnym nie było. Runbook nie niesie
więc tego warunku jako blokady.
