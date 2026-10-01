# Wpis 171 — „Rozstrzygnij" dla pozycji z błędnym EAN-em od dostawcy

> Ticket 171 (2026-10-01). **Odstępstwo od produkcji — decyzja użytkowniczki.** Nowa trasa
> `POST /api/staging/{id}/resolve-ean`, `import/polityka/ean-bledny.ts`, `zastapBlednyEan`.

**Objaw.** Pozycje typu „Błąd” z błędnym EAN-em od dostawcy (`4251438404205_D`; `9996118002103` ze złą
cyfrą kontrolną) nie miały przycisku „Rozstrzygnij” — okno obsługiwało tylko niejednoznaczne
dopasowania. Zostawała ręczna edycja EAN-u w szczegółach, a ten sam błędny numer wracał co import.

**Co jest.**
- Dwie decyzje: `keep` — zostaje poprawny EAN z karty w katalogu (także wygenerowany 999…), numer od
  dostawcy jest ignorowany; `set` — wpisany poprawny EAN (walidacja `validateEan`).
- Decyzja w JEDNEJ transakcji zatwierdza pozycję do katalogu (`zatwierdzPozycjeZPolityka`); odmowa
  (np. brak EAN-u na karcie przy `keep`) cofa całość.
- Zapamiętanie: poprawka `ean` w `manual_overrides` z `acknowledgedSourceValue` = błędny numer z pliku.
  Importer (`zastapBlednyEan`) przy tym samym numerze używa EAN-u poprawki zamiast zgłaszać błąd;
  gdy dostawca zmieni numer, pytanie wraca.
- `GET /review` dostaje `eanKarty`; frontend pokazuje „Rozstrzygnij” także dla powodu „Błędny EAN”.
- Reguła domyślna NIE zmienia się: błędny EAN nadal blokuje akceptację, dopóki ktoś go nie rozstrzygnie.

**Pomiar (plik MO5 z 1515 rekordami):** w pliku jest 14 EAN-ów z doklejonym sufiksem dostawcy
(`…_D`, `…W2`) i jeden z błędną sumą kontrolną na 999 — wszystkie przechodzą teraz tym samym trybem.

**Nie ruszone.** Zdejmowanie sufiksu z EAN-u (reguła „nie obcinaj EAN-u"); `charakteryzacja` silnika
mockuje `zastapBlednyEan` do zachowania produkcji.
