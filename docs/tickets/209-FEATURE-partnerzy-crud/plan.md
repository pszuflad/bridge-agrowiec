# 209 — repo i REST: ustawienia partnera (PRT-1.3)

Karta: `docs/karty/PARTNERZY/` · poziom 1 · zależy od ticketu 208 (model danych).

## Zakres
`src/repos/partnerzy.ts` (walidacja + zapis) i `src/routes/partnerzy.ts` (za `requireAuth`):
`GET /api/partnerzy`, `GET /api/partnerzy/:id`, `POST /api/partnerzy`, `PUT /api/partnerzy/:id`,
`PUT /api/partnerzy/:id/aktywny`, `PUT …/magazyny`, `PUT …/wykluczenia`, `PUT …/kraje/:kraj`, `DELETE …/kraje/:kraj`.
Partnera się nie usuwa — dezaktywuje. Akcje trafiają do `audit_log` (`partner_*`).

## Decyzje
- **Poza `contract/openapi.yaml`** — jak `/api/ean-pary` (ticket 168): nowa funkcjonalność, nie ma jej w produkcji ani w fixtures, więc GATE kontraktu jej nie dotyka. Odstępstwo od planu podziału (który zakładał wpis w openapi); wpis do kontraktu można dodać, gdy panel (PRT-5.x) ustabilizuje kształt.
- Kolumny i pola obliczeniowe (`partner_kolumny`, `partner_pola_obliczeniowe`) są tylko ODCZYTYWANE w szczegółach; edycja przyjdzie z parserem formuł (PRT-2.3) i panelem (PRT-5.3).
- Kraj = dwuliterowy kod wielkimi literami (`fr` w ścieżce jest normalizowane).

## Zmiana zachowania produkcji
Brak. Nowe trasy, żaden istniejący endpoint nie zmienia się. Nazw produktów nie dotyka.

## Testy
`test/partnerzy.trasy.test.ts` — autoryzacja, wartości domyślne, walidacja, unikalność nazwy, aktywacja, magazyny/wykluczenia, kraje, audyt.
