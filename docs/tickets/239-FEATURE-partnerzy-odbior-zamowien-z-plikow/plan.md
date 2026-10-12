# 239 — PARTNERZY: odbiór zamówień z plików XML na serwerze plików

Decyzje użytkowniczki 2026-10-12 (odp. 3, 4, 30, 35): zamówienia wrzucane przez partnerów do `…/customer/orders/` (nazwy plików nadają partnerzy), po imporcie plik ląduje w `done/`; przyjmujemy wszystko, handlowiec weryfikuje. Odczyt serwera: katalog zapisywalny dla procesu Bridge, ten sam VPS.

Zakres: `partnerzy/odbior-plikow.ts` — ta sama ścieżka co e-mail (`zapiszZamowienie` + informacyjna `zwaliduj`), plik → `done/` (błędny → `done/BLAD_<nazwa>`), pliki młodsze niż 30 s pomijane, limit rozmiaru przed odczytem, wyjątek infrastruktury zostawia plik. Harmonogram `PARTNERZY_ODBIOR_PLIKOW` (domyślnie wyłączony), co `PARTNERZY_ODBIOR_PLIKOW_MINUTY` (5), katalogi z `PARTNERZY_KATALOGI_ZAMOWIEN` (`Nazwa=/…/customer/orders;…`, tylko `.env` produkcji). Błędna wartość mapowania nie przewraca backendu.

Poza zakresem: ręczny przycisk „odbierz z plików" w panelu, katalog zamówień TyreWorld (nieznany — brak folderu `customer` w odczycie), Selly, tracking.
