# 81-FEATURE-ostrzezenie-kolejki-historia — raport z implementacji

## Podsumowanie

Ostrzeżenie o skali zmiany w okienkach „Akceptuj z edycją” i „Akceptuj jako alias” mówi teraz
o wpisie w Historii zamiast o braku audytu. Od P7.1 (ticket 74) stare zdanie było nieprawdziwe.
Test sprawdza teraz treść ostrzeżenia w obu okienkach, wcześniej sprawdzał ją tylko w jednym.
Poprawione są też komentarze, które od ticketów 74 i 78 opisywały stan nieaktualny.

Brzmienie po zmianie: „Zmiana przepisze pole <rodzaj> w <N> produktach katalogu. Operacji nie da
się cofnąć. Zostanie po niej wpis w Historii (typ „edycja”).”

## Zmiany

- `rebuild/frontend/src/pages/atrybuty/PanelPending.tsx` — nowa końcówka tekstu w `OstrzezenieOSkali`
  (jedno miejsce, oba okienka). Nota D7 w nagłówku mówi teraz o audycie od ticketu 74 (#39 ✅) i o tym,
  że produkcja nie ma ani ostrzeżenia, ani audytu.
- `rebuild/frontend/src/pages/atrybuty/api.ts` — komentarze `akceptujZEdycja` i `akceptujJakoAlias`:
  „zostawia wpis `edycja` w Historii” zamiast „bez audytu”.
- `rebuild/frontend/src/pages/historia/dane.ts` — „pięć akcji” zmienione na siedem: pięć z produkcji
  plus dwie akcje kolejki (#39), z odnośnikiem do #21 przy akcjach niewidocznych.
- `rebuild/frontend/test/atrybuty.pending.test.tsx` — w obu okienkach test wymaga nowego tekstu
  i sprawdza, że stary nie występuje (funkcja pomocnicza `sprawdzTrescOstrzezenia`). Okienko aliasu
  nie było dotąd objęte tym sprawdzeniem, teraz jest, łącznie z licznikiem 186. Komentarz
  o self-matchu w fixture opisuje stan po P7.2 (ticket 78, #40).
- `docs/rebuild-roadmap.md` — dodany wiersz P7.5 ✅, P7.4 czeka teraz także na P7.5, a nota „Dla P7.4”
  zawiera ostateczne brzmienie.
- `docs/rebuild-backlog.md` — w #39 jedno zdanie o zgodności tekstu UI ze śladem.

## Odstępstwa od planu

Brak. Grep `audyt|#39|dziennik` po `rebuild/frontend/` nie znalazł innych nieaktualnych miejsc.
`docs/spec-frontend.md` nie opisuje ostrzeżenia D7, więc nie było w nim czego poprawiać (pkt 4
zakresu).

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt):** N/D. Ticket nie dotyka API: zmienił się tylko tekst w UI
  i komentarze. Żadne wywołanie, żądanie ani odpowiedź się nie zmienia, a `rebuild/backend/`
  i `contract/` są nietknięte.
- Frontend (Node 20.20.2, `rebuild/frontend/`): lint ✓, typecheck ✓, build ✓,
  test ✓ (49 plików / 844 testy, w tym `atrybuty.pending.test.tsx` 19/19).
- E2E: nie dotyczy.

## Zmiany łamiące

Brak. Zmienia się tylko tekst widoczny dla Ani, co jest celem karty.

## Follow-up

- **P7.4 (ticket 79):** delta instrukcji I7-v2 może już cytować brzmienie z noty „Dla P7.4” w roadmapie.
  Karta była wstrzymana do merge'a tej karty.
