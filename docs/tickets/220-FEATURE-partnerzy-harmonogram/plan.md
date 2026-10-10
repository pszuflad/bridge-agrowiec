# 220 — harmonogram generowania cenników partnerów (PRT-4.1)

Karta: `docs/karty/PARTNERZY/` · poziom 4 · zależy od 217, 219.

## Zakres
`src/partnerzy/scheduler.ts`: `stworzSerwisPartnerow({db, klientNbp, katalogBazowy})` → `{generujTeraz, tick, uruchom, zatrzymaj}`; trasa `POST /api/partnerzy/:id/generuj`;
wpięcie w `server.ts`/`app.ts`; env `PARTNERZY_SCHEDULER`, `PARTNERZY_KATALOG`.

## Reguły
- Tick co minutę; generuje dla partnerów **aktywnych** z ustawionym `harmonogram_minuty`, gdy od **ostatniej próby** (wpis `generowanie` w `partner_logi`, także nieudanej) minęło ≥ tyle minut. Osobny harmonogram na partnera; pierwsza próba od razu.
- **Zamek w pamięci procesu:** jedno generowanie partnera naraz (tick omija, ręczne zwraca 409). Wyjątek nie wywraca procesu — wpis w logu i `error_log`.
- Ręczne „generuj teraz” działa też dla partnera nieaktywnego i niezależnie od flagi harmonogramu; bez serwisu (testy) trasa odpowiada 503.
- **Domyślnie wyłączony** (`PARTNERZY_SCHEDULER=false`), wzorem schedulerów importu i Selly — środowisko testowe nie ma generować plików dla partnerów. Włączenie na produkcji to osobna decyzja (krok wdrożenia zmieniający `.env`, wymaga zgody).
- Pliki: `<PARTNERZY_KATALOG lub obok bazy/partnerzy>/<id partnera>/{pricelist,archive}`; mapowanie na serwer plików partnerów (`NAZWA_<16 znaków>/public/pricelist`) to poziom 6.

## Zmiana zachowania produkcji
Brak przy wdrożeniu — flaga wyłączona, trasa dodana. Zmiany `deploy-produkcja.sh` nie ma.

## Testy
`test/partnerzy.scheduler.test.ts` — interwały, osobne harmonogramy, awaria, zamek, trasa (401/404/503/200/409).
