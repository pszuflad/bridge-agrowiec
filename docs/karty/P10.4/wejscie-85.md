# Wejście dla P10.4 od ticketu 85 (P6.3) · 2026-09-21

**Fakt.** Karta P6.2 (ticket 77) zmieniła Pulpit: kafel „Aktywne alerty" sumuje status `nowy`
z alertów importu I pseudo-alertów katalogowych (przejrzane się nie liczą), a karta „Najnowsze
powiadomienia" ma dwie sekcje, „Import" i „Katalog" (nagłówki wielkimi literami przez CSS), po
najwyżej 5 pozycji; wiersz sekcji prowadzi do właściwej zakładki `/alerty`, kafel i „Zobacz
wszystkie" — na `/alerty` (zakładka Import). Dowód: `rebuild/frontend/src/pages/Pulpit.tsx:154`,
`:167`, `:216`, `:240-271`.

**Co to obala w `docs/instrukcja-testow-I10.md`:**
- §2.3 — „karta pokazuje **alerty importu**" (i przepis na wyprodukowanie ich jako jedyne źródło);
- §3.1, wiersz tabeli „Aktywne alerty" — „liczba alertów o statusie *nowy*" (dziś: suma z obu
  zakładek), i §3.3 — „porównuj z liczbą alertów **nowych** (nierozwiązanych)" — od P6.1 to nie to samo:
  „Nierozwiązane" obejmuje też `przejrzany`, a kafel liczy tylko `nowy`, z obu zakładek;
- §3.4 — „najwyżej pięć wierszy" (dziś: pięć na sekcję) i „kliknięcie dowolnego wiersza prowadzi
  na `/alerty`" (dziś: na właściwą zakładkę);
- §3.5 — „oznacz wszystkie alerty jako rozwiązane → karta znika": na stagingu praktycznie
  nieosiągalne, bo „Brak importu cennika" (krytyczny u prawie każdego dostawcy przy starej bazie)
  wraca co dobę jako `nowy`;
- §6.8 — „Powiadomienia na Pulpicie to alerty IMPORTU … pseudo-alerty czekają na Twoją decyzję".

**Co P10.4 ma z tym zrobić.** Ująć te punkty w rozdziale „co przestało być prawdą" delty I10.
Delta I6 (`docs/instrukcja-testow-I6-v2.md` §2.5 i nota na końcu rozdziału 4) już opisuje nowy
Pulpit i zapowiada Ani poprawioną kartkę I10 — P10.4 może odesłać do §2.5 zamiast powtarzać
scenariusz.
