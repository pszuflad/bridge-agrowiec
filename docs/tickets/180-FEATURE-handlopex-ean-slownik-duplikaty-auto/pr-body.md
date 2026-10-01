Ticket 180 — dokończenie SPEC „Naprawa kolejki stagingu” (decyzje Ani 2026-10-01):

- EAN Handlopexu (MO4/MO5): sufiks partii (`…DO`, `…_D`, `…W2`) zdejmowany, numer ze złą cyfrą kontrolną prawidłowy (`ean-dostawcy.ts`).
- Słownik zapisu modeli producenta (Trelleborg, Cultor, Mitas, LingLong) — bez łączenia KLT200/KLS200/KLD200/KTD300.
- `scal-karty-auto`: grupy kilku kart AUTO → scalana karta z oferty, duplikaty ze stanem 0 usuwane z Bridge i (nowa flaga `--usun-duplikaty-selly`) z Selly; para bez oferty bierze stan z karty A.
- Selly: `deleteVariant`, `deleteProduct`; migracja 020.

Raport: `docs/tickets/180-FEATURE-handlopex-ean-slownik-duplikaty-auto/raport.md`. Bramki zielone (2080 testów).
