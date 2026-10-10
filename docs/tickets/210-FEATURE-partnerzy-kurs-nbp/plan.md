# 210 — kurs EUR partnerów: NBP tabela A albo ręczny (PRT-2.1)

Karta: `docs/karty/PARTNERZY/` · poziom 2 · zależy od 208.

## Zakres
`src/partnerzy/kurs-nbp.ts`: `KlientNbp` (interfejs) + `klientNbpHttp` (`fetch`, limit 10 s), `kursEur(db, klient, ustawieniaKraju)`,
`zapiszUzytyKurs`, `ostatniUzytyKurs`. Migracja `025_kursy_nbp.sql` — rezerwa ostatnich znanych kursów.

## Reguły (z karty)
- Kurs NBP = **ostatnio opublikowana** tabela A (`/api/exchangerates/rates/a/eur/`); w weekend i święta API oddaje ostatnią tabelę, więc osobnej logiki kalendarza nie ma.
- NBP nie odpowiada → **ostatni zapisany kurs + ostrzeżenie** (tekst do logu operacji, PRT-4.2); brak jakiegokolwiek kursu → `BrakKursuError`, nigdy zgadywanie ani 0.
- Kurs ręczny nie dotyka sieci; ręczny bez wartości = błąd.
- Użyty kurs jest zapisywany przy pliku w `partner_kursy` (wołane przez generator, PRT-3.4).

## Zmiana zachowania produkcji
Brak — nowy moduł i pusta tabela; nikt go jeszcze nie woła. Nazw produktów nie dotyka.

## Testy
`test/partnerzy.kurs-nbp.test.ts` — atrapa klienta, nigdy prawdziwy NBP. Bilans migracji: 49 tabel, 25 indeksów.
