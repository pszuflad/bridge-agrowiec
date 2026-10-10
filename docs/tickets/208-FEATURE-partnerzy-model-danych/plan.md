# 208 — model danych partnerów B2B (PRT-1.1)

Karta: `docs/karty/PARTNERZY/` · plan podziału: `podzial-na-tickety.md` · poziom 1 (fundament danych).

## Zakres
Migracja `rebuild/schema/024_partnerzy.sql` + model Drizzle w `src/db/schema.ts` dla ośmiu tabel: `partnerzy`,
`partner_magazyny`, `partner_wykluczenia`, `partner_kraje`, `partner_kolumny`, `partner_pola_obliczeniowe`,
`paliwo_historia`, `partner_kursy`. **Sam model — bez logiki, tras i panelu** (CRUD to PRT-1.3).

## Decyzje robocze (do zmiany w kolejnych ticketach, jeśli zajdzie potrzeba)
- Nowy partner jest **nieaktywny**, stan minimalny **2**, zaokrąglanie `grosz` (2 miejsca), format `csv`, separator `;`.
- Narzut przechowywany jako `narzut_proc` (NARZUT `zakup × (1+x)`, nie marża); koszty dodatkowe w PLN. Kurs: `nbp` albo `reczny`.
- Opłata paliwowa jest **per kraj**, nie per partner (tabele GEIS są per kraj), z historią okresów — zmiana nie przelicza wstecz. Nazwa tabeli `paliwo_historia` (w planie ogólnym `partner_paliwo_historia`).
- Wykluczenia po `products.kod` (jednoznaczny klucz pozycji katalogu), magazyny po `products.magazyn`.
- Brak tabel logów i zamówień — należą do PRT-4.2 i PRT-7.1.

## Zmiana zachowania produkcji
Brak. Nowe puste tabele; nic nie czyta ani nie zapisuje do nich żaden istniejący kod. API bez zmian (kontrakt i fixtures nietknięte). Nazw produktów nie dotyka.

## Testy
`test/db.migracja-024.test.ts` (domyślne wartości, unikalność, kaskada przy usunięciu partnera), bilans w `db.migracje.test.ts` (48 tabel, 25 indeksów), lista obiektów w `db.migracje-produkcja.test.ts`.

## Wdrożenie
Migracja stosuje się przy `npm run migrate` w deployu; tworzy puste tabele, bez kroków ręcznych.
