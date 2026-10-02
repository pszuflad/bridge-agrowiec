// Ticket 178 (Etap 3 SPEC 2026-10-01): wzorcowy zapis modelu = zapis PRODUCENTA.
//
// Klucz: marka (WIELKIMI LITERAMI, jak w katalogu), wartość: lista wzorców zapisu producenta.
// `normalizujModel()` zamienia model z cennika na wzorzec, gdy zgadza się z nim `kluczModelu()`
// (spacje, myślniki, kropki, wielkość liter nie mają znaczenia): `T539` → `T-539`, `EM 22` → `EM-22`.
// Model bez wpisu zostaje tak, jak podał cennik — samo porównanie z kartą i tak przechodzi dzięki
// `kluczModelu()` (`tolerancja-dopasowania.ts`).
//
// ⚠ Lista jest WYŁĄCZNIE DANYMI — nie zgadujemy, jak producent zapisuje model. Wpisy dokłada
// użytkowniczka; każdy dopisek działa od następnego importu i od następnego
// uruchomienia czyszczenia katalogu (`npm run normalizuj-katalog`).
//
// Wpisy 2026-10-01 (ticket 180, lista od Ani, sprawdzona na stronach/katalogach producentów):
// Trelleborg T539 (bez myślnika), Cultor RD-01 i AS-AGRI 10/13/19 (katalog Cultor 2022), Mitas EM-22,
// LingLong serii serbskiej L-T20/L-S20/L-D20/L-T10/R-D30. ⚠ LingLong KLT200/KLS200/KLD200 (Tajlandia) to
// INNE opony — mają inny `kluczModelu()`, więc słownik ich nie łączy.
export const MODELE_PRODUCENTA: Readonly<Record<string, readonly string[]>> = {
  TRELLEBORG: ["T539"],
  CULTOR: ["RD-01", "AS-AGRI 10", "AS-AGRI 13", "AS-AGRI 19"],
  MITAS: ["EM-22"],
  LINGLONG: ["L-T20", "L-S20", "L-D20", "L-T10", "R-D30"],
};
