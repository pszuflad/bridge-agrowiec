# 136-FEATURE — montaż modułu dostępności (`dostepnosc.ts`) w `server.ts`

> Status: **Zaplanowany — czeka na wstawienie w kolejkę przez koordynatora**
> Karta: `I15.10b` (`docs/karty/I15.10b/karta.md`)
> Założony: 2026-09-23, decyzją użytkownika po tickecie 119 (karta I15.10, PR #144)

## Po co ten ticket — luka, nie sprzeczność

Ticket 119 dowiózł moduł `rebuild/backend/src/selly/dostepnosc.ts` (port `availability_sync.cjs`)
i celowo NIE ruszał `app.ts`, zostawiając montaż „do uzgodnienia z I15.8". Odpowiedź I15.8
(`docs/karty/I15.10/wejscie-121.md`) przyszła PO zamknięciu ticketu 119 i mówi: **montaż należy
do I15.10, w `src/server.ts`**. Karta I15.10 jest już zamknięta, więc czynność nie ma dziś
właściciela.

Rozdział ról, żeby nie było dwuznaczności:
- **wołanie** `zadajOdswiezenie(dostawca)` z importera stagingu i decyzji „brak karty" — należy
  do **I15.4b** (`docs/karty/I15.4b/wejscie-119.md`), karta w toku;
- **montaż**, czyli zbudowanie instancji i rejestracja — **ten ticket**.

Dopóki montażu nie ma, `zadajOdswiezenie()` jest świadomym no-opem: I15.4b może wołać w próżnię
i nikt tego nie zauważy.

## Zakres (mały i zamknięty)

W `rebuild/backend/src/server.ts`, wzorem `harmonogramSelly` (`server.ts:56-61`):

```ts
ustawDomyslnaSynchronizacjeDostepnosci(
  stworzSynchronizacjeDostepnosci({
    db,
    discovery: discoverySelly,      // TA SAMA instancja co Tor 1, Tor 2 i trasy ręczne
    sciezkiCsv: { katalog: env.SELLY_CSV_DIR, plik: env.SELLY_CSV_PLIK, url: env.SELLY_CSV_URL },
  }),
);
```

## Wymagania, których nie wolno pominąć

1. **Jedna instancja `discoverySelly` na proces** (`wejscie-121.md`): w jej domknięciu żyją
   nauczone `feature_id` i cache kodów produktów. Własna instancja = cicha utrata tego stanu.
2. **Ścieżki CSV biorą się z env tak samo jak w `app.ts:218-221`** (`SELLY_CSV_DIR`,
   `SELLY_CSV_PLIK`, `SELLY_CSV_URL`) — nie wymyślać drugiego źródła prawdy.
3. **Nic nie rusza w plikach I15.8** (`src/selly/rest/scheduler.ts`, `src/routes/selly-sync.ts`).
4. **Testy budujące aplikację przez `stworzApp` nie mogą zobaczyć zmiany** — rejestracja idzie
   w `server.ts`, nie w `stworzApp`. Jeśli moduł ma być wołany także z trasy, dopiero wtedy
   dokładamy go do `ZaleznosciApp` (wzór: `discoverySelly`).
5. **Sprzątanie**: `ustawDomyslnaSynchronizacjeDostepnosci(null)` w `zamknij()`, obok
   `scheduler.zatrzymaj()` i `harmonogramSelly.zatrzymaj()`.
6. ⚠ **Nie wołać `zadajOdswiezenie()` z wnętrza `syncDelta`** — moduł drenuje kolejkę w pętli
   `while`; bezwarunkowe zgłoszenie ze środka delty dało OOM w testach ticketu 119
   (`docs/karty/I15.4b/wejscie-119.md`).

## Testy

- Montaż jest widoczny: po starcie `zadajOdswiezenie("MO1")` kolejkuje (a nie jest no-opem) —
  z podmienionym `generujCsv` i `syncDelta`, bez pisania pliku i bez sieci.
- `stworzApp` bez montażu nadal działa (cała dotychczasowa suita ma przejść bez zmian).
- Po `zamknij()` zgłoszenie znów jest no-opem.

## Out of scope

- Wołanie z importera stagingu (I15.4b).
- Zmiana semantyki kolejki albo odstępstwa „generator w tym samym procesie" — to już
  rozstrzygnięte w 119 i potwierdzone przez `docs/karty/I15.10/wejscie-122.md`.
