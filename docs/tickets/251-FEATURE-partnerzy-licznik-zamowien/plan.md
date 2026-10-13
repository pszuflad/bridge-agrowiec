# 251 — PARTNERZY: licznik zamówień

Prośba użytkowniczki 2026-10-13 („dodaj licznik zamówień"), w odpowiedzi na pytanie, czy dostanie komunikat o błędzie zamówienia: dotąd trzeba było wejść w zakładkę zamówień partnera.
Zakres: `GET /api/partnerzy` zwraca przy każdym partnerze `zamowienia: {lacznie, nowe, doSelly, bledy, wBlokadzie, wyslane}` (jedno zapytanie grupujące po partnerze i statusie; `doSelly` = `przyjete`, `bledy` = `blad_importu`, `wBlokadzie` = `wysylanie`). Panel `/partnerzy`: kolumna „Zamówienia" (łącznie + plakietki: z błędem, zablokowane — na czerwono; do Selly; nowe) i linia podsumowania nad tabelą („N łącznie · M wymaga uwagi · K do utworzenia w Selly").
Poza zakresem: powiadomienia e-mail/push i licznik na pulpicie (osobna decyzja). Bez migracji, bez zmian w zapisie.
