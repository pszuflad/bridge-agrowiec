# Wpis 212 — transport GEIS dla partnerów

Ticket `212-FEATURE-partnerzy-transport-geis` (PRT-2.2). Tabele `geis_kraje`/`geis_stawki` (migracja 026), `src/partnerzy/transport.ts`:
`wagaRozliczeniowa`, `kosztPrzesylki(db, kraj, paczka, data)`, `paliwoNaDzien`/`ustawPaliwo` (`paliwo_historia`, procent), `importujTabeleGeis`.
Koszt = stawka progu × (1 + paliwo%) + pakowanie; błędy danych to `BladTransportu`, nie zero. Dane wgrywa `npm run importuj-geis` z JSON-a
(plik xlsx z kartą nie jest w repo). Konsument: kalkulator ceny (PRT-2.4).
