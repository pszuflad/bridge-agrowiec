# Wejście dla I15.9 od ticketu 121 (I15.8) · 2026-09-23 — harmonogram i trasy `sync-*` gotowe

## Godziny — kod wygrał ze wszystkimi opisami

Odtworzone 1:1 z `scheduler_selly.cjs@88fa31c`:
- **Tor 1:** tick co 60 s; bieg o **HH:55** (event-driven, po auto-pull dostawców o HH:54)
  oraz fallback **HH:10 / HH:25 / HH:40**. Każdy bieg to `syncDelta` po kolei dla wszystkich
  dziesięciu dostawców.
- **Tor 2:** **04:30**, rotacja per dzień tygodnia: pn MO1+MO2, wt MO3+MO4, **śr MO5+MO6**,
  czw MO9, pt MO10, **pierwsza sobota** miesiąca MO7, **pierwsza niedziela** MO8.
  „Pierwsza" znaczy `date.getDate() <= 7`.

Dwa rozjazdy wobec opisów, oba rozstrzygnięte na korzyść kodu (i tak zamrożone testem):
- opis Ani mówi „w nocy między 3–4 rano" — kod ma 04:30;
- specyfikacja Ani podaje dla środy samo „MO5" — kod ma MO5 **i** MO6.

## Harmonogram jest domyślnie WYŁĄCZONY

Nowa flaga **`SELLY_SCHEDULER`** (`config/env.ts`), wzorem `IMPORT_SCHEDULER`. Produkcja
włącza ją jawnie przy cutoverze — inaczej nocna synchronizacja Selly po prostu nie ruszy,
a panel będzie wyglądał normalnie. To jest świadome odstępstwo: produkcja instaluje
harmonogram bezwarunkowo (`extensions.cjs:486-487`), ale u nas włączony harmonogram realnie
zapisuje do cudzego sklepu, więc na stagingu musi milczeć.

Drugi zawór: `uruchom()` **odmawia startu przy `SELLY_TRYB=wylaczony`** (przy tym trybie
discovery myli blokadę odczytu z „produkt nie istnieje" i zakłada duplikaty w sklepie).
`tylko-odczyt` startu nie blokuje.

## Sześć tras `sync-*` jest w kontrakcie

`GET /api/selly/sync-status` (ostatnie 20 wpisów `selly_sync_log`, stan limitera, rotacja na
dziś) oraz pięć POST-ów. Wszystkie za `requireAuth`, wszystkie w `contract/openapi.yaml`.

⚠ **Przycisków synchronizacji w panelu NIE MA na produkcji** i ten ticket ich nie dorabia
(żaden z ośmiu żywych skryptów frontu nie woła `sync-*`). Jeśli I15.9 dotyka frontu Selly,
to jest stan zastany, nie brak do uzupełnienia — dorobienie UI wymaga osobnej decyzji Ani.

## Trzy trasy działają u nas, a na produkcji oddają 500

Zatwierdzone odstępstwa (decyzje użytkownika 2026-09-23): produkcja importuje nieistniejące
`syncDeltaForDostawca` i `runFullTodays`, a `sync-full-force` dodatkowo gubi podaną listę
dostawców (`forceSuppliers` vs `opts.suppliers`). Naprawione. Znaczenie dla I15.9: jeśli
porównujesz zachowanie z produkcją, te trzy trasy **celowo** się różnią — produkcja oddaje
HTTP 500 „… is not a function".
