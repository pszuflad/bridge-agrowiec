# Wejście dla I15.4 od ticketu 110 (koordynator, triaż 22.09 wieczór) · 2026-09-22

⚠ Produkcja dołożyła 22.09 dwie duże zmiany (backlog **#103** „braki w cenniku / bezpieczeństwo źródła”
i **#104** „dostępność: brak = wstrzymany/0”), commity `3f00533` i `abe5f14`. Źródło prawdy dla całego I15 to
teraz **`origin/main` na `abe5f14`**, nie `7d6cfc9`. Poniżej zakres, który dochodzi do tej karty.

**Karta mocno rośnie — to teraz najcięższa karta I15.** Do portu `staging_policy.cjs` dochodzą dwie warstwy:

**(z #103) bezpieczeństwo źródła i koniec fałszywych wycofań** (`staging_policy.cjs` 298 → 407 l.):
- wycofanie pozycji wymaga **trzech różnych kompletnych ofert** i **minimum 24 h** między potwierdzeniami;
- blokada źródła: puste, błędne, **mniejsze o ponad 20%** lub masowo nierozpoznane — import się zatrzymuje;
- „wstrzymane/0 nie wracają”; stare karty bez stabilnego oznaczenia i możliwe zmiany kodów → osobne **zablokowane
  zgłoszenia do sprawdzenia**; bezpieczne dopasowanie wielkości liter i jednoznacznego kodu dostawcy; ochrona DEMO
  i wariantów; podobne cechy z innym EAN → decyzja użytkownika;
- silnik konsumuje `_bridgeFeedMeta` z `feed_safety` (moduł portuje I15.2);
- `extensions.cjs`: „jeden scheduler (rdzeń), wyłączony drugi” — SPRAWDŹ, czy dotyczy odbudowy (mamy jeden), i opisz.

**(z #104) dostępność** (`staging_policy.cjs` 407 → 488 l.):
- brak produktu w poprawnej **pełnej** ofercie → natychmiast `wstrzymany` i stan 0;
- tabela **`product_auto_suspensions`** odróżnia automatyczne wstrzymanie od ręcznego; pewny powrót przywraca
  aktywność i bieżący stan; błędy i zmiany wymagają decyzji; **ręczne wstrzymania chronione**;
- zmiana dostępności ma uruchamiać odświeżenie CSV i Selly delta — **punkt wpięcia** dla karty I15.10
  (`availability_sync`): wystaw go jawnie, samego modułu nie portuj.

**Migracja 012 obejmuje teraz cztery nowe tabele** (poza `staging_matches` i indeksem unikalnym z Staging v2):
`supplier_feed_state`, `supplier_feed_versions`, `product_absence_checks`, `product_auto_suspensions` — definicje
bajt w bajt z `git show abe5f14:db/schema.sql`. Idempotentnie (na produkcji już istnieją).
