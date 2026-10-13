# Wpis 250 — podgląd kursu NBP

`GET /api/partnerzy/kurs-nbp` (requireAuth; MUSI stać przed `/api/partnerzy/:id`) → `{kurs, zrodlo: "nbp"|"nbp-zapisany", dataTabeli, ostrzezenie}`; 502 bez żadnego kursu, 503 bez klienta NBP. Woła `kursEur` z ustawieniami `nbp`, więc zapisuje kurs w `kursy_nbp` (ten sam wpis zasila `exchange_rate` zamówień Selly, ticket 249). Zależność `klientNbp` w `trasyPartnerzy`/`stworzApp` (ta sama instancja co w serwisie partnerów).
