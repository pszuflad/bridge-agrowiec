# 81-FEATURE-ostrzezenie-kolejki-historia — tekst ostrzeżenia w kolejce atrybutów zgodny ze śladem w Historii (P7.5)

> Status: Approved
> Branch: `feature/81-ostrzezenie-kolejki-historia`
> Worktree: `.worktrees/81-FEATURE-ostrzezenie-kolejki-historia`

## Opis ticketa

Karta P7.5 (Iteracja 7 — Atrybuty). Od P7.1 (ticket 74, PR #90) „Akceptuj z edycją" i alias
zapisują się w `audit_log` i są widoczne w Historii jako wpis typu `edycja` (backlog #39, decyzja
Ani). Ostrzeżenie pokazywane w obu okienkach przed zatwierdzeniem nadal mówi: „Operacji nie da się
cofnąć ani odtworzyć z dziennika — akcje kolejki nie trafiają do audytu." To od P7.1 nieprawda,
a Ania zobaczy to zdanie w scenariuszu, który sprawdza ślad w Historii (P7.4, ticket 79 —
wstrzymana do merge'a tej karty). Mała zmiana, tylko frontend.

## Kontekst

- Ostrzeżenie to komponent `OstrzezenieOSkali` w `rebuild/frontend/src/pages/atrybuty/PanelPending.tsx`
  (`:52-70`), renderowany w dwóch miejscach: dialog „Akceptuj z edycją" (`:386`) i dialog aliasu
  (`:424`). Jedna zmiana tekstu obejmuje oba okienka.
- Oryginał nie ma ani ostrzeżenia (nasz dodatek D7 z ticketu 31), ani audytu kolejki. Zmieniamy
  tekst własnego dodatku, żeby zgadzał się ze świadomym odstępstwem #39. To nie jest odtwarzanie
  zachowania produkcji.
- Co backend faktycznie robi (ticket 74, raport „Jak wpis wygląda w widoku Historii"): wpis `edycja`
  z liczbą przepisanych produktów w kolumnie „Pozycji" i opisem `kolumna: „przed" → „po"`. Brak
  cofania, brak tabeli aliasów. Backend rozpoznaje dla Historii siedem akcji: pięć z oryginału plus
  `atrybut_pending_zaakceptowano_z_edycja` i `atrybut_pending_zaakceptowano_jako_alias`
  (`rebuild/backend/src/historia/mapowanie.ts`, `PRZEPISANIA_Z_KOLEJKI`).
- Grep `audyt|#39|dziennik` po całym `rebuild/frontend/`: nieaktualne wzmianki są wyłącznie
  w miejscach wymienionych w zakresie. Pozostałe trafienia (Dziennik w Konfiguracji, narzuty, pulpit,
  „finalny audyt 12e") są prawdziwe i niezwiązane.
- Test: `test/atrybuty.pending.test.tsx:230-240` sprawdza stary tekst tylko w dialogu edycji. Dialog
  aliasu (`:242-251`) sprawdza wyłącznie zdanie „mapowanie nie jest nigdzie zapisywane", a treści
  ostrzeżenia nie.
- `docs/spec-frontend.md` NIE opisuje ostrzeżenia D7 (grep: brak „przepisze", „uzycie", „audyt"
  w sekcji Atrybutów), więc punkt 4 zakresu nie wymaga zmiany.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

Brak — ticket nie dotyka kontraktu. Zmienia się tekst w UI i komentarze. Żadne wywołanie API,
kształt żądania ani odpowiedzi się nie zmienia; `rebuild/backend/` i `contract/` nietknięte.
Gate kontraktu: N/D.

## Decyzje

- **D1 (użytkownik): nowe brzmienie.** Pierwsze zdanie bez zmian („Zmiana przepisze pole
  <rodzaj> w <N> produktach katalogu."). Końcówka: „Operacji nie da się cofnąć. Zostanie po niej
  wpis w Historii (typ „edycja”)." Nic ponad to, co robi backend.
- **D2: zdanie dialogu aliasu „Do słownika nie trafi nic — mapowanie nie jest nigdzie zapisywane,
  zmieniają się wyłącznie produkty." zostaje.** Jest nadal prawdziwe (nie ma tabeli aliasów, nie ma
  listy aliasów). Wpis w Historii jest śladem zmiany produktów, a nie zapisanym mapowaniem, które
  działałoby przy następnym imporcie. Nie jest w zakresie karty.
- **Odstępstwo od oryginału:** bez zmian względem stanu zastanego. Ostrzeżenie D7 i audyt kolejki
  (#39) to już zatwierdzone odstępstwa; ta karta tylko uzgadnia między nimi tekst.

## Plan implementacji

1. `PanelPending.tsx` — nowa końcówka w `OstrzezenieOSkali`. Nagłówek pliku, nota D7: backend
   od ticketu 74 audytuje obie akcje i pokazuje je w Historii jako `edycja` (backlog #39, ✅ TAK);
   ostrzeżenie pokazuje liczbę PRZED zatwierdzeniem, a toast `produktow_zaktualizowano`. Wyrzucić
   „⬜ do decyzji" i „nie da się ustalić po fakcie".
2. `api.ts:212, :221` — komentarze: obie akcje zostawiają wpis w audycie i Historii (#39, ticket 74).
3. `historia/dane.ts` — „pięć akcji" → siedem: pięć z oryginału plus dwie akcje kolejki
   (backlog #39, ticket 74).
4. `test/atrybuty.pending.test.tsx`:
   - `:118-129` — komentarz o self-matchu: fixture nagrany z produkcji PRZED P7.2 ma self-match;
     w rebuildzie od P7.2 (ticket 78, #40 ✅) sprzątanie kolejki go usuwa, a reguła sugestii go
     nie proponuje. Test czyta fixture, więc 100% zostaje.
   - `:230-240` — asercja odwrócona: jest „Operacji nie da się cofnąć." i „Zostanie po niej wpis
     w Historii (typ „edycja”)."; nie ma „nie trafiają do audytu" ani „odtworzyć z dziennika".
     Nazwa testu zaktualizowana.
   - Dialog aliasu — dopisać tę samą asercję treści ostrzeżenia (dziś nie jest objęta testem).
     Wspólna funkcja pomocnicza, żeby nie duplikować czterech asercji.
5. Docs: roadmapa (wiersz P7.5 ✅, P7.4 „po P7.1–P7.3 i P7.5", ostateczne brzmienie w nocie
   „Dla P7.4"), backlog #39 (jedno zdanie).

## Strategia testów

Test komponentowy (Vitest + RTL + MSW z fixture `GET_atrybuty_pending.json`) dla obu dialogów:
obecność nowego tekstu, brak starego. Bramki `rebuild/frontend/`: lint, typecheck, build, test.

## Poza zakresem

- `docs/instrukcja-testow-I7.md` i delta I7-v2 (P7.4, ticket 79).
- Backend, kontrakt, `docs/spec-frontend.md` (nie opisuje D7, brak zmiany).
- Tekst „mapowanie nie jest nigdzie zapisywane" (D2).

## Definition of done

- [ ] Oba dialogi pokazują nową końcówkę ostrzeżenia, stara nie występuje nigdzie w `rebuild/frontend/src`.
- [ ] Test obejmuje ostrzeżenie w obu dialogach (obecność nowego, brak starego tekstu).
- [ ] Komentarze z zakresu nie mówią już o braku audytu ani o „pięciu akcjach".
- [ ] lint, typecheck, build, test w `rebuild/frontend/` zielone.
- [ ] Roadmapa: P7.5 ✅, P7.4 zależy od P7.5, brzmienie w nocie „Dla P7.4"; backlog #39 zaktualizowany.
