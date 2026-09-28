# P10.1 — klaster backendu analityki: ożywienie kart „Dostępności” + trzy poprawki towarzyszące

> **Stan:** ✅ 2026-09-22 · 90-FEATURE-ozywienie-kart-dostepnosci
> **Iteracja:** 10 — Analityka i Pulpit · **Wpisy backlogu:** #31, #32, #33, #35 · **Zależy od:** —
> **Ticket:** `90-FEATURE-ozywienie-kart-dostepnosci`

Przeniesione z roadmapy (blok „Poprawki po testach Ani”, plan P) ticketem `86-DOCS-migracja-kart-etap2`, 2026-09-21.

## Zakres
Klaster backendu analityki (`repos/analityka-*.ts`, trasy analityki). Pełna treść każdego wpisu
w `docs/rebuild-backlog.md` (#31, #32, #33, #35).

## Pliki (wyłączna własność)
Backend analityki: `rebuild/backend/src/repos/analityka.ts`, `repos/analityka-eksport.ts`,
`routes/analytics.ts` + testy analityki BE; `contract/openapi.yaml` (404 dla `export/:view`).
Frontend tylko w obrębie zakładki „Dostępność”, jeśli wymusi to pusta nazwa (#32).
P10.3 po decyzji z 2026-09-21 (eksport z przeglądarki, `docs/karty/P10.3/wejscie-87.md`) NIE rusza
plików backendu — idzie po P10.1 z powodu danych, nie kolizji plików.

## Decyzje
**PODJĘTE 2026-09-21 przez użytkownika, wszystkie zgodnie z rekomendacją** (pełna treść w backlogu).
Do 21.09 karta stała na „gotowe”, choć #31, #33 i #35 miały w backlogu „do decyzji” — rozjazd
zamknięty. Przy #32 Ania zatwierdziła NAPRAWĘ, a wybór WARIANTU był decyzją techniczną użytkownika.

| Wpis | Decyzja |
|---|---|
| **#32** | wariant (a): nazwa z katalogu, `LEFT JOIN products` po **`dostawca` + `kod`**; usunięty produkt → kreska |
| **#33** | naprawić razem z #32; z duplikatów klucza brać **ostatni wpisany** (`MAX(id)`) — karta najpierw MIERZY, co import zostawia w katalogu |
| **#31** | naprawić: nie dokładać migawki, jeśli produkt ma już dzisiejszą; **bez** indeksu unikalnego |
| **#35** | lista znanych widoków eksportu, reszta **404** (zamiast `200` z samym BOM) → zmiana kontraktu |

⚠ **Skutek dla PR.2** (kafle KPI analityki) i **P10.2** (kafel na Pulpicie): P10.1 ożywia dane, które
te karty mogą pokazywać — obie idą po P10.1.

## Dowiezione
Wszystkie cztery świadome odstępstwa dowiezione 1:1 z decyzjami z 2026-09-21:
- **#32** — `LEFT JOIN products` po `(dostawca, kod)` w obu kartach dashboardu (4.1, 4.2) i obu
  eksportach CSV; usunięty produkt → `nazwa: null` (JSON) / „—” (UI, przez istniejące
  `formatuj()`, bez zmiany kodu FE — tylko komentarze i test widoku).
- **#33** — wspólne CTE `HISTORIA_BEZ_DUPLIKATOW_KLUCZA` (`MAX(id)` per klucz `(dostawca, kod,
  zarejestrowano_at)`), `LAG` liczony na zwiniętej historii w `tempoSchodzenia` i
  `eksportTempaSchodzenia`. Pomiar na prawdziwym silniku importu (`import/tk.ts`, przed kodem):
  import zostawia w `products` linię **ostatnią** cennika; niuans „przypadku mieszanego” (ostatnia
  linia ma `stan` równy stanowi sprzed importu, ale inną cenę) — `MAX(id)` daje wtedy stan
  ostatniej linii, katalog stan wcześniejszej dla pola `stan` — poza zakresem, idzie do przyszłej
  karty importu.
- **#31** — `bootstrap-current` nie dubluje migawki w obrębie **dnia kalendarzowego UTC**
  (`substr(zarejestrowano_at,1,10)`), bez indeksu unikalnego, bez migracji; kształt `{ok,
  inserted, at}` bez zmian.
- **#35** — nieznany widok `export/{view}` → `404 {error}` (zamiast `200` + BOM); znane widoki
  z jednego źródła (`Object.hasOwn(WIDOKI_EKSPORTU, …)`); `openapi.yaml` ma `404` zapisane ręcznie.

Pomiar na `db/snapshot.db` (kopia produkcji 2026-08-13): 14 513 wierszy `historia_cen`, 30 grup /
67 wierszy duplikatów klucza, 1 897 par `(dostawca, kod)` bez katalogu → pusta nazwa.

Fixtures (`contract/fixtures/`) **nietknięte** — oba nagrania (`GET_analytics_availability_products.json`,
`GET_analytics_availability_sell-through.json`) mają `rows: []` z produkcji; `gate/ksztalt.ts` nie
zagląda do elementów pustej tablicy wzorca, więc rozjazd treści nie zapala testu i `WyjatekGate`
jest zbędny.

Odstępstwo od planu: test „ten sam kod u dwóch dostawców” z promptu niewykonalny wprost —
`products.kod` jest globalnie `UNIQUE` (`001_schema.sql:24`) — zastąpiony równoważnym wariantem
(kod K w historii u dwóch dostawców, w katalogu tylko u jednego → jeden dostaje nazwę, drugi
`null`; opisane w `raport.md`, sekcja „Deviations from plan”).

Bramki: backend 90 plików / 1481 testów, frontend 51 plików / 892 testy, oba zielone.

## Do koordynatora
- Karta nie dotykała `docs/rebuild-roadmap.md` (reguła 0 CLAUDE.md) — prompt ticketu 90 mówił o
  „wierszu P10.1 w roadmapie”, ale to sprzeczne z regułą własności kart. Stan P10.1 w roadmapie
  (§4 i tabela kart iteracji 10) czeka na odświeżenie przez koordynatora.
- Kandydat na nowy wpis backlogu (wykryty przez review): `dostepnoscProduktow` (karta 4.1,
  `repos/analityka.ts`) wybiera `h.ean` GOŁE obok `GROUP BY h.dostawca, h.kod` — ten sam wzorzec co
  naprawione #33, tylko dla EAN-u (port 1:1 oryginału, `mirror/backend/analytics_module.cjs:161-165`).
  Na snapshocie 9 par ma w historii dwa różne EAN-y, więc wybór jest zależny od implementacji
  SQLite. Nienaprawione celowo — wymagałoby nowej decyzji użytkownika.
- Karta 4.1 i `export/availability-products` liczą `COUNT(*)`/procent po surowej (niezwiniętej)
  historii — decyzja #33 obejmowała wyłącznie `sell-through`, więc duplikat klucza tam nadal liczy
  się podwójnie. Do ewentualnej osobnej decyzji.
- Niuans importu „przypadek mieszany” z pomiaru #33 (patrz „Dowiezione”) — dla przyszłej karty
  dotykającej `import/tk.ts`, nie dla P10.1 (import był tylko czytany).
