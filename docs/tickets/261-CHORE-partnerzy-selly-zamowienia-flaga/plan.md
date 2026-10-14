# 261 — PARTNERZY: włączenie flagi „Utwórz w Selly” (krok wdrożenia)

Decyzja użytkowniczki 2026-10-14: „Włącz flagę” (`PARTNERZY_SELLY_ZAMOWIENIA`). Cel: testowe zamówienie w Selly, sprawdzenie mapowania statusu i kontraktu `POST /api/orders`.
Krok `2026-10-14-partnerzy-selly-zamowienia-wlaczone` (tylko produkcja, `kroki/rejestr.ts`): ustawia w `.env` produkcji `PARTNERZY_SELLY_ZAMOWIENIA=true` (`ustawWEnvPliku`, inne linie i sekrety bajt w bajt). Wdrożenie wczytuje `.env` po krokach, więc backend startuje z flagą w tym samym wdrożeniu.
Skutek w działaniu: przycisk „Utwórz w Selly” przy zamówieniu partnera zaczyna ZAPISYWAĆ w żywym sklepie — ale tylko po ręcznym kliknięciu, z podglądem i blokadami (brak statusu Selly, niejednoznaczne mapowanie pozycji, brak e-maila zamawiającego itd.). Flaga jest efektywna wyłącznie przy `SELLY_TRYB=pelny` (`server.ts`); przy innym trybie krok ostrzega w wyniku. Nic nie powstaje automatycznie — tryb automatyczny to osobna decyzja.
Stałe: płatność 10, dostawa 10, VAT 101 (potwierdzone 2026-10-14: ID płatności = 10; wcześniejsze „110” było przejęzyczeniem).
Wymaga od użytkowniczki przed testem: status nowego zamówienia ustawiony przy obu partnerach.
