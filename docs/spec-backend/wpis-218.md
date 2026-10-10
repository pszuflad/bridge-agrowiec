# Wpis 218 — test zgodności cenników partnerów

Ticket `218-FEATURE-partnerzy-test-zgodnosci` (PRT-3.5). `wybierzPozycje` pomija pozycje z pustym numerem katalogowym (`pominiete.bezKodu`). Test `partnerzy.zgodnosc.test.ts` odtwarza
na danych syntetycznych układ plików TyreWorld i Adtyres oraz defekty z karty i sprawdza, że generator ich nie powtarza oraz że oba układy dają tę samą cenę dla tej samej pozycji.
Prawdziwych plików wzorcowych brak w repo — porównanie liczbowe czeka na ich dostarczenie.
