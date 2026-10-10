# Wpis 215 — szablon CSV cennika partnera

Ticket `215-FEATURE-partnerzy-szablon-csv` (PRT-3.2). `src/partnerzy/plik-csv.ts`: `wczytajKolumny` (z `partner_kolumny`; źródła `katalog|cena|pole`, biała lista pól katalogu)
i `zbudujCsv` (UTF-8, LF, bez BOM; układy `kolumny-krajow` i `plik-na-kraj`; ceny `0.00`; ochrona przed wstrzyknięciem formuły w komórkach tekstowych; pola obliczeniowe
z `formula.ts`). Wiersze bez ceny wypadają zgodnie z układem. Konsument: zapis pliku (PRT-3.4).
