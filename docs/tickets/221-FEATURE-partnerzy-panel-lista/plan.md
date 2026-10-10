# 221 — panel partnerów: lista i aktywacja (PRT-5.1)

Karta: `docs/karty/PARTNERZY/` · poziom 5 · zależy od 209 (REST), 219 (logi).

## Zakres (frontend)
`rebuild/frontend/src/pages/Partnerzy.tsx` + `pages/partnerzy/api.ts`; trasa `/partnerzy` w `App.tsx`; pozycja „Partnerzy” (ikona Handshake) na końcu sidebara (`nawigacja.ts`, test `shell.test.tsx`: 13 pozycji).

## Widok
Nagłówek, formularz dodania partnera (nazwa, przycinana; przycisk nieaktywny dla pustej), tabela: partner · status (Aktywny/Nieaktywny) · harmonogram („co 1 h”) · magazyny/kraje/wykluczenia · ostatnie generowanie (ostatni wpis logu operacji) · przycisk Aktywuj/Dezaktywuj.
Nowy partner jest nieaktywny; partnera nie usuwa się. Błędy mutacji → toast z komunikatem serwera; błąd listy → komunikat (bez udawania pustej listy).

## Poza zakresem (kolejne tickety panelu)
Konfiguracja szczegółowa (5.2), kolumny i pola obliczeniowe z podglądem (5.3, wymaga nowych tras backendu), logi i pliki (5.4).

## Zmiana zachowania produkcji
Brak — nowa strona; backend bez zmian. Handlery MSW w teście pisane od zera (trasy `/api/partnerzy` są poza `openapi.yaml`, więc nie ma nagrań fixtures).

## Testy
`test/partnerzy.test.tsx` (9) + zaktualizowany `shell.test.tsx`. Frontend: lint, typecheck, build, 1092 testy zielone.
