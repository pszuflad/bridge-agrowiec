# 160-DOCS-roadmapa-model-cutoveru — raport

**Data:** 2026-09-24 · **Baza:** `origin/develop` @ `9f8085d` (po PR #176 Ani)

## Co zrobiono
`docs/rebuild-roadmap.md` doprowadzona do zgodności z nowym rozdziałem 0 w `docs/cutover.md`:
§4 (nota), §1a (oznaczona sprzeczność), §6 (nota + akapit o cutoverze), **§6a przepisane**,
**§6b Blok 1 przepisany**. Zero zmian w `rebuild/` i `contract/`.

## Zgłoszenia do `docs/cutover.md` (nie poprawiam — nie jest własnością tego ticketu)

1. **Rozdział 0 odsyła do „rozdziału 6 (Rollback)" i „rozdziału 7/8 (Po cutoverze)",
   a w dokumencie rollback jest rozdziałem **7**, a „Po cutoverze" rozdziałem **8**.**
   Same adnotacje wstawione w treści tych rozdziałów są w dobrych miejscach — myli się wyłącznie
   lista w rozdziale 0. Do poprawy jednym zdaniem przy najbliższej edycji tamtego pliku.
2. **Rozdział 2 („Warunki wstępne") zachował pozycję „Scheduler importu wygaszony na czas okna".**
   Przy nowym modelu okno to przełączenie domeny, a scheduler, który ma być wygaszony, chodzi na
   **starym** środowisku — warto doprecyzować którym, bo na nowym ma chodzić dalej.

## Ustalenie kodowe dla przyszłego ticketu 159 (GRI upload CSV/XLSX)

Zmierzone na `origin/develop` @ `9f8085d`:

| Warstwa | Stan | Dowód |
|---|---|---|
| parser MO10 | rozpoznaje XLSX **po sygnaturze bajtów**, nie po rozszerzeniu; CSV czyta jako Windows-1250 z `;` | `src/import/legacy/parsers/mo10_gri.cjs:19-51` (komentarz: dostawca zmienił format bez zmiany URL-a, Anna 14.07) |
| plik tymczasowy | zachowuje rozszerzenie z nazwy uploadu | `src/import/parsuj.ts:204-210` |
| trasa uploadu | brak filtra rozszerzeń; bramki to: brak pliku (400), brak dostawcy (404), `importWylaczony` (400) | `src/routes/suppliers.ts:134-175` |
| przycisk w UI | dostępny dla dostawców `upload` **i** `mail`; MO10 jest `mail` | `pages/konfiguracja/Dostawcy.tsx:8`, `:341` |
| `accept` | `.csv,.xml,.xlsx` | `pages/konfiguracja/Dostawcy.tsx:322` |

**Wniosek: ścieżka „wgraj CSV albo XLSX dla MO10" wygląda na kompletną.** Ticket 159 ma więc
zacząć od **odtworzenia realnej awarii**, którą zgłosiła Ania (jaki plik, jaki komunikat), zanim
cokolwiek zmieni. Możliwe, że problem leży gdzie indziej niż w formacie — np. w treści konkretnego
pliku GRI, w `.xls` (stary format, NIE kontener ZIP — ten faktycznie padnie), albo w tym, że
`importWylaczony` jest ustawiony dla MO10.

⚠ **Hipotezy z tej tabeli nie wolno podać Ani jako „to już działa"** — pomiar jest statyczny,
z kodu, bez pliku od dostawcy i bez powtórzenia jej kroków.
