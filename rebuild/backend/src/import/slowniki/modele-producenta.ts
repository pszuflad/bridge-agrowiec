// Ticket 178 (Etap 3 SPEC 2026-10-01): wzorcowy zapis modelu = zapis PRODUCENTA.
//
// Klucz: marka (WIELKIMI LITERAMI, jak w katalogu), wartość: lista wzorców zapisu producenta.
// `normalizujModel()` zamienia model z cennika na wzorzec, gdy zgadza się z nim `kluczModelu()`
// (spacje, myślniki, kropki, wielkość liter nie mają znaczenia): `T539` → `T-539`, `EM 22` → `EM-22`.
// Model bez wpisu zostaje tak, jak podał cennik — samo porównanie z kartą i tak przechodzi dzięki
// `kluczModelu()` (`tolerancja-dopasowania.ts`).
//
// ⚠ Lista jest WYŁĄCZNIE DANYMI i startuje pusta: nie zgadujemy, jak producent zapisuje model
// (spec daje pary `T-539`/`T539`, `RD-01`/`RD01`, ale nie mówi, która forma jest producenta).
// Wpisy dokłada użytkowniczka; każdy dopisek działa od następnego importu i od następnego
// uruchomienia czyszczenia katalogu (`npm run normalizuj-katalog`).
export const MODELE_PRODUCENTA: Readonly<Record<string, readonly string[]>> = {};
