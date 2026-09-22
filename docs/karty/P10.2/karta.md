# P10.2 — kafel „Ostatni eksport CSV” pokazuje datę

> **Stan:** ✅ 2026-09-22 · 96-FEATURE-kafel-ostatni-eksport
> **Iteracja:** 10 — Analityka i Pulpit · **Wpisy backlogu:** #34 · **Zależy od:** P10.1, P6.2 (✅)
> **Ticket:** `96-FEATURE-kafel-ostatni-eksport`

Przeniesione z roadmapy (blok „Poprawki po testach Ani”, plan P) ticketem `86-DOCS-migracja-kart-etap2`, 2026-09-21.

## Zakres
Kafel „Ostatni eksport CSV” na Pulpicie pokazuje datę — pełna treść: `docs/rebuild-backlog.md` #34
(naprawa zatwierdzona przez Anię, wdrożenie w tej karcie).

## Pliki (wyłączna własność)
`rebuild/frontend/src/pages/pulpit/kpi.ts` (funkcja `opisKafelkaEksportu`, dawniej `znajdzPoTypie`),
`rebuild/frontend/src/pages/pulpit/api.ts`, `rebuild/frontend/src/pages/Pulpit.tsx` + testy
`test/pulpit.kpi.test.ts`, `test/pulpit.test.tsx`, `test/msw/pulpit.ts` (wg backlogu #34). Rusza
Pulpit tak jak P6.2 — dlatego po P6.2 (✅ 2026-09-21, ticket 77).

## Decyzje
Idzie **po P10.1** (✅ 2026-09-22, `wejscie-90.md`) — w fali B równolegle z P10.3 i PR.2; pliki rozłączne
(Pulpit vs analityka).

- **D1 (Ania, 2026-09-21, #34 wariant a — ODSTĘPSTWO):** kafel czyta `GET /api/history/paged`
  z `typ=eksport` i `typ=import`, `page=1&limit=1`, adres przez `adresStrony()` (DRY z widokiem Historii).
- **D2 (2026-09-22 — ODSTĘPSTWO):** Pulpit przestaje wołać `GET /api/history` — usunięte
  `useDziennikZmian`/`WpisDziennikaZmian`. Invalidacja `["/api/history"]` w `Katalog.tsx` zostaje
  (poza zakresem karty, nieszkodliwa).
- **D3 (2026-09-22 — ODSTĘPSTWO, nowy tekst):** błąd zapytania → wartość „—", podpis „Nie udało
  się pobrać historii" (nie udaje pustego stanu; reszta Pulpitu stoi).
- **D4:** logika podpisu 1:1 — import pokazywany tylko, gdy nie ma żadnego eksportu.
- **D5 (techniczne):** oba zapytania z `refetchOnMount: "always"` (obchodzi `staleTime: Infinity`
  z `lib/queryClient.ts`, żeby świeży eksport był widoczny od razu po powrocie na Pulpit).

## Dowiezione
Zakres z planu dowieziony bez odstępstw (ticket `96-FEATURE-kafel-ostatni-eksport`, 2026-09-22).
Kafel pokazuje datę względną ostatniego eksportu i „<dostawca|wszyscy> — N produktów"; bez
eksportu — „—" + „Ostatni import: <data>"; bez obu — „Brak eksportów ani importów"; przy błędzie
zapytania — „Nie udało się pobrać historii", reszta Pulpitu działa. Źródło:
`GET /api/history/paged?typ=eksport|import&page=1&limit=1` (dwa osobne zapytania,
`useOstatniWpisHistorii(typ)`), backend i `contract/` nietknięte.

**Co liczy się jako „eksport"/„import"** (słownik `SLOWNIK_AKCJI`, `backend/src/historia/mapowanie.ts`,
nie poszerzany): eksport = `eksport_csv` (`GET /api/export-shoper`, pojedynczy dostawca) i ZIP
„wszyscy" (`encja_typ="dostawcy"` — quirk oryginału: podpis „wszyscy — N produktów", gdzie N to
liczba DOSTAWCÓW, nie produktów) oraz `eksport_shoper`; import = `upload_pliku`, `import_cennika`.
**Generowanie CSV dla Selly (`POST /api/selly/generate-csv`) NIE pisze audytu → się nie liczy**,
tak samo `import_pliku`/`import_z_url` (poza słownikiem, backlog #21 ❌).

Snapshot produkcji: 0 eksportów, 92 × `upload_pliku` (ostatni 2026-07-27T10:27Z) — na stagingu
z tymi danymi kafel pokazuje „—" + „Ostatni import: 27.07.2026", pełną datę eksportu dopiero po
pierwszym eksporcie z katalogu.

Bramki: FE (lint/typecheck/build/test) zielone — 52 pliki, 914 testów. Backend nietknięty, gate
BE N/D (`git diff origin/develop -- rebuild/backend contract` pusty), `npm test` BE zielony
(1510 ✓, poza jednym flaky timeoutem pod obciążeniem, niezwiązanym z kartą — patrz raport.md).

## Do koordynatora
- `docs/rebuild-roadmap.md:~1615` (D3 „kafel odtworzony jako TRWALE MARTWY") jest od ticketu 96
  nieaktualne — kafel dziś pokazuje prawdziwe daty (#34 naprawione).
- `rebuild/backend/src/routes/history.ts:47-48` — komentarz „Wołają ją Pulpit (I10) i
  optymistyczny cache edycji katalogu" jest od ticketu 96 nieaktualny (Pulpit już nie woła
  `GET /api/history`); backend poza własnością tej karty, komentarz nie poprawiony.
- `test/msw/kontrakt.ts` — `dziennikZmianZFixtura()` straciła jedynego użytkownika (był nim
  Pulpit); plik współdzielony z równoległymi kartami (P10.3, PR.2), nie ruszany w tej karcie —
  do usunięcia przy okazji.
