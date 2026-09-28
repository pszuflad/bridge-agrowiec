# 160-DOCS-roadmapa-model-cutoveru — roadmapa po zmianie modelu cutoveru

**Typ:** DOCS (koordynator). **Zero zmian w `rebuild/` i `contract/`.**
**Powód:** Ania zmergowała PR #176 (`docs/158-cutover-model-update`, commity `331854a`, `74342c2`),
który **zmienia model cutoveru** w `docs/cutover.md`. Roadmapa — zaktualizowana godzinę wcześniej
ticketem 158 (PR #175) — od tej chwili opisuje nieistniejący plan.

## Co zmieniła Ania (`docs/cutover.md`, nowy rozdział 0)

| Było (rozdziały 1–8) | Jest (rozdział 0, decyzja użytkownika 2026-09-24) |
|---|---|
| podmiana kodu na serwerze produkcyjnym, migracje na żywej `data.db` | **przełączenie domeny** — środowisko testowe STAJE SIĘ produkcją |
| weryfikacja schematu + próba migracji przed oknem | **baza już zweryfikowana** (ticket 113), nie migrujemy powtórnie |
| rozdział 5 = procedura okna | rozdział 5 **nieaktualny**, zostaje jako materiał źródłowy |
| rozdział 7 = rollback | **nie jest realizowany** |
| rozdział 8 = „po cutoverze" | wykonywane **PRZED** przełączeniem, w trakcie testów |
| audyt §3a = „dokonfiguruj produkcję" | „potwierdź, że środowisko testowe może być produkcją" |
| — | **nowy warunek wstępny:** ticket `159-FEATURE-gri-upload-csv-xlsx` |

Ania odnotowała też sama **kolizję numeru 158** (mój ticket wszedł pierwszy, PR #175) i przenumerowała
swój na 159 — commit `74342c2`.

## Zakres tego ticketu

1. **§4 nota** — „nic nie jest w toku" przestało być prawdą (doszedł ticket 159); dopisek o zmianie modelu.
2. **§1a tabela środowisk** — wiersz „PRODUKCJA (nowa) = `main` po cutoverze" oznaczony jako
   czekający na rozstrzygnięcie (patrz Decisions, D2).
3. **§6 nota i akapit o cutoverze** — opis „big-bang, migracje 001→003, rollback" zastąpiony opisem
   nowego modelu z odesłaniem do rozdziału 0.
4. **§6a przepisane** — nowy nagłówek „Przed przełączeniem domeny", cztery skutki zmiany modelu,
   tabela czynności: weryfikacja schematu **zdjęta** (zrobiona), audyt **przeformułowany**, dodany
   wiersz ticketu 159, okno → „przełączenie domeny". Dwa nowe ostrzeżenia (świeżość danych, staging).
5. **§6b Blok 1 przepisany** — rozdzielony na „przed przełączeniem" i „na moment przełączenia i po";
   dopisek, że rollback nie jest realizowany.

## Decisions

- **D1. Do ticketu 159 nie piszemy kodu i nie zakładamy karty.** Sprawdzone w kodzie:
  `mo10_gri.cjs:19-51` rozpoznaje XLSX po sygnaturze `PK\x03\x04` **niezależnie od rozszerzenia**,
  `parsujBufor` (`src/import/parsuj.ts:204-210`) zachowuje rozszerzenie pliku tymczasowego,
  przycisk „Wgraj plik" jest dostępny dla dostawców `mail` **i** `upload` (MO10 jest `mail`,
  `Dostawcy.tsx:8`), `accept=".csv,.xml,.xlsx"` (`:322`), a `POST /api/dostawcy/:kod/upload`
  (`routes/suppliers.ts:134-175`) nie filtruje rozszerzeń. **Ścieżka wygląda na działającą**, więc
  ticket ma zacząć od odtworzenia realnej awarii Ani — inaczej ryzykujemy pustą robotę albo
  naprawę nie tego. Zapisane jako ostrzeżenie w wierszu 5 tabeli §6a.
- **D2. Sprzeczności §1a nie „naprawiam" po cichu, tylko oznaczam.** CLAUDE.md pkt 4: fakt
  zapisujemy jako fakt, **zmiana przypisania/zasady to decyzja użytkownika**. Nowy model implikuje,
  że po przełączeniu nie ma osobnego stagingu i auto-deploy z `develop` szedłby na żywy panel —
  to jest decyzja o procesie wdrożeń, nie porządkowanie dokumentu.
- **D3. `docs/cutover.md` nietykany.** Jest własnością sesji Ani z 24.09; roadmapa ma się do niego
  dostosować, nie odwrotnie. Dwie rzeczy, które tam zauważyłem, zgłaszam w `raport.md` zamiast
  poprawiać.

## Tests
Nie dotyczy — wyłącznie `docs/`.
