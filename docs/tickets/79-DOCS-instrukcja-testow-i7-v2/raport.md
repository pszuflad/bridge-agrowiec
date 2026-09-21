# 79-DOCS-instrukcja-testow-i7-v2 — Implementation report

## Summary

Powstała delta `docs/instrukcja-testow-I7-v2.md` dla Ani w układzie „Zdecydowałaś → Jest teraz →
Sprawdź” dla czterech odpowiedzi 7.1–7.4. Przy 7.4 jest sprostowanie z pytaniem doprecyzowującym.
Do tego rozdział „Przy okazji” (niezmiennik P7.3, kolumna „Wystąpień” a ostrzeżenie, seed
akceptujący marki i bieżniki przy starcie) i tabela zdań z pierwszej wersji, które przestały być
prawdą. Pierwsza wersja dostała banner. Iteracja 7 jest zamknięta w roadmapie, a dwa pytania do
Ani są zapisane jako otwarte.

## Changes

- **Nowy:** `docs/instrukcja-testow-I7-v2.md`:
  - r. 1 — 1.1 ślad w Historii z przygotowaniem pozycji `307`, 1.2 self-matche, 1.3 wielkość liter,
    1.4 sprostowanie „model”/„zastosowanie” z pytaniem (a)–(d);
  - r. 2 — 2.1 niezmiennik P7.3, 2.2 kolumna a ostrzeżenie, 2.3 seed przy starcie z pytaniem;
  - r. 3 — 15 unieważnionych zdań, a §4 pkt 4 osobno jako nieprawdziwy od początku;
  - r. 4 — podsumowanie, r. 5 — jak zgłosić.
- `docs/instrukcja-testow-I7.md` — tylko banner „częściowo nieaktualne” na górze.
- `docs/rebuild-roadmap.md`:
  - w bloku „Iteracja 7 — Atrybuty”: wiersz P7.4 ✅, akapit „Iteracja 7 ZAMKNIĘTA” z ustaleniami
    i tabela „Otwarte po stronie Ani”;
  - w nagłówku planu P zdanie „po jej stronie nie ma otwartych spraw” poprawione o te dwa
    pytania.
- `docs/rebuild-backlog.md` #41 — akapit o sprostowaniu i pytaniu (data, odnośnik do I7-v2).
- `docs/tickets/79-DOCS-instrukcja-testow-i7-v2/` — plan, raport, review.

## Deviations from plan

- **Przerwa na kartę P7.5 (ticket 81).** Po pierwszym przebiegu okazało się, że ostrzeżenie w
  okienkach kolejki nadal mówiło „akcje kolejki nie trafiają do audytu”. Decyzja użytkownika:
  najpierw karta FE, potem instrukcja. Instrukcja cytuje brzmienie z noty roadmapy po P7.5,
  sprawdzone znak w znak z `PanelPending.tsx` na develop.
- **Drugie pytanie do Ani (pkt 2.3), którego prompt nie przewidywał.** Raport 78 (Follow-up) wskazał,
  że seed przy starcie „akceptuje” marki i bieżniki z produktów, więc nowe pozycje tych rodzajów
  znikają z kolejki po restarcie, i że to wymaga decyzji Ani. Prompt kazał opisać „cokolwiek innego,
  co raporty wskazały jako widoczne”, więc opis wszedł, a razem z nim pole odpowiedzi. Pytanie jest
  zapisane w roadmapie obok pytania 7.4. W backlogu nie ma nowego wpisu, bo zakres plików pozwalał
  ruszyć tylko #41.
- **Dodatkowe sprostowanie przy 7.2.** Pytanie 7.2 podawało jako przyczynę „słownik zasiany z nazw
  modeli”. Pomiar P7.3/P7.2 pokazał, że z tego źródła brało się najwyżej 72 z 437 self-matchy.
  Delta mówi to wprost jednym akapitem.
- Stan karty zapisany w roadmapie (okres przejściowy z `docs/karty/README.md`), bez
  `docs/karty/P7.4/karta.md` (decyzja 3 w planie).

## Test results

- **Gate odbudowy (fixtures/kontrakt):** N/D. Ticket DOCS nie dotyka API ani kontraktu.
- **Weryfikacja twierdzeń z kodem (develop @ 3695820 + merge):**
  - ostrzeżenie: `PanelPending.tsx:66-68`;
  - okienka i komunikaty: `PanelPending.tsx:108`, `:129`, `:143`, `:369`, `:414-424`;
  - filtr „Rodzaj” pokazuje surowe klucze rodzaju: `:222-226`;
  - wpis w Historii: `historia/mapowanie.ts:77-80`, `:200-217`;
  - wyszukiwarka bez wielkości liter: `:329-338`;
  - render: `TabelaHistorii.tsx:80-97`;
  - filtr „Edycje”: `historia/dane.ts:52`;
  - audyt sześciu tras: `routes/atrybuty.ts:299-515`;
  - skan przy akceptacji stagingu bez audytu: `routes/staging-mutacje.ts:195-199`;
  - „Akceptuj zaznaczone (N)”: `Staging.tsx:234`;
  - widok dziennika: `konfiguracja/zakladki.ts` („Dziennik”).
- **Pomiary na `db/snapshot.db` (read-only):**
  - na 61 pozycjach kolejki spoza słownika każda ma 0 produktów na żywo po migracji 004;
  - `307` jest w słowniku `bieznik`, ma 3 produkty (MO2, ALLIANCE) i nie jest odrzucony;
  - w stagingu jest 3362 pozycji do zatwierdzenia;
  - `model` ma 1670 różnych wartości w katalogu, z czego 199 poza słownikiem.
- Unit / integracja / E2E: nie dotyczy (DOCS).

## Breaking changes

Brak.

## Follow-up

- **Backlog #42, wiersz „Status”** nadal odsyła do I7 §4 pkt 2 jako „sprostowanie: P7.4,
  follow-up”. Sprostowanie jest już w I7-v2 pkt 1.3 i 3.1. Zakres tego ticketa pozwalał ruszyć tylko
  #41, więc odnośnik zostaje do najbliższej sesji porządkującej backlog. To samo dotyczy #39 i #40,
  jeśli mają podobne odsyłacze.
- **Pytanie 2.3 (seed przy starcie)**: po odpowiedzi Ani „nie” trzeba założyć nowy wpis backlogu.
- **Pytanie 1.4 (c)**: po odpowiedzi Ani trzeba założyć nowy wpis backlogu (zmiana `ZAKRES_SKANU`).

## Review fixes applied

Review (1 iteracja): 0 BLOCKER, 1 SHOULD-FIX, 1 NICE-TO-HAVE. Oba poprawione.
- SHOULD-FIX: w tabeli 3.1 doszedł wiersz „§1 Sedno do sprawdzenia, pkt 3” („wartości wrócą przy
  następnym imporcie”). To samo zdanie z §2 było już unieważnione, a dla dzisiejszych 61 pozycji
  obie obietnice są nieprawdziwe (pkt 2.2).
- NICE-TO-HAVE: urwane cytaty w wierszach §4 pkt 2 i §4 pkt 7 dostały znacznik „(…)”, tak jak
  sąsiednie wiersze.

## Docs updates

Zrobione w samym tickecie, w zakresie plików narzuconym przez prompt: roadmapa (blok Iteracji 7
i jedno zdanie w nagłówku planu P), backlog #41, banner w I7. Doc-checkerów nie uruchamiano, bo
prompt zabraniał zmian poza tą listą. Pre-existing: nieaktualny odsyłacz w backlogu #42 (Follow-up).
