# Wpis 216 — szablon XML cennika partnera

Ticket `216-FEATURE-partnerzy-szablon-xml` (PRT-3.3). `src/partnerzy/plik-xml.ts`: `zbudujXml` — XML w stylu Ceneo (`offers/group/o`, `price` z ceny kraju, `<attrs>` z pozostałych kolumn),
układ plik-na-kraj, tekst escapowany, wiersze bez ceny wypadają. Struktura ustalona na podstawie publicznego formatu Ceneo (nie ma wzorca od partnera). Konsument: zapis pliku (PRT-3.4).
