# Wejście dla I15.10 od ticketu 121 (I15.8) · 2026-09-23 — montaż modułu dostępności

Karta I15.8 zamontowała harmonogram Selly i sześć tras `sync-*`. Twoja karta ma w „Pliki"
zapis „montaż uzgodniony z I15.8" — oto ustalenie.

## Kto montuje `availability_sync`: TY (I15.10), w `src/server.ts`

I15.8 nie tworzy punktu wpięcia „na zapas" — byłby martwym kodem. Zamiast tego `server.ts`
ma już gotowe wszystkie zależności, których potrzebujesz, jako zmienne w zasięgu modułu:

- `klientSelly` — klient opakowany trybem (`opakujKlientaTrybem(…, env.SELLY_TRYB)`);
- `discoverySelly` — **JEDNA instancja na proces**, ta sama, którą dostają Tor 1, Tor 2
  i trasy ręczne. Jeśli Twój moduł woła `syncDelta`, MUSI dostać właśnie ją, nie własną
  (stan: nauczone `feature_id`, cache kodów produktów żyje w jej domknięciu);
- `db`, `env`.

Wzorzec do naśladowania masz obok, w tym samym pliku: `harmonogramSelly` powstaje jako obiekt,
który sam niczego nie uruchamia, a timer stawia dopiero `uruchom()` wołane w callbacku
`listen()`; `zatrzymaj()` idzie do `zamknij()` obok `scheduler.zatrzymaj()`. Dzięki temu cała
suita, która buduje aplikację przez `stworzApp`, nie widzi żadnego timera.

Jeśli Twój moduł ma być wołany także z TRASY (a nie tylko z automatu), przekaż go do
`stworzApp` jako nową opcjonalną zależność — tak jak I15.8 zrobiła z `discoverySelly`
(`ZaleznosciApp` w `src/app.ts`): pominięta w testach ⇒ `stworzApp` buduje zastępczą.

## Czego NIE ruszaj w plikach I15.8

`src/selly/rest/scheduler.ts` i `src/routes/selly-sync.ts` są własnością I15.8. Jeśli
dostępność ma wpływać na Tor 1 lub Tor 2, zmiana należy do `sync-delta.ts` / `sync-full.ts`
(Twoja własność), a harmonogram i trasy zobaczą ją same — wołają te funkcje bez pośredników.

## Dwie rzeczy, które Cię zaskoczą

1. **Jeden cykl Toru 1 to DZIESIĘĆ wpisów w `selly_sync_log`**, nie jeden — `runDeltaAll`
   woła `syncDelta` osobno dla każdego z `ACTIVE_SUPPLIERS`, a każde wywołanie zakłada własny
   wpis (`logSyncStart`). Jeśli będziesz liczyć przebiegi po wpisach logu, dziel przez liczbę
   dostawców. Kosztowało to jeden fałszywy alarm w testach ticketa 121.
2. **`GET /api/selly/sync-status` tnie do 20 wpisów** (`LIMIT_STATUSU_SYNC`), więc nie nadaje
   się na licznik czegokolwiek w teście — licz SQL-em po `selly_sync_log`.

## Stan `selly_sync_log` po starcie procesu

Od ticketa 121 harmonogram przy `uruchom()` domyka zastane wpisy `w_trakcie` jako `blad`
z `szczegoly_json = {"powod":"przerwany restartem procesu"}` (stała `POWOD_PRZERWANIA`
w `src/repos/selly.ts`). Jeśli Twój moduł czyta ten log, nie zakładaj, że `w_trakcie` oznacza
żywy cykl — po restarcie takich wpisów już nie ma.
