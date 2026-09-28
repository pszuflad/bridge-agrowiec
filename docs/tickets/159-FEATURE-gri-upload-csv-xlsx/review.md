# 159-FEATURE-gri-upload-csv-xlsx — Code review

> Reviewed: 2026-09-24
> Branch: `feature/159-gri-upload-csv-xlsx`
> Diff: 4 pliki zmienione (`plan.md`, `raport.md`, `MO10.csv` nowy, `dostawcy.upload.test.ts`), 2 commity

## BLOCKER

Brak.

## SHOULD-FIX

Brak.

## NICE-TO-HAVE

- [ ] `rebuild/backend/test/dostawcy.upload.test.ts:180-190` — test sprawdza `liczbaProduktow`,
  `status` i `policzStaging() > 0`, ale nie porównuje żadnej wartości pola (np. `cena_zakupu`,
  `rozmiar`) między wierszem CSV a odpowiadającym wierszem XLSX z testu obok. Dodatkowa asercja
  na treści jednego rekordu podniosłaby pewność, że ścieżka CSV nie tylko "coś" parsuje, ale
  parsuje te same dane co XLSX (zgodnie z założeniem z plan.md, że próbka ma te same wartości
  poza typami string/number). Nie blokuje — liczba rekordów (223) i status 200 to wystarczający
  dowód dla celu ticketu (dowód działania ścieżki CSV po sygnaturze bajtów).

## Plan compliance

### Done ✓
- Nowa próbka `MO10.csv` (223 wiersze danych + nagłówek, Windows-1250, separator `;`, CRLF) —
  zgodna z formatem opisanym w komentarzu `mo10_gri.cjs:1-6`. Pierwsze bajty pliku to tekst
  (`"NR K..."`), nie sygnatura ZIP `PK\x03\x04`, więc `isZipBuffer()` w parserze poprawnie kieruje
  do gałęzi CSV (`mo10_gri.cjs:20-24,54-62`) — test faktycznie weryfikuje ścieżkę CSV, nie XLSX.
- Nowy test `"wgrywa cennik CSV dostawcy MO10 (GRI, ten sam adres co XLSX)"` w
  `dostawcy.upload.test.ts:178-190` — idzie pełną ścieżką HTTP (multer → parser → staging),
  asercje: status 200, `liczbaProduktow === 223` (zgadza się z liczbą wierszy danych w próbce),
  `policzStaging() > 0`.
- Zero zmian w kodzie produkcyjnym (`Dostawcy.tsx`, `suppliers.ts`, `mo10_gri.cjs`) — zgodnie z
  planem i „Out of scope".
- `raport.md` opisuje wynik bramek zielony (lint/typecheck/build/test, 1845 passed).

### Missing or deviating ✗
Brak — implementacja pokrywa plan 1:1.

### Definition of done
- [x] Próbka `MO10.csv` dodana.
- [x] Test ścieżki CSV dla MO10 przechodzi (potwierdzone w raport.md, nie uruchamiałem ponownie
  testów w ramach review — treść testu i próbki nie budzi wątpliwości).
- [x] Bramki (lint/typecheck/build/test) zielone — wg raport.md.
- [ ] Gałąź zsynchronizowana z `origin/develop`, PR `MERGEABLE` — poza zakresem code review
  (weryfikuje Master/proces push-i-pr).

## Parallel-test concerns

None — all tests parallelizable. Test korzysta ze środowiska testowego z izolowaną bazą
(`stworzSrodowiskoTestowe()`), jak reszta pliku; nowy test nie wprowadza własnych zasobów
współdzielonych (portów, ścieżek na sztywno poza katalogiem próbek, który jest tylko do odczytu).

## Overall assessment

Bardzo mały, dobrze uzasadniony ticket — wyłącznie dowód testowy bez zmian w kodzie produkcyjnym.
Próbka CSV jest poprawnie sformatowana i realistycznie odzwierciedla to, co opisuje komentarz w
parserze; sprawdzone bezpośrednio, że pierwsze bajty pliku NIE są sygnaturą ZIP, więc test
faktycznie ćwiczy gałąź CSV, a nie przypadkiem trafia w XLSX przez detekcję bajtów. Asercje są
adekwatne do celu (dowód, że upload CSV działa end-to-end), niekruche, nie zależą od zasobów
współdzielonych. Można by rozważyć jedną dodatkową asercję na treści rekordu, ale to kosmetyka,
nie warunek merge'a.
