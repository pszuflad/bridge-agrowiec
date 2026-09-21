# 79-DOCS-instrukcja-testow-i7-v2 — delta instrukcji testów Atrybutów dla Ani (P7.4)

> Status: Approved (2026-09-21, po merge'u P7.5 — decyzja 1 zrealizowana)
> Branch: `docs/79-instrukcja-testow-i7-v2`
> Worktree: `.worktrees/79-DOCS-instrukcja-testow-i7-v2`

## Ticket description

P7.4 — delta instrukcji testów Iteracji 7 (Atrybuty) dla Ani: `docs/instrukcja-testow-I7-v2.md`,
banner w `docs/instrukcja-testow-I7.md`, roadmapa (P7.4 zrobione, Iteracja 7 zamknięta, pytanie
7.4 otwarte po stronie Ani), backlog #41 (sprostowanie + pytanie). Pełny prompt: wiadomość
użytkownika z 2026-09-21 (format delta, układ „Zdecydowałaś → Jest teraz → Sprawdź”).

## Warunek startu — spełniony 2026-09-21

- P7.1: ticket 74, PR #90, zmergowany 2026-09-21.
- P7.2: ticket 78, PR #91, zmergowany 2026-09-21.
- P7.3: ticket 75, PR #89, zmergowany 2026-09-21.

## Ustalenia z kodu i danych (develop @ 37c1b86), których raporty kart nie opisują

1. **[ROZWIĄZANE przez P7.5, ticket 81, PR #96 — NIE CYTOWAĆ zdania niżej; ostateczne brzmienie:
   roadmapa, nota „Dla P7.4 — ostateczne brzmienie ostrzeżenia”.]** Tekst ostrzeżenia we froncie
   kłamał po P7.1.
   `rebuild/frontend/src/pages/atrybuty/PanelPending.tsx:65-67` (`OstrzezenieOSkali`, wspólny dla
   „Akceptuj z edycją” i aliasu): *„Operacji nie da się cofnąć ani odtworzyć z dziennika — akcje
   kolejki nie trafiają do audytu.”* Od P7.1 obie akcje trafiają do dziennika i do Historii.
   Nieaktualne są też komentarze w nagłówku tego pliku (`:18-22`) i w `api.ts:212`. Raport P7.1
   wymienił tylko komentarze, a zdania widocznego na ekranie nie.
2. **Po P7.2 każda pozycja kolejki na kopii produkcji ma 0 produktów na żywo.** Pomiar na
   `db/snapshot.db` (read-only): 61 pozycji spoza słownika (54 `bieznik`, 7 `kategoria`). Dla
   57 z nich `COUNT(*) WHERE <kol> = wartosc` = 0 już w surowym snapshocie. Pozostałe 4 to
   `kategoria` małą literą (`rolnicze` 334, `ciężarowe` 106, `przemysłowe` 90, `leśne` 7), które
   migracja `004_kategoria_wielka_litera.sql` przepisuje na Wielką literę, więc po migracjach
   też 0. Kolumna „Wystąpień” to migawka ze skanu (`ile_wystapien`), a ostrzeżenie w okienku
   liczy na żywo (`GET /api/atrybuty/uzycie`). Na stagingu każda pozycja pokaże więc w kolumnie
   liczbę > 0, a w ostrzeżeniu 0. Przykłady: „rolnicze” 334 → 0, „CONTI ECO 5” 9 → 0.
   Skutek dla sugestii z P7.2: alias „rolnicze → Rolnicze (100%)” przepisze 0 produktów.
   Po pierwszym skanie dochodzą 2 pozycje `konstrukcja` (skutek migracji 005).
3. **Wygląd wpisu w Historii** (`historia/mapowanie.ts:200-217`, `TabelaHistorii.tsx:80-97`):
   Typ `edycja`, Dostawca „—”, Pozycji = `produktow_zaktualizowano`, Szczegóły: pogrubione
   `<kolumna>: „<z>” → „<na>”`, pod spodem `<kolumna> (edycja z kolejki)` albo
   `(alias z kolejki)`. Wyszukiwarka przeszukuje cały wpis bez względu na wielkość liter
   (`mapowanie.ts:325-338`), więc działają „kolejka”, „kolejki”, „alias”, a także wartość.
   Filtr „Edycje” obejmuje oba warianty. Wpis powstaje także przy 0 przepisanych
   (`routes/atrybuty.ts:388`, `:445`, bez warunku na liczbę).
4. Akceptuj, Odrzuć, Wyczyść i skan ręczny zapisują się w dzienniku, ale w Historii ich nie
   widać. Skan wołany przez akceptację stagingu nie zapisuje się nigdzie (`routes/atrybuty.ts:497`).
5. Sprzątanie kolejki z P7.2 jest bez migracji: działa przy starcie procesu i na końcu każdego
   skanu (`app.ts`, `usunZKolejkiObecneWSlowniku`).

## Decisions (użytkownik, 2026-09-21)

1. **Tekst ostrzeżenia: najpierw mała karta FE, potem P7.4.** P7.4 czeka, aż zdanie
   z ustalenia 1 zostanie poprawione we froncie i zmergowane. Instrukcja ma opisać ostateczny
   tekst, a nie uprzedzać o nieaktualnym. **Zrealizowane:** karta P7.5 (ticket 81, PR #96),
   zmergowana 2026-09-21; nowe brzmienie potwierdzone w `PanelPending.tsx:66-68` na develop.
2. **Scenariusz 7.1: Ania przygotowuje wartość z realną liczbą produktów.** Usuwa ze słownika
   rzadko używany bieżnik (kandydaci na snapshocie: „307” ×3; „2 ECO”, „202”, „221” ×2),
   zatwierdza dowolny import w Stagingu (skan), wartość wraca do kolejki z liczbą N, potem
   „Edytuj” → wpis w Historii z „Pozycji: N” = ostrzeżenie = toast. Uprzedzić: między krokami
   nie może być restartu (seed dosypałby bieżnik z powrotem do słownika i sprzątanie zdjęłoby
   pozycję z kolejki). Kandydat potwierdzony na snapshocie: „307” jest w słowniku `bieznik`,
   3 produkty (MO2, ALLIANCE), nie ma go wśród odrzuconych; w Stagingu jest 3362 pozycji do
   zatwierdzenia, więc krok „zatwierdź jedną pozycję” jest wykonalny.
3. **Stan karty zapisywany po staremu, w roadmapie** (okres przejściowy z `docs/karty/README.md`;
   worktree 79 powstał przed ticketem 82; P7.4 zamyka Iterację 7 i idzie sama). Bez
   `docs/karty/P7.4/karta.md`. Ustalenia dla przyszłych kart — jako `docs/karty/<ID>/wejscie-79.md`.

## Implementation plan (po odblokowaniu)

1. `docs/instrukcja-testow-I7-v2.md` wzorem I4-v2/I5-v2:
   - Po co ta kartka;
   - r. 1 „Zdecydowałaś → Jest teraz → Sprawdź” dla 7.1–7.3;
   - 7.4 jako sprostowanie z polem odpowiedzi;
   - r. 2 „Przy okazji”: P7.3 niezmiennik, kolumna vs ostrzeżenie (ustalenie 2), krótsza kolejka,
     marki i bieżniki znikają po restarcie, sugestie małymi literami i 91%;
   - r. 3 „Co w pierwszej wersji przestało być prawdą”: §1, §2, §3.9, §3.11, §3.12, §4 pkt 1, 2,
     4 (nieprawdziwe od początku), 7 i 8, §5, §6, §7;
   - podsumowanie, jak zgłosić.
2. Banner w `docs/instrukcja-testow-I7.md`.
3. Roadmapa P7.4 ✅, Iteracja 7 zamknięta, pytanie 7.4 otwarte po stronie Ani. Backlog #41.
4. Review twierdzeń z kodem na develop (już po merge'u karty FE).

## Kontrakt i fixtures

Brak (DOCS, nie dotyka kontraktu).

## Out of scope

Zmiany w `rebuild/` i `contract/`, w tym poprawka tekstu ostrzeżenia, która idzie osobną kartą.
Instrukcja I5-v2 pozostaje bez zmian.
