# Wpis 222 — magazyny katalogu dla panelu partnera

Ticket `222-FEATURE-partnerzy-panel-konfiguracja` (PRT-5.2). Nowa trasa `GET /api/partnerzy/magazyny` → `{magazyny: [{magazyn, liczbaPozycji}]}` — magazyny aktywnych pozycji katalogu
(`products.status='aktywny'`) z liczbą pozycji, posortowane; służy do wyboru magazynów partnera w panelu. Zarejestrowana PRZED `/api/partnerzy/:id`, inaczej „magazyny” byłoby wzięte za id.
