# Wpis do spec-backend od ticketu 194 (Selly: widoczność i audyt przepływu) · 2026-10-06

Dodatki względem oryginału (nic z istniejącego zachowania nie zmienione):

- `GET /api/selly/usuwanie-status` — stały stan Toru 3 („Usuwanie z Selly"): czy włączone i dlaczego nie,
  wynik ostatniego przebiegu (pamięć procesu, `selly/rest/stan-tor3.ts` — zerowany po restarcie),
  sieroty teraz, usunięcia z 24 h, limity, ostatnie usunięcie z `audit_log`.
- `GET /api/selly/log?grupa=usuwanie|synchronizacja` — filtr (bez parametru jak dotąd); frontend prosi o 100 wpisów
  zamiast 10, więc wpisy Toru 3 nie są wypychane przez Tor 1.
- `selly_sync_log.szczegoly_json` — `sync-delta` dodaje `bledy_wg_rodzaju` (pending_create | tozsamosc | inne),
  a zapis jest przycinany do 8000 znaków **z zachowaniem poprawnego JSON-a** (wcześniej ucinany w środku).
- Strażnik nakładania Toru 1 (`stworzStraznikaPrzebiegu`, limit 30 min): kolejny tick nie startuje, gdy poprzedni
  przebieg jeszcze trwa.
