# Wpis 210 — kurs EUR partnerów (NBP / ręczny)

Ticket `210-FEATURE-partnerzy-kurs-nbp` (PRT-2.1). Nowy moduł `src/partnerzy/kurs-nbp.ts`, tabela `kursy_nbp` (migracja 025).
`kursEur` zwraca `{kurs, zrodlo: reczny|nbp|nbp-zapisany, dataTabeli, ostrzezenie}`. Pobranie z NBP zapisuje kurs (klucz = data tabeli);
przy awarii NBP używany jest ostatni zapisany z ostrzeżeniem, a bez zapisu — `BrakKursuError`. Klient HTTP jest wstrzykiwany (testy bez sieci).
Użyty kurs zapisuje `zapiszUzytyKurs` do `partner_kursy`. Nikt jeszcze tego nie woła — konsumentem będzie kalkulator (PRT-2.4) i generator (PRT-3.4).
