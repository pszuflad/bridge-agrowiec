# 250 — PARTNERZY: podgląd aktualnego kursu NBP w tabeli krajów

Zgłoszenie użytkowniczki 2026-10-13: w „Kraje, narzuty i kursy" kolumna „Używany kurs" pokazywała „NBP — jeszcze nie użyto", więc nie było jak sprawdzić, jaki kurs będzie zaciągnięty.
Zakres: `GET /api/partnerzy/kurs-nbp` (`kursEur` — ten sam mechanizm co generowanie cennika: ostatnio opublikowana tabela A; przy awarii NBP ostatni zapisany kurs + ostrzeżenie; zapisuje kurs w `kursy_nbp`); panel: pasek „Aktualny kurs NBP (tabela A): 1 EUR = X PLN, tabela z DATA" z przyciskiem „Odśwież kurs" nad tabelą krajów oraz w kolumnie „Używany kurs" „NBP teraz: … · jeszcze nie użyto w pliku" / „ostatnio w pliku: …". Wiersze z kursem ręcznym pokazują ręczny. Bez migracji, bez zmiany obliczeń cen.
