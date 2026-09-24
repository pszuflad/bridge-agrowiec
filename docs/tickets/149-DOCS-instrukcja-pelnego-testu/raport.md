# 149-DOCS-instrukcja-pelnego-testu — raport z wdrożenia

## Summary
Powstał `docs/instrukcja-pelnego-testu.md` — dokument 1 z trzech dla Ani: lista kontrolna całego
systemu przed cutoverem, bez ścieżki krytycznej (ta idzie do TEST.2 i jest odesłana jednym
akapitem). Dokument odsyła do `docs/przeglad-12-widokow.md` zamiast go przepisywać i dokłada
wyłącznie deltę po 22.09 plus dwa ostrzeżenia, bez których Ania zgłosiłaby działające
zabezpieczenia jako usterki.

## Changes
- **Nowy:** `docs/instrukcja-pelnego-testu.md` (300 linii) — warunki środowiskowe, ostrzeżenia
  wstępne, Część 1 (sześć punktów delty w układzie „co zmieniliśmy → polecenie → rezultat"),
  Część 2 (lista kontrolna 14 pozycji), „Czego NIE zgłaszać", „Do Twojej decyzji" (4 pozycje).
- **Nowy:** `docs/tickets/149-DOCS-instrukcja-pelnego-testu/plan.md`

## Deviations from plan
Brak — zakres i układ zgodne z planem, wszystkie decyzje D1–D7 naniesione.

## Test results
- **Gate odbudowy (fixtures/kontrakt): N/D — ticket nie dotyka API.** Zero zmian w `rebuild/`,
  `contract/`, `rebuild/schema/`. `git diff --stat` pokazuje wyłącznie `docs/`.
- **Weryfikacja faktów (odpowiednik gate'u dla ticketu DOCS):** każda etykieta UI cytowana
  z kodu na `develop`, nie z pamięci:
  - filtr i odznaka stagingu — `pages/staging/dane.ts:75-107` („Braki w cenniku", „Brak w cenniku",
    „Nowe produkty (stare)");
  - „Rozstrzygnij" / „Sprawdź kartę" — `pages/staging/polityka.ts:132-133`; trzy gałęzie okna
    i napisy przycisków — `OknoRozstrzygniecia.tsx:214-215, 355, 425-446`;
  - siedem komunikatów blokady + tytuł okna „Nie zapisano zmian" —
    `backend/src/import/polityka/blokady.ts:36-77`, `OknoBlokady.tsx:38`;
  - kolumna „Blokowane formy płatności" i „—" przy MO6 — `katalog/kolumny.ts:94`,
    `katalog/formatowanie.tsx:23-70`;
  - cztery reguły zakładki „Katalog" w alertach — `alerty/silnik-katalogu.ts:159-258`;
  - dwie karty analityki bez przycisku „CSV" — `SekcjaCykluZyciaModeli.tsx:9` i karta P10.5.
- **Warunki środowiskowe:** potwierdzone w `tools/deploy-staging.sh:28,42-45`,
  `rebuild/backend/src/server.ts:140-154`, `config/env.ts:121` oraz audycie stagingu
  `docs/cutover.md:233-299` (8329 produktów, migracje 001–013, `IMPORT_SCHEDULER=true`).
- **Pomiar własny:** `db/snapshot.db` przez `better-sqlite3` — `staging_items` = 3362 pozycje,
  z czego **0** ma `_policyVersion` w `snapshot_json`. Dowód, że blokada nr 3 odrzuci akceptację
  zastanych zgłoszeń.
  ⚠ Liczba 3362 **nie trafiła do dokumentu dla Ani**: migawka ma mtime 2026-08-13, a baza stagingu
  to kopia produkcji z 23.09 — podanie tej liczby jako faktu o jej danych byłoby nieuprawnione.
  W dokumencie jest jakościowe „dużo zgłoszeń sprzed tej zmiany". Tak samo liczby wierszy plików
  CSV opisane są jako zmierzone „na naszych danych testowych".
- Bramki `rebuild/backend/` **nie uruchamiane** — ticket nie dotyka `rebuild/`.

## Breaking changes
Brak.

## Follow-up
1. **`docs/przeglad-12-widokow.md` wymaga poprawki — do koordynatora.** Punkt 8 i pozycja 9 listy
   zbiorczej twierdzą, że plik CSV z Analityki to „dokładnie to, co widać w tabeli — ta sama liczba
   wierszy". Po karcie P10.5 (23.09) to nieprawda dla ośmiu z dziewięciu kart z eksportem.
   TEST.1 prostuje to u siebie jedną linijką; samego przeglądu ta karta nie jest właścicielem.
2. **Opis filtra stagingu w przeglądzie jest nieścisły** (punkt 2): mówi „nowa / zmieniona /
   wycofana", a realne opcje to „Wszystkie / Nowe produkty / Nowe produkty (stare) / Braki
   w cenniku / Zmiany kluczowe / Błędy importu". Do tej samej poprawki co wyżej.
3. **Świadomie pominięte w dokumencie** (za researchem, potwierdzone w backlogu): trzy karty MO8
   wracające do kodu konstrukcji „D" (zbyt niszowe) oraz temat pustej marki/kategorii
   w promocjach — skala zmierzona 0 produktów, karta 14m zdecydowała 2026-09-19 nie opisywać
   tego Ani; ta decyzja nadal obowiązuje.
4. **Pytanie, na które dokument zbiera odpowiedź:** priorytet reguły narzutu wisi bez odpowiedzi
   od 2026-09-19 — trafił do „Do Twojej decyzji" jako pozycja 1.

## Review fixes applied

Review: `docs/tickets/149-DOCS-instrukcja-pelnego-testu/review.md` — 1 BLOCKER, 2 SHOULD-FIX,
1 NICE-TO-HAVE.

**Znalezione i naprawione jeszcze PRZED review (przy własnej kontroli dokumentu):**
- **Kolejność blokad akceptacji.** Dokument podawał komunikat „To zgłoszenie pochodzi ze starego
  importu…" jako jedyny, jaki Ania zobaczy przy zastanych zgłoszeniach. Blokady w
  `rebuild/backend/src/import/polityka/blokady.ts:34-77` sprawdzane są po kolei i pierwsza
  dopasowana wygrywa, więc pozycja typu „wycofana" trafia w blokadę o trzech potwierdzeniach
  (`:53`) ZANIM dojdzie do blokady o starym imporcie (`:58`). Dokument podaje teraz oba komunikaty
  i mówi, od czego zależy, który się pokaże. Review potwierdził to miejsce jako poprawne.
- **Ręczne vs. automatyczne generowanie CSV.** Ostrzeżenie „nie powstanie nowy plik CSV" mogło
  zostać wzięte za awarię przycisku „Wygeneruj CSV teraz", który na stagingu działa. Dopisane
  rozróżnienie.

**BLOCKER — karta TEST.1 nieoznaczona jako zrobiona.** Słuszny; to praca Fazy 5, wykonana po
review (oznaczenie karty ✅, sekcja „Dowiezione", „Do koordynatora", wejścia dla TEST.2 i TEST.3).

**SHOULD-FIX 1 — liczby z nieaktualnej migawki.** Raport deklarował ostrożność wobec
`db/snapshot.db` (mtime 2026-08-13) przy liczbie 3362, ale nie zastosował jej konsekwentnie:
„8 wierszy zamiast 4" (bieżniki) i „9 takich pozycji" (EAN-y w Historii dostępności) pochodzą
z tej samej migawki, a w dokumencie stały jako fakt o danych Ani. Zamienione na opis jakościowy
(„każda para zajmuje dwa wiersze zamiast jednego", „kilka takich pozycji"). Pomiary zostają
w `docs/karty/TEST.1/wejscie-141.md`, gdzie mają swoje zastrzeżenie.

**SHOULD-FIX 2 — niedosłowny cytat komunikatu Selly.** Dokument cytował „tryb wyłączony", którego
w kodzie nie ma; realny tekst to **„Integracja Selly wyłączona na tym środowisku"**
(`rebuild/frontend/src/pages/selly/BladSekcji.tsx:28`). Poprawione w dwóch miejscach, razem z notą,
że sekcje czytające dane lokalne działają przy tym komunikacie normalnie.
⚠ Ten sam niedosłowny cytat jest w `docs/przeglad-12-widokow.md` (punkt 12) — poprawka tamtego
pliku należy do koordynatora, zgłoszona w „Do koordynatora" karty TEST.1.


## Synchronizacja z `develop`

Gałąź scalona z `origin/develop` (`6288066`) — merge **czysty, zero konfliktów**. Z bazy weszło
8 plików, wszystkie w `docs/`: karta `FIX.1`, `docs/karty/I15.9/wejscie-148.md`,
`docs/karty/TEST.2/wejscie-153.md`, `docs/rebuild-backlog/wpis-153.md`, linia w roadmapie
i artefakty ticketów 148/153.

**Bramki `rebuild/backend/` (lint/typecheck/build/test) świadomie NIE uruchamiane — i tu jest
uzasadnienie, bo skrypt synchronizacji zwrócił kod `10` („baza się zmieniła, przebiegnij bramki"):**
zakres tej gałęzi wobec `develop` to **wyłącznie `docs/`** (zweryfikowane:
`git diff --name-only origin/develop...HEAD | grep -v '^docs/'` → pusto), a wszystko, co weszło
z bazy, też jest wyłącznie w `docs/`. Nie ma kodu, który mógłby się wykluczyć — ostrzeżenie skryptu
jest generyczne i dotyczy ticketów dotykających `rebuild/`.

**Kolizja zakresu sprawdzona:** `docs/karty/TEST.2/wejscie-153.md` i karta `FIX.1` (ticket 153)
dotyczą flag zapisanych jako tekst „Tak" gubionych w **eksporcie CSV do Selly** — to ścieżka
krytyczna, czyli TEST.2. Nie wchodzi w zakres tego dokumentu i nie wymaga w nim zmian.

## Docs updates

**`docs/karty/TEST.1/karta.md`** — karta oznaczona `✅ 2026-09-24 · 149-DOCS-instrukcja-pelnego-testu`.
Sekcja „Zakres" przepisana na stan faktyczny: **usunięte** punkty, które ticket obalił (MO9 przez API,
Selly CSV o 6:00 z Torem 1 i 2, „jeden dokument obejmujący cały system") — nie dopisane obok, tylko
poprawione w miejscu. Dodany akapit o odstępstwie od pierwotnego założenia (podział na trzy dokumenty
wg `wejscie-148`, granica D2). Wypełnione „Decyzje" (D1–D7 + ustalenie o kolejności blokad),
„Dowiezione" i „Do koordynatora".

**`docs/karty/TEST.2/wejscie-149.md`** (nowy) — granica „ekran vs. potok" i lista tego, czego TEST.2
może już nie opisywać; ostrzeżenie o zastanych zgłoszeniach w poczekalni wraz z **kolejnością blokad**
(`blokady.ts:34-77` — blokada o trzech potwierdzeniach wyprzedza blokadę o starym imporcie, więc nie
wolno podać Ani jednego komunikatu jako jedynego); ostrzeżenie o czasie masowej akceptacji; fakt,
że `SELLY_CSV_DIR` na stagingu wskazuje katalog testowy.

**`docs/karty/TEST.3/wejscie-149.md`** (nowy) — cztery decyzje, na które dokument 1 zbiera odpowiedź,
i droga powrotna (decyzja użytkownika → wpis w backlogu → `/feature`), żeby nie zginęły w czacie.

**`docs/rebuild-backlog.md` i `docs/rebuild-backlog/`** — bez zmian, świadomie. Ticket niczego nie
implementuje; cztery pytania z „Do Twojej decyzji" trafią do backlogu dopiero po odpowiedzi Ani.
Żaden istniejący wpis nie zmienia statusu przez ten ticket.

**Nietknięte zgodnie z regułami własności:** `docs/rebuild-roadmap.md` (zmienia wyłącznie koordynator),
`docs/przeglad-12-widokow.md` (nie należy do tej karty — trzy poprawki zgłoszone w „Do koordynatora"),
`docs/karty/README.md`, karty innych kart.

### Pre-existing issues
Trzy nieścisłości w `docs/przeglad-12-widokow.md` (plik CSV analityki ≠ tabela po P10.5; opis filtra
stagingu; cytat komunikatu Selly) — zapisane w „Do koordynatora" karty TEST.1, bo ten plik nie należy
do tej karty. Poza tym doc-checker nie znalazł nowych.
