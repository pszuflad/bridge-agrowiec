# Wejście dla I15.4b od ticketu 120 (karta I15.2, resync parserów) · 2026-09-23

> Plik napisany dla DAWNEJ karty I15.4, przed jej podziałem na I15.4a/b/c (ticket 123). Przeniesiony przez
> koordynatora (ticket 127) do **I15.4b i I15.4c** — punkty o `_bridgeFeedMeta` i stanie przejściowym D4
> dotyczą ścieżki zapisu (I15.4b), a wszystko o akceptacji i zgłoszeniach — ścieżki akceptacji (I15.4c).
> Czytaj całość, wykonuj to, co należy do Twojego zakresu.

Warstwa parserów jest już na stanie `88fa31c`. Poniżej to, co z tego wynika dla silnika i stagingu.

## 1. `_bridgeFeedMeta` czeka gotowe — trzeba je tylko skonsumować

`feed_safety.attach()` (wołane w `dispatcher.cjs:47`) dokleja do TABLICY rekordów niewyliczalną
właściwość, a `converted()` (`adapter.cjs:733`) przenosi ją na pozycje po adapterze:

```js
_bridgeFeedMeta = { complete, parserErrors, source, rawCount, excludedCodes }
```

- `source` to `'Agrorami GraphQL'` dla MO9, `'supplier file'` dla reszty.
- `excludedCodes` to kody odrzucone PRZEZ PARSER **plus** odrzucone przez adapter, każdy z prefiksem
  kodu dostawcy (`MO1_ABC`). Na pełnym cenniku MO3 to 718 pozycji — warto to zobaczyć przed projektowaniem UI.
- Właściwość jest `enumerable: false`, więc **nie wchodzi** do `JSON.stringify` ani `Object.keys`.
  To celowe: nie wycieknie do odpowiedzi API ani do `staging_items.snapshot_json` przypadkiem.
  Trzeba po nią sięgnąć wprost: `rekordy._bridgeFeedMeta`.

⚠ **Nasza warstwa `parsuj.ts` ją dziś GUBI.** `parsujPlik()` buduje nowy obiekt `WynikParsowania`
i przepisuje `rekordy`, więc referencja do tablicy przeżywa, ale `WynikParsowania` nie ma pola na meta.
Nic w `rebuild/backend/src` dziś tego nie czyta (grep: zero trafień). Przy porcie silnika trzeba
dołożyć meta do `WynikParsowania` — to kilka linii w `parsuj.ts` i typie `typy.ts`.

## 2. Stan przejściowy D4 — ZMIERZONY, nie oszacowany

Adapter oddaje `ean: null` + `eanRaw` + `_eanLossy` dla błędnego EAN-u. Silnik tych flag nie zna.
**Import się nie psuje** — `tk.ts:221` robi `rekord.ean == null ? "" : ...`, więc degraduje się do
„EAN pusty" (jak odstępstwo 14i), bez wyjątku.

Skala, zmierzona na pełnych realnych cennikach (stary port vs nowy, to samo wejście):

| | stary | nowy | delta |
|---|---|---|---|
| MO3 `ean: null` | 87 | 87 | 0 |
| MO4 | 5 | 5 | 0 |
| MO5 | 26 | 32 | **+6** |

Cała nowa ekspozycja to **6 rekordów z 4 843 (0,12 %)** i są to pozycje, które wcześniej niosły bezsensowny
EAN `…W2`, niepasujący do niczego. Liczba rekordów po obu stronach identyczna.

**Zachowanie, które masz zmienić:** pozycja z błędnym EAN-em wchodzi dziś pod własnym kodem dostawcy jako
NOWA. Decyzja D4 mówi, że ma być **błędem blokującym akceptację do ręcznej poprawki**.
Test `test/silnik.gate.test.ts` → „EAN w notacji naukowej — D4 daje ean=null, pozycja wchodzi pod własnym
kodem" opisuje dziś to okno przejściowe i **jest do przepisania na oczekiwaną blokadę** przy Twoim porcie.
Konkret zmierzony na tym teście: `"8,05997E+12"` → `kod MO1_GATE-NORMEAN`, `ean null`,
`eanRaw "8,05997E+12"`, `_eanLossy true`.

## 3. Dublujący się bezpiecznik pustego wejścia — do rozstrzygnięcia

Mamy DWA bezpieczniki na to samo:
- nasz starszy `PustyImportBlad` (odstępstwo **D7**, `tk.ts:65-71`) — powstał, bo stara produkcja
  nie miała żadnego;
- produkcyjny `feed_safety.attach()` (#103) — nowszy, rzuca wcześniej, jeszcze w dispatcherze.

Ticket 120 połączył je tak, żeby nic nie zmienić dla użytkownika: w `parsuj.ts` wyjątek „pusty cennik"
z `feed_safety` jest tłumaczony **na `PustyImportBlad`**, więc kod 400 i komunikat („…ani jednej pozycji…")
zostają dokładnie takie, jak były. Błędy parsera dostały osobny typ `BladCennika` (też 400).

Przy przepisywaniu tej ścieżki pod D4 zdecyduj, czy `PustyImportBlad` ma zostać, czy ustąpić komunikatowi
produkcji. To Twój plik — my tylko nie chcieliśmy zostawić 500 w oknie między kartami.

## 4. `staging_policy.cjs` jest już w `legacy/` — CAŁY

Moduł leży w `rebuild/backend/src/import/legacy/staging_policy.cjs`, skopiowany **bajt w bajt**
z `88fa31c` (decyzja D-1 użytkownika: kopiujemy całe pliki, nie okrojone do „czystej części" —
inaczej pękłby gate integralności sha256).

- Używane już dziś przez warstwę parserów: `validateEan`, `rawEan`, `syntheticCode` (+ `norm`, `hash`,
  `identity`, `variant`, `OPTIONAL` jako ich zależności) — linie 1-81.
- **Czekają na Ciebie, nietknięte i nikt ich nie woła:** `install({U,db,normalize,classify,badName,ext})`
  (linia 82) i `registerRoutes(app,{U,we,be})` (linia 620), a w nich cała logika #103/#104/#106:
  `product_absence_checks`, `supplier_feed_state`, `staging_absence_decisions`, progi „3 kompletne oferty
  i 24 h", blokada źródła mniejszego o >20 %.
- Moduł **nie ma efektów ubocznych przy `require()`** i **nie otwiera bazy sam** — `install()` dostaje `db`
  jako argument. Sprawdzone przed kopiowaniem.

## 5. `extensions.cjs` — hunki, które należą do Ciebie

Diff `origin/develop` → `88fa31c` ma 5 hunków (+34/−1). Twoje:

| Hunk | Linie @ main | Co robi |
|---|---|---|
| 1 | 18–21 | `require('./payment_blocks.cjs')` i `require('./application_rules.cjs')` na starcie |
| 2 | 111–130 | `ensurePaymentBlocks()` + `ensureApplicationRules()` przy `register()` — **najpewniej już pokryte migracją 011 z I15.1**; sprawdź, zanim cokolwiek portujesz |
| 4 | 839–842 | `startScheduler()` wygaszony natychmiastowym `return` — komentarz „Scheduler delegated to core D4", powód: drugi timer dublował pobrania **i liczniki nieobecności**. Dotyczy też I15.10 |

Hunk 3 (Selly) → I15.8. Hunk 5 to usunięty pusty wiersz.

**Dla parsowania `extensions.cjs` nie wnosi nic** — całe wpięcie `feed_safety` siedzi w `dispatcher.cjs`
i `adapter.cjs`, czyli w plikach już sportowanych.

## 6. Drobiazg, który oszczędzi Ci pół godziny

`test/silnik.charakteryzacja.test.ts` bierze rekordy wejściowe wprost z
`test/charakteryzacja/MOx.expected.json` (wzorzec warstwy parserów). Ticket 120 przenagrał oba wzorce,
więc na `develop` wszystko jest zielone — ale **każda kolejna zmiana parserów znów przestawi wejście
silnika**. Nagrywarka silnika wymaga `db/snapshot.db` (32 MB, w `.gitignore`, leży w głównym repo).
