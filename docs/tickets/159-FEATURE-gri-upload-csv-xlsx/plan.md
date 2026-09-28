# 159-FEATURE-gri-upload-csv-xlsx — test CSV dla ręcznego uploadu GRI (MO10)

> Status: Approved → Implemented
> Branch: `feature/159-gri-upload-csv-xlsx`
> Worktree: `.worktrees/159-FEATURE-gri-upload-csv-xlsx`

## Ticket description

Pierwotne zgłoszenie (158, numer zajęty przez równoległą kartę — ten ticket jedzie jako 159):
dostawca GRI (MO10) w Konfiguracja → Dostawcy ma pozwalać na ręczne wgranie pliku CSV oraz
XLSX. Sprawdzić frontend (`accept`), backend (multer, parser `mo10_gri.cjs`) i oryginał.

## Context — ustalenie z researchu (przed planem, bez subagenta — trywialne do zweryfikowania)

Zbadane bezpośrednio (bez potrzeby pytań do użytkownika — stan faktyczny jest jednoznaczny):

- **Frontend** (`rebuild/frontend/src/pages/konfiguracja/Dostawcy.tsx:322`): input pliku ma
  `accept=".csv,.xml,.xlsx"` — **wspólny dla WSZYSTKICH dostawców** typu `upload`/`mail`, nie
  różnicowany per dostawca. GRI/MO10 już dziś może wybrać oba formaty.
- **Backend** (`rebuild/backend/src/routes/suppliers.ts`): `multer` bez `fileFilter` po
  mimetype/rozszerzeniu — przyjmuje dowolny plik do 50 MB (`MAX_ROZMIAR_UPLOADU_DOSTAWCY`).
- **Parser** (`rebuild/backend/src/import/legacy/parsers/mo10_gri.cjs`): wykrywa realny format
  po sygnaturze bajtów (`PK\x03\x04` = ZIP/XLSX), niezależnie od rozszerzenia — obsługuje CSV
  (Windows-1250, `;`) i XLSX. To **świadoma, już udokumentowana decyzja z sesji 3f-1**
  (komentarz `suppliers.ts:109-131`, test `dostawcy.upload.test.ts:163-172`
  `it.each(["MO8", "MO10"])("wgrywa cennik XLSX dostawcy %s", …)`).
- **Oryginał**: komentarz w `mo10_gri.cjs:1-6` opisuje, że dostawca GRI realnie zmienił format
  bez zmiany URL (Anna, 14.07), co w oryginale powodowało błąd — poprawka wykrywania po bajtach
  jest odtworzeniem naprawy Ani, nie nowym pomysłem.

**Wniosek: funkcjonalność jest już zaimplementowana 1:1 i przetestowana dla XLSX.** Jedyna luka:
brakuje próbki `MO10.csv` i dedykowanego testu ścieżki CSV przez `POST /api/dostawcy/:kod/upload`
— `test/charakteryzacja/probki/` ma tylko `MO10.xlsx`. Logika `readRows()` w parserze jest
współdzielona i deterministyczna (wybór po sygnaturze bajtów, nie po rozszerzeniu), więc ryzyko
regresji jest niskie, ale ścieżka CSV dla MO10 nie miała dotąd żadnego automatycznego dowodu.

Zdecydowano z użytkownikiem: **dopisać tylko test CSV** (bez zmian w kodzie produkcyjnym),
zamykający warunek wstępny cutoveru (`docs/cutover.md` rozdz. 2) dowodem zamiast tylko lekturą
kodu.

## Kontrakt i fixtures (zakres)

`POST /api/dostawcy/:kod/upload` — ścieżka istnieje już w `contract/openapi.yaml` i jest objęta
istniejącymi testami/fixtures dla innych dostawców. Ten ticket nie zmienia kształtu odpowiedzi
ani kontraktu — dodaje tylko dowód testowy dla nowej kombinacji (MO10 + CSV). Gate fixtures/kontrakt
nie dotyczy (brak zmiany zachowania API).

## Decisions

- Nowa próbka `test/charakteryzacja/probki/MO10.csv` — wygenerowana z istniejącej `MO10.xlsx`
  (te same 223 wiersze, ten sam nagłówek), zakodowana Windows-1250 z separatorem `;`, zgodnie
  z formatem, jaki faktycznie wysyła GRI (komentarz w `mo10_gri.cjs`). Nie dotykamy gate'u
  charakteryzacji 3a (`charakteryzacja.test.ts`, mapowanie `PROBKI_PLIKOWE.MO10 = "MO10.xlsx"`)
  — ten gate dowodzi wierności NAGRANEMU wzorcowi z oryginału i nie ma nagranego wzorca dla CSV
  GRI; podmiana wymagałaby nagrania z prawdziwego oryginału, czego nie robimy bez potrzeby.
- Nowy test w `test/dostawcy.upload.test.ts`, obok istniejącego `it.each(["MO8","MO10"])`
  testu XLSX — analogiczny test dla MO10 + CSV przez pełną ścieżkę HTTP (multer → parser →
  staging), potwierdzający status 200, liczbę rekordów > 0 i zapis do `staging_items`.
- Brak zmian w `Dostawcy.tsx`, `suppliers.ts`, `mo10_gri.cjs` — funkcjonalność już działa.

## Implementation plan

1. `rebuild/backend/test/charakteryzacja/probki/MO10.csv` — nowa próbka (wygenerowana z XLSX,
   zweryfikowana ręcznie: parser daje 223 rekordy, 0 błędów, te same wartości co XLSX poza
   typami `string` vs `number` w `surowe_pola`/`ean_raw`, co jest oczekiwaną różnicą CSV↔XLSX).
2. `rebuild/backend/test/dostawcy.upload.test.ts` — dopisać test
   `"wgrywa cennik CSV dostawcy MO10 (GRI zmienił format bez zmiany URL — #6)"` obok bloku
   `it.each(["MO8", "MO10"])`.

## Testing strategy

Uruchomić `npm test -- dostawcy.upload` (nowy test + regresja istniejących) oraz pełne
`npm run lint && npm run typecheck && npm run build && npm test` w `rebuild/backend/` przed PR.

## Out of scope

- Zmiany w `Dostawcy.tsx` / `suppliers.ts` / `mo10_gri.cjs` — nie są potrzebne.
- Nagranie nowego wzorca charakteryzacji 3a dla CSV GRI (wymagałoby dostępu do oryginału z
  prawdziwym plikiem CSV od dostawcy — nie mamy takiego źródła, próbka jest wygenerowana z XLSX).

## Definition of done

- [x] Próbka `MO10.csv` dodana.
- [x] Test ścieżki CSV dla MO10 przechodzi.
- [ ] Bramki (lint/typecheck/build/test) zielone.
- [ ] Gałąź zsynchronizowana z `origin/develop`, PR `MERGEABLE`.
