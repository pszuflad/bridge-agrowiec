# 96-FEATURE-kafel-ostatni-eksport — Implementation report

## Summary
Kafel „Ostatni eksport CSV" na Pulpicie pokazuje prawdziwe dane (backlog #34, decyzja Ani
2026-09-21, świadome odstępstwo): datę względną i „<dostawca|wszyscy> — N produktów" ostatniego
eksportu, a przy braku eksportu — „Ostatni import: <data>". Źródło: dwa zapytania
`GET /api/history/paged?typ=eksport|import&page=1&limit=1`. Pulpit przestał wołać `GET /api/history`.
Backend i `contract/` bez zmian.

## Changes
- `rebuild/frontend/src/pages/pulpit/api.ts` — usunięte `WpisDziennikaZmian` i `useDziennikZmian`;
  nowe `useOstatniWpisHistorii(typ)` (adres z `adresStrony()` widoku Historii, `refetchOnMount: "always"`);
  nagłówek pliku z opisem odstępstwa.
- `rebuild/frontend/src/pages/pulpit/kpi.ts` — `znajdzPoTypie` (sygnatura celowo blokująca `typ`)
  zastąpione czystą funkcją `opisKafelkaEksportu(eksport, import, teraz)` → `{wartosc, zmiana}`;
  stała `PODPIS_BLEDU_HISTORII`; komentarz: odstępstwo, słownik akcji, quirk ZIP.
- `rebuild/frontend/src/pages/Pulpit.tsx` — dwa zapytania, kafel rysuje wynik `opisKafelkaEksportu`;
  akapit „1:1, choć wygląda na defekt" zamieniony na sekcję odstępstwa #34.
- `rebuild/frontend/test/pulpit.kpi.test.ts` — zamrożenie D3 zamienione na 8 przypadków
  (eksport, ZIP „wszyscy", `liczbaPozycji: null`, tylko import, pusto, ładowanie/401, błąd eksportu,
  błąd importu), z komentarzem „świadome odstępstwo, #34, decyzja Ani 2026-09-21".
- `rebuild/frontend/test/pulpit.test.tsx` — handler `/api/history/paged` sprawdzający `typ`,
  `page=1`, `limit=1` (inny adres → 400); asercje na TREŚĆ kafla (data + podpis), tylko import,
  pusto, 500 (reszta Pulpitu stoi), odświeżenie po powrocie na Pulpit, brak żądania `/api/history`.
- `rebuild/frontend/test/msw/pulpit.ts` — `handleryPulpitu()`: `/api/history` → `/api/history/paged`
  (pusta koperta).

## Co liczy się jako „eksport" / „import" (ustalenie z karty)
Kafel pokazuje to, co Historia — słownik `SLOWNIK_AKCJI` w `backend/src/historia/mapowanie.ts`
(nie poszerzany):
- **eksport**: `eksport_csv` — `GET /api/export-shoper` (pojedynczy dostawca, `liczbaProduktow`)
  i ZIP „wszyscy" (`encja_typ="dostawcy"`, `liczbaDostawcow`); `eksport_shoper` — `GET /api/export/shoper`.
  Quirk oryginału (`:48366`, `:48800`): dla ZIP `liczbaPozycji = liczbaDostawcow`, więc podpis brzmi
  „wszyscy — 10 produktów", gdzie 10 to liczba dostawców. Zostaje 1:1 (Historia pokazuje to samo).
- **generowanie CSV dla Selly** (`POST /api/selly/generate-csv`) NIE pisze `audit_log` → nie liczy się.
- **import**: `upload_pliku` (`routes/suppliers.ts`), `import_cennika` (`routes/staging-mutacje.ts`).
  `import_pliku` / `import_z_url` (`routes/import.ts`) są poza słownikiem (backlog #21 ❌) → nie liczą się.
- Snapshot produkcji: 0 eksportów, 92 × `upload_pliku` (ostatni 2026-07-27T10:27Z) — na stagingu
  z tymi danymi kafel pokaże „—" + „Ostatni import: 27.07.2026", pełna data dopiero po eksporcie.

## Deviations from plan
Brak. (Dodany ponad plan test odświeżenia po powrocie na Pulpit — weryfikuje D5.)

## Test results
- **Gate odbudowy (fixtures/kontrakt):** N/D dla backendu — backend i `contract/` nietknięte
  (`git diff origin/develop -- rebuild/backend contract` pusty). Frontend konsumuje
  `GET /api/history/paged` w kształcie `GET_history_paged.json` (mock buduje wpis z nagrania).
- **Frontend:** lint ✓, typecheck ✓, build ✓, `npm test` ✓ — 52 pliki, 914 testów.
- **Testy mutacyjne (ręcznie):** `limit: 2` w adresie → 3 testy integracyjne czerwone;
  usunięte `refetchOnMount` → test odświeżenia czerwony. Oba przywrócone.
- **Backend:** `npm test` — 1510 ✓ / 1 skipped / 1 timeout w `test/alerty-katalogu.gate.test.ts`
  („paczka równa limitowi 20 000 id", 20 s) przy pełnym biegu pod obciążeniem; ten plik uruchomiony
  osobno — 37/37 ✓. Backend bez zmian w tym tickecie.

## Breaking changes
Brak w API. Zmiana widoczna dla użytkownika: kafel przestaje być martwy (zatwierdzone odstępstwo #34).

## Review fixes applied
- NICE-TO-HAVE: komentarz `opisKafelkaEksportu` wprost nazywa, że błąd zapytania o eksport wygrywa z poprawnym importem.
- SHOULD-FIX #1 (karta/backlog/wejście P10.4) — realizowany w fazie docs (commit „sync docs”).
- SHOULD-FIX #2 (komentarz `rebuild/backend/src/routes/history.ts:47-48` „Wołają ją Pulpit (I10)…” nieaktualny) — backend poza własnością karty; przeniesione do Follow-up i „Do koordynatora”.

## Follow-up
- Komentarz nad `GET /api/history` w `rebuild/backend/src/routes/history.ts:47-48` wymienia Pulpit jako odbiorcę — od ticketu 96 nieprawda (zostaje invalidacja klucza w katalogu). Backend poza własnością tej karty.
- Widok `/historia` ma ten sam problem ze `staleTime: Infinity` — po eksporcie lista Historii
  odwiedzona wcześniej w tej sesji pokazuje stan sprzed eksportu do przeładowania. Poza zakresem
  (pliki Historii).
- `dziennikZmianZFixtura()` w `test/msw/kontrakt.ts` nie ma już użytkownika — plik współdzielony
  z równoległymi kartami (P10.3, PR.2), więc nie ruszany; do usunięcia przy okazji.
- Timeout testu 20 000 id (`alerty-katalogu.gate.test.ts`) przy pełnym biegu BE — flaky pod
  obciążeniem, warto podnieść limit czasu tego testu.
