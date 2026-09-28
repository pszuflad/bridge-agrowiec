# Wejście dla I15.9 od ticketu 148 (koordynator) · 2026-09-24 — dwa sprostowania do karty

## 1. Commit zamrożenia to `88fa31c`, nie `7d6cfc9`

Sekcja „Decyzje" w `karta.md` mówi o `7d6cfc9`. To już nieaktualne: po ustaleniu zamrożenia (22.09)
Ania pracowała jeszcze 23.09 od 07:44 do 12:57 i zakres I15 domknął się na **`88fa31c` (23.09 13:00)**.
Źródło bieżące: `docs/triage-state.txt` — tam jest pełny SHA ostatnio striażowanego commita i rozliczenie
zakresu (4 commity z kodem → backlog #105, #106, #107). Późniejsze commity na `main` to regeneracje
`sellycsv-*.csv` co godzinę, czyli dane, nie zmiana zachowania.

Przed pisaniem instrukcji zrób `/triaz-zmian` — jeśli doszedł nowy commit z kodem, **zgłoś użytkownikowi**,
zamiast po cichu dopisywać go do zakresu.

## 2. Nie powielaj trzech dokumentów TEST

Od 148 (decyzja użytkownika 2026-09-24) Ania dostaje trzy dokumenty: `instrukcja-pelnego-testu.md`
(cały system, TEST.1), `instrukcja-testu-sciezki-krytycznej.md` (import → parsery → baza → CSV → Selly,
TEST.2) i `instrukcja-pracy-dla-ani.md` (zgłaszanie uwag przez `/feature`, TEST.3).

**I15.9 zostaje tym, czym było: DELTĄ.** Odpowiada na pytanie „co z tego, co wdrożyłaś na produkcji
we wrześniu, jest już w nowym Bridge i jak to zobaczyć" — a nie „jak przetestować system". Scenariuszy
z TEST.2 nie przepisuj; gdzie się pokrywają (MO9, Staging v2, CSV), **odeślij** do tamtego dokumentu
i zostaw u siebie samo „jest teraz tak, sprawdź w tym miejscu".

Kolejność dla Ani: najpierw delta (co nowego), potem ścieżka krytyczna, potem reszta systemu.
