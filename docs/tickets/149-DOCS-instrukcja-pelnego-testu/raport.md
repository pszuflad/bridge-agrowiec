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
