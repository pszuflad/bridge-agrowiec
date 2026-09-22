# Wejście dla P10.4 od ticketu 96 (P10.2) · 2026-09-22

**Fakt.** Karta P10.2 naprawiła kafel „Ostatni eksport CSV" na Pulpicie (#34, decyzja Ani
2026-09-21, wariant a — świadome odstępstwo): kafel pokazuje prawdziwe daty zamiast bycia
trwale martwym. Dowód: `docs/tickets/96-FEATURE-kafel-ostatni-eksport/raport.md`.

**Co to obala w `docs/instrukcja-testow-I10.md`:**
- `:104` — wiersz tabeli kafli: „**Ostatni eksport CSV** | **zawsze „—"** i *„Brak eksportów ani
  importów"* | `/historia`";
- `:106` — „⚠ Czwarty kafel jest **celowo martwy** — patrz [sekcja 6.2]…";
- `:317` — nagłówek **6.2** „Kafel „Ostatni eksport CSV" zawsze pokazuje „—"";
- `:319-322` — treść 6.2: „Na Pulpicie czwarty kafel **nigdy** nie pokaże daty — zawsze „—" i
  *„Brak eksportów ani importów"*, choćbyś przed chwilą pobrała dziesięć plików CSV. […]
  Odtworzone 1:1; naprawa też czeka na Twoją decyzję.";
- `:466` — checklista: „[ ] kafel „Ostatni eksport CSV" pokazuje „—" *(poprawne — sekcja 6.2)*".

**Co P10.4 ma napisać w delcie (format „Zgłosiłaś → Jest teraz → Sprawdź").**
- **Zgłosiłaś:** kafel „Ostatni eksport CSV" zawsze pokazuje „—" i „Brak eksportów ani
  importów", niezależnie od danych.
- **Jest teraz:** kafel czyta prawdziwą historię eksportów/importów.
  - po eksporcie: data względna (np. „przed chwilą" / „N min temu") + podpis
    „<dostawca|wszyscy> — N produktów";
  - bez eksportu, ale z importem: „—" + „Ostatni import: <data>";
  - bez żadnego z nich: „Brak eksportów ani importów";
  - przy błędzie zapytania: „—" + „Nie udało się pobrać historii" (reszta Pulpitu działa dalej).
- **Sprawdź:** na danych ze snapshotu (0 eksportów, ostatni import 27.07.2026) kafel od razu
  pokaże „—" + „Ostatni import: 27.07.2026". Zrób eksport CSV z katalogu (np. jednego
  dostawcy) i wróć na Pulpit — kafel ma pokazać datę „przed chwilą"/„N min temu" i
  „<kod dostawcy> — N produktów". Uwaga: generowanie CSV dla Selly **się nie liczy** (nie
  pisze audytu); eksport ZIP „wszyscy" pokazuje jako „N produktów" w rzeczywistości **liczbę
  dostawców** (quirk oryginału, zostaje).

**Fakt dodatkowy — ten sam nieaktualny opis jest też w `docs/instrukcja-testow-I8.md`**
(`:414` nagłówek „10.4 Kafel „Ostatni eksport CSV" na Pulpicie nadal pokazuje „—"", `:497`
wiersz checklisty „Kafel „Ostatni eksport CSV" na Pulpicie: `—` | świadomie martwy od I10").
P10.4 decyduje/zgłasza, czy i jak poprawić ten starszy plik — poza zakresem tego wejścia.
