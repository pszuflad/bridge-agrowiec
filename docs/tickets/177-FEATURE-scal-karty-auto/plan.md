# 177-FEATURE-scal-karty-auto — scalenie zdublowanych kart AUTO ↔ prawdziwy kod (Etap 1)

> Status: Implemented · Branch: `claude/new-session-wfqwy9` · Źródło: SPEC „Naprawa kolejki stagingu (2026-10-01)”, Etap 1.

## Context
Po zmianie nr 172 oferta dopasowuje się do karty z prawdziwym kodem (R), a karta `MO*_AUTO_<hash>` (A) przestaje być
widoczna w ofercie (stan zamrożony, sklep sprzedaje wg niego) i każda para daje zgłoszenie „Brak starego kodu…” (263 w prod).
Brakowało migracji danych. Etap 2 (ticket 176) wszedł wcześniej, żeby scalone karty nie wracały z błędem „Powrót…”.

## Kontrakt i fixtures
Brak (nie dotyka API) — jednorazowa migracja danych + CLI. Nowa logika, nie port produkcji.

## Decisions (ustalenia użytkowniczki ze speca + decyzje wykonawcze)
- Zostaje karta z prawdziwym kodem; A → archiwum `products_scalone` (pełny JSON + jej poprawki) i znika z `products`.
- Obie w Selly: zostaje wiersz R; wiersz A → `selly_products_scalone`; wariant A ma dostać stan 0 (nie usuwany) — osobnym krokiem
  `--zeruj-selly` (klient wstrzykiwany, blokada `SELLY_TRYB` obowiązuje). Tylko A w Selly: wiersz przepięty na R.
- Dane handlowe R z ostatniego odczytu oferty = kandydat o kodzie R w snapshotcie zgłoszenia karty A. Brak danych → R bez zmian
  (Etap 2 przywróci ją przy następnym imporcie). Status `aktywny` i zdjęcie znacznika wstrzymania TYLKO przy stanie > 0
  (przy 0 usunięcie znacznika zrobiłoby z karty „wstrzymaną ręcznie” — świadome zawężenie względem speca).
- Para niejednoznaczna → `do_recznej`, bez zmian: brak `kod_dostawcy`, brak/kilka R, różny PRAWDZIWY EAN (EAN z `ean_pary`
  nie blokuje), niezgodne cechy (marka/model/rozmiar), kilka A na jedną R.
- Zgodność cech: `zgodnaBezDot` (z tolerancją Etapu 2), nie nowy komparator. Normalizacja modelu (Etap 3) poprawi liczbę par.
- Migracja 018: tabele archiwów. Backup `VACUUM INTO …bak_full_scal_auto_<ts>` robi CLI przed `--apply`.
- Krok 8 speca (`odswiezDostepnosc`, CSV, delta) nie jest wołany z CLI (to proces serwera) — CLI wypisuje instrukcję.
- Zapobieganie nawrotom: kod w `fabryka.ts` po 172/175 nie tworzy już AUTO dla znanego symbolu (przy zgodnych cechach karta jest
  dopasowana po kodzie, DOT zmienia się w miejscu); pokrywa to istniejący test „`2026` vs `2025` (rozłączne)”. Bez zmian w kodzie.

## Implementation plan
`schema/018_scalone_karty_auto.sql`; `src/import/migracje/scal-karty-auto.ts` (plan, raport CSV, apply, zerowanie Selly);
`scripts/scal-karty-auto.ts` + `npm run scal-karty-auto`; testy `test/scal-karty-auto.test.ts`; aktualizacja liczników w testach migracji.

## Out of scope
Uruchomienie na produkcji (wymaga `data-prod.db` i decyzji Anny po raporcie dry-run), Etapy 3 i 4.

## Definition of done
- [x] dry-run (raport CSV) i apply z testami na prawdziwym SQLite; bramki zielone
- [ ] uruchomienie na kopii prod i weryfikacja SQL ze speca — po stronie Anny/wdrożenia
