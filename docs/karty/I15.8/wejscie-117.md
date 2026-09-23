# Wejście dla I15.8 od ticketu 117 (koordynator) · 2026-09-23 — decyzja użytkownika: zamykamy osierocone wpisy logu

**Decyzja użytkownika 2026-09-23 (zgodnie z rekomendacją):** przy starcie harmonogramu **zamykamy wpisy
`selly_sync_log` ze statusem `w_trakcie`**, które zostały po restarcie procesu (produkcja tego nie robi —
u Ani wpis MO2 wisi od 10.09). To **świadome odstępstwo**: czysta diagnostyka, nic nie zmienia w sklepie
ani w danych katalogu.

Wykonanie: przy montażu harmonogramu oznacz zastane `w_trakcie` jako przerwane (osobny status albo `blad`
z czytelnym powodem — wybierz i uzasadnij w planie), tak żeby `GET /api/selly/sync-status` nie pokazywał
wiecznie trwającego cyklu. Dopisz test. Opisz odstępstwo w karcie i w nagłówku kodu.
