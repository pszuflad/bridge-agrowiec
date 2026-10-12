# Wpis 234 — drugi format zamówień: TyreWorld `bestellung`

Ticket `234-FEATURE-partnerzy-zamowienia-bestellung` (PRT-7.1b). Nowa funkcjonalność, nie odtworzenie produkcji.

- `parsujZamowienie` rozpoznaje format po elemencie głównym: `DOCUMENTORDER` (Adtyres, bez zmian) albo `bestellung` (TyreWorld, system TopM R6). Inny element = błąd pliku z listą obsługiwanych formatów. Bez konfiguracji per partner i bez migracji.
- Mapowanie `bestellung` → `Zamowienie`: `bestellnummer` → numer partnera; `bestelldatum` → data zamówienia; `lieferadresse/lkz` → kraj dostawy; `positionen/pos`: `artnr` → kod (TEKST — zera wiodące znaczą),
  `menge` → ilość (całkowita ≥ 1), `preis` → cena (opcjonalna; netto/brutto nieustalone), `bezeichnung` → nazwa. `lieferadresse`, `neutralversand`, `bemerkung`, `bemerkungintern` w mapie `dostawa` pod oryginalnymi nazwami
  (pusta uwaga nie tworzy wpisu). Format nie ma waluty ani kosztu dostawy → `null`. Jedno zamówienie na plik (jak w specyfikacji TopM).
- Zapis, walidacja względem katalogu (232), panel i odbiór e-mail działają bez zmian; panel ma polskie etykiety niemieckich pól adresu.
- Fixtures w repozytorium są ZANONIMIZOWANE (publiczne repo, dane klientów końcowych): `test/partnerzy.zamowienie-bestellung-przyklad.ts`. Prawdziwych plików nie commitujemy.
- Fakty z przykładów i zrzutów serwera plików (układ katalogów, istniejące nazwy plików cenników, `done/`) oraz pytania z nich wynikające: `docs/karty/PARTNERZY/decyzje-do-konsultacji-marty.md`.
