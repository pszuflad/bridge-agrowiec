# 232 — Raport (PRT-7.4a)

## Summary
Dodano walidację zamówień partnera względem katalogu (nieznany kod, produkt nieaktywny, brak stanu): status `przyjete`/`blad_importu`, powody per pozycja, automatycznie po odbiorze z e-maila i ręcznie („Sprawdź ponownie”). Bez kontroli ceny i bez powiadomień do partnera.

## Changes
- **Nowe:** `rebuild/schema/029_partner_zamowienia_walidacja.sql`, `backend/src/partnerzy/walidacja-zamowienia.ts`
- `backend/src/db/schema.ts` (2 kolumny), `partnerzy/odbior-email.ts` (walidacja po zapisie + ostrzeżenie w error_log), `repos/partnerzy-zamowienia.ts` (`bladImportu` na liście), `routes/partnerzy.ts` (`POST …/waliduj`)
- Frontend: `pages/partnerzy/{api.ts,ZamowieniaPartnera.tsx}` — status, ramka błędu, powód przy pozycji, „Sprawdź ponownie”
- Testy: `partnerzy.walidacja-zamowien.test.ts` (12), `db.migracja-029.test.ts` (2), rozszerzone `partnerzy.zamowienia-trasy.test.ts` (11), `partnerzy.zamowienia.test.tsx` (13); uzupełniony katalog w `partnerzy.odbior-email.test.ts`
- Docs: `wpis-232.md`, `karta.md`, `docs/instrukcja-testow-PARTNERZY.md`, `rebuild/schema/README.md`

## Deviations from plan
Brak.

## Test results
- **Gate kontraktu:** N/D — nowa trasa poza `openapi.yaml`/fixtures; istniejące bez zmian.
- Backend i frontend: zob. PR (pełne bramki po synchronizacji z `develop`).

## Breaking changes
None. Migracja 029 dokłada kolumny do tabel z 028 (puste na produkcji).

## Follow-up
- Kontrola ceny/tolerancji (decyzja o wartości i zasadzie dla ceny wyższej) oraz mapowanie `CODE` na numer katalogowy (`znajdzPozycjeKatalogu`).
- Zasada „błąd importu” dla nieznanego kodu i braku stanu jest zakładana (karta: do potwierdzenia) — potwierdzić z użytkownikiem/Martą.
