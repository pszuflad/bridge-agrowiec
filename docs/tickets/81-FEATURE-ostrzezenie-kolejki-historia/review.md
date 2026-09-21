# 81-FEATURE-ostrzezenie-kolejki-historia — Code review

> Reviewed: 2026-09-21
> Branch: feature/81-ostrzezenie-kolejki-historia
> Diff: 8 plików (197 dodań / 19 usunięć), 2 commity

## BLOCKER

Brak.

## SHOULD-FIX

Brak.

## NICE-TO-HAVE

- [ ] `rebuild/frontend/test/atrybuty.pending.test.tsx:255` — nazwa testu „dialog aliasu ma to
  samo ostrzeżenie i dodatkowo mówi, że do słownika nie wchodzi nic" jest trafna, ale opis `describe`
  bloku (`:232`, „plan.md D7") mógłby dodatkowo wspomnieć ticket 81 — kosmetyka, nie blokuje.
- [ ] `rebuild/frontend/src/pages/atrybuty/PanelPending.tsx:18-24` — nota D7 w nagłówku jest teraz
  dość długa (siedem linii); rozważyć w przyszłości wydzielenie części historycznej do
  `docs/rebuild-backlog.md` i zostawienie w kodzie tylko aktualnego stanu — nie w zakresie tej karty.

## Plan compliance

### Done ✓
- `PanelPending.tsx` — nowa końcówka ostrzeżenia w `OstrzezenieOSkali` (`:65-70`), identyczna w obu
  miejscach użycia (dialog edycji `:386`, dialog aliasu `:424`, wspólny komponent). Znaki cudzysłowów
  „" (U+201E/U+201D) zweryfikowane bajt po bajcie — identyczne w komponencie i teście.
- Nota D7 w nagłówku pliku zaktualizowana: usunięte „⬜ do decyzji" i „nie da się ustalić po fakcie",
  dodane odwołanie do ticketu 74 i backlogu #39 (✅ TAK) — zgodne z rzeczywistym stanem backendu
  (`rebuild/backend/src/historia/mapowanie.ts`: `PRZEPISANIA_Z_KOLEJKI` mapuje obie akcje kolejki na
  `TypWpisu = "edycja"` w `SLOWNIK_AKCJI`, więc twierdzenie „obie akcje pokazują się jako `edycja`"
  jest prawdziwe).
- `api.ts:212, :221` — komentarze `akceptujZEdycja`/`akceptujJakoAlias` zaktualizowane, zgodne ze
  stanem backendu.
- `historia/dane.ts:8-20` — „pięć akcji" → siedem, z rozbiciem na pięć oryginału + dwie odstępstwa
  #39, plus odnośnik do #21 dla akcji niewidocznych — zgodne z `SLOWNIK_AKCJI`.
- Test `atrybuty.pending.test.tsx` — wspólna funkcja `sprawdzTrescOstrzezenia` (`:237-242`) użyta w
  obu dialogach (`:252`, `:265`), sprawdza obecność nowego tekstu i brak starego. Zweryfikowano, że
  test faktycznie łapie regres: stary tekst „Operacji nie da się cofnąć ani odtworzyć..." nie ma
  kropki po „cofnąć", więc `toHaveTextContent("Operacji nie da się cofnąć.")` poprawnie odrzuciłby
  powrót starego brzmienia; `not.toHaveTextContent("nie trafiają do audytu")` łapie dosłowny powrót
  frazy. Dialog aliasu poprawnie skopowany przez `within(dialog)` (`:263`), więc asercja czyta
  ostrzeżenie z właściwego okienka, nie z resztek DOM-u po pierwszym dialogu.
- Komentarz o self-matchu (`:118-129`) zaktualizowany zgodnie z planem — odwołuje się do P7.2
  (ticket 78, #40) i tłumaczy, czemu fixture nadal ma self-match mimo sprzątania w rebuildzie.
- `docs/rebuild-roadmap.md` — wiersz P7.5 ✅ dodany, P7.4 zależy teraz też od P7.5, nota „Dla P7.4"
  zawiera ostateczne brzmienie znak w znak (zweryfikowane bajtowo — identyczne cudzysłowy).
- `docs/rebuild-backlog.md` #39 — dopisane jedno zdanie o zgodności tekstu UI ze śladem, zgodnie
  z planem.
- Grep `bez audytu|nie audytuje|brak audytu|kolejk.*audyt` po całym `rebuild/frontend/src` i `test/`
  nie znalazł innych nieaktualnych miejsc poza tymi dwoma z zakresu karty (nota D7 opisująca stan
  „przed", i negatywna asercja w teście, która ma tam być).
- Zakres plików zgodny z dozwolonym: tylko `PanelPending.tsx`, `api.ts`, `historia/dane.ts`, test,
  `docs/rebuild-roadmap.md`, `docs/rebuild-backlog.md` (wyłącznie #39), `docs/tickets/81-*`. Backend
  i `contract/` nietknięte, zgodnie z deklaracją „Gate kontraktu: N/D".
- Typecheck (`npx tsc --noEmit`) czysty, wskazany test (`atrybuty.pending.test.tsx`) zielony:
  19/19.

### Missing or deviating ✗
Brak — plan zrealizowany 1:1, bez odstępstw.

### Definition of done
- [x] Oba dialogi pokazują nową końcówkę ostrzeżenia, stara nie występuje nigdzie w `rebuild/frontend/src`.
- [x] Test obejmuje ostrzeżenie w obu dialogach (obecność nowego, brak starego tekstu).
- [x] Komentarze z zakresu nie mówią już o braku audytu ani o „pięciu akcjach".
- [x] lint, typecheck, build, test w `rebuild/frontend/` zielone (raport.md: 49 plików/844 testy;
  potwierdzone tu ponownie: typecheck i test docelowego pliku).
- [x] Roadmapa: P7.5 ✅, P7.4 zależy od P7.5, brzmienie w nocie „Dla P7.4"; backlog #39 zaktualizowany.

## Parallel-test concerns

None — all tests parallelizable (komponentowy test Vitest + RTL + MSW, bez współdzielonych
zasobów, portów ani plików tymczasowych).

## Overall assessment

Karta bardzo dobrze wykonana: wąski, jednoznaczny zakres, zmiana tekstu zweryfikowana bajtowo
(identyczne cudzysłowy „" w komponencie, teście i roadmapie), komentarze sprawdzone względem
faktycznego kodu backendu (`PRZEPISANIA_Z_KOLEJKI` → `TypWpisu = "edycja"` dla obu akcji), a test
realnie łapie regres w obu dialogach (zweryfikowano logikę asercji ręcznie na starym tekście).
Brak żadnych blokerów ani spraw do poprawy poza kosmetyką. Można mergować bez zastrzeżeń.
