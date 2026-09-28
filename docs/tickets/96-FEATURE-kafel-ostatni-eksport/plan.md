# 96-FEATURE-kafel-ostatni-eksport — kafel „Ostatni eksport CSV" pokazuje prawdziwe daty (P10.2, #34)

> Status: Approved
> Branch: `feature/96-kafel-ostatni-eksport`
> Worktree: `.worktrees/96-FEATURE-kafel-ostatni-eksport`
> Karta: `docs/karty/P10.2/` · Backlog: #34

## Ticket description
P10.2 — Iteracja 10: kafel „Ostatni eksport CSV" na Pulpicie pokazuje prawdziwe daty (#34).
Decyzja Ani 2026-09-21, pytanie 10.2, wariant (a): „niech zacznie pokazywać datę". ŚWIADOME
ODSTĘPSTWO od produkcji, w której kafel jest trwale martwy.

## Context
- Oryginał `N2` (`deminified/frontend-index.js:16852`, `:16902-16917`): `d = r.find(e => "eksport"
  === e.typ)`, `p = …"import"…` na odpowiedzi `GET /api/history` (tabela `history`, wiersze BEZ
  pola `typ`) → kafel zawsze „—" / „Brak eksportów ani importów". Rebuild odtworzył to 1:1
  (10f, D3): `znajdzPoTypie` w `pages/pulpit/kpi.ts`, zapytanie `useDziennikZmian` w
  `pages/pulpit/api.ts`, dwa testy zamrażające.
- Rysunek kafla (zostaje 1:1): wartość `d ? Bu(d.kiedy) : "—"`; podpis
  `d ? "${d.dostawca ?? "wszyscy"} — ${d.liczbaPozycji ?? 0} produktów"` :
  `p ? "Ostatni import: ${Bu(p.kiedy)}"` : `"Brak eksportów ani importów"`; `testId: kpi-export`,
  `href: /historia`. `Bu` = `sformatujWzglednie` (`pages/pulpit/czas.ts`).
- `GET /api/history/paged` (`rebuild/backend/src/routes/history.ts`, `historia/mapowanie.ts`):
  `typ` zawęża w SQL, sortowanie malejąco po `kiedy`, `limit` clampowany do [1,200] → `limit=1`
  daje dokładnie najnowszy wpis danego typu. Wpis ma `kiedy`, `dostawca`, `liczbaPozycji`
  (`WpisHistorii` w `pages/historia/dane.ts`). Backend bez zmian.
- **Co liczy się jako „eksport"** (słownik `SLOWNIK_AKCJI`): `eksport_csv` (`GET /api/export-shoper`
  — pojedynczy dostawca: `liczbaProduktow`; ZIP „wszyscy": `encja_typ="dostawcy"`,
  `liczbaDostawcow` → podpis „wszyscy — 10 produktów", gdzie 10 to liczba DOSTAWCÓW — quirk
  oryginału `:48366`/`:48800`, zostaje), `eksport_shoper` (`GET /api/export/shoper`).
  **Generowanie CSV dla Selly (`POST /api/selly/generate-csv`) NIE pisze audytu → nie liczy się.**
- **„Import"**: `upload_pliku` (`routes/suppliers.ts`), `import_cennika` (`routes/staging-mutacje.ts`).
  `import_pliku` / `import_z_url` (`routes/import.ts`) są poza słownikiem (backlog #21 ❌) → nie liczą się.
- Snapshot produkcji: 0 eksportów, 92 × `upload_pliku` (ostatni 2026-07-27T10:27Z). Na stagingu
  z tymi danymi kafel pokaże „—" + „Ostatni import: <data>", pełną datę dopiero po eksporcie.
- `staleTime: Infinity` w `lib/queryClient.ts` — bez wymuszenia odświeżenia kafel po eksporcie
  w katalogu i powrocie na Pulpit pokazywałby stan sprzed eksportu aż do przeładowania.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa
- `GET /api/history/paged` — konsument (frontend) nowej trasy; kształt koperty i wpisu z
  `contract/fixtures/GET_history_paged.json` / `openapi.yaml`. Backend i `contract/` nietknięte.
- Gate BE nie dotyczy (brak zmian backendu) — potwierdzamy tylko zielone testy BE.
- Mocki MSW w testach mają kształt z fixture (`{items,total,pages,page,limit}`).

## Decisions
- **D1 (Ania, 2026-09-21, #34 wariant a — ODSTĘPSTWO):** kafel czyta `GET /api/history/paged`
  z `typ=eksport` i `typ=import`, `page=1&limit=1`. Adres przez `adresStrony()` z `historia/dane.ts` (DRY).
- **D2 (użytkownik, 2026-09-22 — ODSTĘPSTWO):** Pulpit przestaje wołać `GET /api/history` —
  był jedynym konsumentem. Usuwamy `useDziennikZmian` i `WpisDziennikaZmian` z `pulpit/api.ts`.
  Invalidacja `["/api/history"]` w `Katalog.tsx` zostaje (nie moja własność; nieszkodliwa).
- **D3 (użytkownik, 2026-09-22 — ODSTĘPSTWO, nowy tekst):** błąd zapytania → wartość „—",
  podpis „Nie udało się pobrać historii". Nie udaje pustego stanu; reszta Pulpitu stoi.
- **D4 (użytkownik):** logika podpisu 1:1 — import tylko, gdy nie ma żadnego eksportu.
- **D5 (Master, techniczne):** oba zapytania z `refetchOnMount: "always"` — każde wejście na
  Pulpit pobiera świeży stan (dwa zapytania `limit=1`, tanie). Bez tego `staleTime: Infinity`
  ukrywałby świeży eksport.
- Teksty, format daty (`sformatujWzglednie`), `testId`, `href`, ikona — 1:1.

## Implementation plan
1. `pages/pulpit/api.ts`: usunąć `WpisDziennikaZmian` + `useDziennikZmian`, poprawić nagłówek
   (lista tras); dodać `useOstatniWpisHistorii(typ: "eksport" | "import")` →
   `useQuery<StronaHistorii | null>({ queryKey: [adresStrony({page:1,limit:1,search:"",typ,dostawca:"all"})], refetchOnMount: "always" })`.
2. `pages/pulpit/kpi.ts`: `znajdzPoTypie` zastąpić czystą funkcją
   `opisKafelkaEksportu({eksport, import, blad}, teraz?)` → `{wartosc, zmiana}` (cała logika kafla
   testowalna bez DOM-u) + pomocnik `pierwszyWpis(strona)`; nowy komentarz (odstępstwo #34, słownik akcji).
3. `pages/Pulpit.tsx`: podpiąć dwa zapytania, usunąć `useDziennikZmian`, przepisać akapit nagłówka
   o martwym kaflu (przenieść do sekcji odstępstw).
4. Testy: `test/pulpit.kpi.test.ts` (zamiast zamrożenia D3 — przypadki: eksport, ZIP „wszyscy",
   tylko import, nic, błąd, `null` z 401), `test/pulpit.test.tsx` (handler `/paged` rozróżniający
   `typ`, asercje na TREŚĆ: data względna + „MO3 — 42 produktów", tylko import, pusto, 500 → reszta
   Pulpitu stoi), `test/msw/pulpit.ts` (`/api/history` → `/api/history/paged` z pustą kopertą).
5. Bramki FE; testy BE.

## Testing strategy
- Jednostkowo `opisKafelkaEksportu` — wszystkie gałęzie, czas lokalny ze stałym `teraz`.
- Integracyjnie (MSW + `<App />`) — kafel rysuje datę z odpowiedzi `/paged`; handler sprawdza
  parametry `typ`, `limit=1`, `page=1` (inaczej 400) — więc zły adres wywali test, nie przejdzie cicho.
- Pozostałe testy renderujące `/` korzystają z `handleryPulpitu()` — dopisany handler `/paged`.

## Out of scope
- Backend, słownik akcji (nie poszerzamy: Selly CSV, `import_pliku`, `import_z_url` zostają poza).
- Odświeżanie widoku `/historia` po eksporcie (ten sam `staleTime: Infinity`) → follow-up.
- Karty alertów (P6.2), `pages/analityka/**`, roadmapa, `docs/instrukcja-testow-I10.md`.

## Definition of done
- [ ] Kafel pokazuje datę względną ostatniego eksportu i „<dostawca|wszyscy> — N produktów".
- [ ] Bez eksportu, z importem → „—" + „Ostatni import: <data>"; bez obu → „Brak eksportów ani importów".
- [ ] Błąd zapytania → „Nie udało się pobrać historii", reszta Pulpitu działa.
- [ ] Pulpit nie woła `GET /api/history`; `handleryPulpitu()` ma `/api/history/paged`.
- [ ] lint, typecheck, build, test FE zielone; testy BE zielone; `contract/` i backend nietknięte.
- [ ] karta P10.2 ✅, backlog #34 Status, `docs/karty/P10.4/wejscie-96.md`.
