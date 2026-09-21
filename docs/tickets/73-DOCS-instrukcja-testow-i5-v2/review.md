# 73-DOCS-instrukcja-testow-i5-v2 — Code review

> Reviewed: 2026-09-21
> Branch: `docs/73-instrukcja-testow-i5-v2`
> Diff: 3 pliki treściowe (`docs/instrukcja-testow-I5-v2.md` nowy, `docs/instrukcja-testow-I5.md` banner, `docs/rebuild-roadmap.md`) + `docs/tickets/73-DOCS-instrukcja-testow-i5-v2/plan.md`, 3 komity

## BLOCKER

Brak.

## SHOULD-FIX

Brak.

## NICE-TO-HAVE

- [ ] `docs/tickets/73-DOCS-instrukcja-testow-i5-v2/plan.md:93-98` — sekcja „Definition of done" ma wszystkie pozycje odhaczone jako `[ ]`, mimo że `raport.md` i realny stan repo potwierdzają ich wykonanie (inne karty, np. `70-CHORE-eksport-zip-odstepstwo/plan.md:60-65`, aktualizują `[x]` po zamknięciu). Kosmetyczna niespójność procesu, nie wpływa na treść dostarczoną Ani.

## Plan compliance

### Done ✓
- `docs/instrukcja-testow-I5-v2.md` — 5 rozdziałów zgodnie z planem: „Po co ta kartka" → 1. Twoje odpowiedzi (#21, §6, §9) → 2. Przy okazji (2.1 limit, 2.2 ZIP z linkiem) → 3. Co przestało być prawdą (cytaty znak w znak) → 4. Podsumowanie → 5. Jak zgłosić.
- Banner „częściowo nieaktualne" na górze `docs/instrukcja-testow-I5.md`, wzorzec wizualnie i strukturalnie zgodny z bannerem w `docs/instrukcja-testow-I4.md` (ikona ⚠, link do v2, lista „co konkretnie przestało być prawdą").
- `docs/rebuild-roadmap.md`: wiersz P5.3 → ✅ z datą i ID ticketa, Iteracja 5 oznaczona jako zamknięta (nagłówek bloku + tabela statusów), skonsumowane „Wejścia dla P5.3" zastąpione rozliczeniem faktycznego stanu.
- Zero zmian w `rebuild/` i `contract/` — potwierdzone (`git diff origin/develop...HEAD --stat -- rebuild/ contract/` puste).
- Format delta „Zgłosiłaś/Twoje odpowiedzi → Jest teraz → Sprawdź" zachowany; nigdzie przy P5.1/P5.2 nie użyto słowa „zgłosiłaś" (Ania niczego nie reklamowała w I5) — rozdział 2 „Przy okazji" wyraźnie oddzielony i opisany jako znalezisko zespołu, nie zgłoszenie Ani.
- Cytaty odpowiedzi Ani w rozdziale 1 (§3.2/#21, §6) zweryfikowane znak w znak z tabelą „Co Ania odpowiedziała" na końcu `docs/instrukcja-testow-I5.md` — zgodne. §9 poprawnie opisane jako „zrobiliśmy za Ciebie" (Ania zostawiła puste), nie jako jej zgłoszenie.
- Rozdział 3 „Co przestało być prawdą" — każdy cytat (§1, §3.2 ramka „W praktyce", §3.3, §5, §8.2, §9, §10, §11 pkt 9, §12 dwa wiersze, §13, §14 poz. 1 i 4) zweryfikowany znak w znak z `docs/instrukcja-testow-I5.md` — zgodne, w tym poprawne użycie wielokropka `(…)` przy skróconym cytacie z §11 pkt 9.
- Przejście I5 paragraf po paragrafie: żaden paragraf nieprawdziwy dziś nie został pominięty (§1, §3.2 ramka, §3.3, §5, §8.2, §9, §10, §11 pkt 9, §12, §13, §14) i żaden wciąż prawdziwy paragraf nie został błędnie wymieniony (§2, §4, §6, §7, §8.1, §8.3, §11 pkt 1–8 poza 9 — pominięte świadomie i słusznie).
- §3.1 (zmiany cen per opona) całkowicie pominięty w treści — zgodnie z D3 planu i decyzją Ani.
- P7.1 nie jest opisana — brak jakiejkolwiek wzmianki o atrybutach/kolejce w treści.
- Język dla Ani: brak nazw plików/tabel/funkcji/tras API poza jednym zatwierdzonym wyjątkiem — link `https://test.agritires.eu/api/export-shoper` w scenariuszu 2.2 (decyzja D1 planu).
- Podsumowanie do odhaczenia (rozdział 4) i „Jak zgłosić" (rozdział 5) obecne na końcu.

### Missing or deviating ✗
Brak — zakres z Implementation planu pokryty w całości, nic z Out of scope nie wsiąkło do treści.

### Definition of done
- [x] warunek startu sprawdzony (oba PR w develop, deploy stagingu `success`)
- [x] `instrukcja-testow-I5-v2.md` napisana, każde twierdzenie zweryfikowane z kodem — zweryfikowano w tym review niezależnie (patrz „Weryfikacja twierdzeń" niżej) i wszystko się zgadza
- [x] banner w `instrukcja-testow-I5.md`
- [x] roadmapa: P5.3 ✅, Iteracja 5 zamknięta
- [x] review bez BLOCKER-ów, PR do develop — spełnione tym review

(Uwaga: `plan.md` ma te pozycje technicznie nieodhaczone — patrz NICE-TO-HAVE.)

## Weryfikacja twierdzeń z kodem (niezależna od raport.md)

Każde twierdzenie instrukcji o zachowaniu aplikacji sprawdzone osobno wobec `develop`:

- **Wpis ZIP w Historii** (`routes/export-shoper.ts:89-146`, `historia/mapowanie.ts::naWpisHistorii`, `TabelaHistorii.tsx:56-78`, `historia/dane.ts:51`): typ `eksport` → zielona odznaka (`border-green-200 text-green-700`) ✓; `dostawca` = `null` → „—" (bo `encjaTyp: "dostawcy"` liczba mnoga, nie `"dostawca"`) ✓; `liczbaPozycji` = `liczbaDostawcow` z audytu ✓; `uwagi` = `"Format: csv"` renderowane obok `format` → wizualnie „Format: csv Format: csv" ✓; nazwa pliku `shoper_wszyscy_{data}.zip` ✓; filtr *Eksporty* obejmuje `eksport_csv`/`eksport_shoper` ✓; wpis nie pojawia się pod filtrem Dostawca (`dostawcyHistorii()` pomija `dostawca === null`) ✓.
- **Link w przeglądarce**: trasa za `requireAuth` (`middleware/auth.ts:34-38`), czyta cookie `bridge_session` (`SameSite=Lax`, `auth/cookie.ts:17-25`) — zgodne z nawigacją `window.location.href`; brak sesji → 401 `{"error":"Nieautoryzowany"}` dokładnie jak w treści instrukcji ✓.
- **Produkcja 500 na ZIP**: potwierdzone komentarzem w `export-shoper.ts:78-82` (backlog #93, decyzja 2026-09-18, `archiver@5.3.2` nie eksportuje `ZipArchive`) ✓.
- **Limit 5000 zdjęty** (`repos/audit-historia.ts:22-27`): brak `LIMIT` w zapytaniu, odsiew akcji robi SQL przed sortowaniem — zgodne z opisem „bierze cały dziennik" ✓.
- **Pomiary na `db/snapshot.db`** (zmierzone niezależnie przez ten review, `better-sqlite3` readonly): `audit_log` = **3873** wierszy ✓, widocznych (5 akcji słownika) = **270** ✓ (93,03% niewidocznych, zaokrąglone do 93,0% zgodne), `auto_pull` = **2869** ✓, `edycja_produktu` = **178** ✓, `upload_pliku` = **92** ✓, zakres dat 2026-06-30…2026-08-13 ✓, remisów `kiedy` wśród widocznych = **0** ✓, eksportów w snapshocie = **0** ✓ (stąd trafny opis „dziś nie ma tu czego klikać" dla 2.1 oraz brak potrzeby omawiania realnych wpisów eksportu w snapshocie), liczba dostawców = **10** ✓.
- **Scheduler stagingu wyłączony domyślnie** — potwierdzone `IMPORT_SCHEDULER` w `docs/rebuild-roadmap.md:542,727,751,753,761` ✓.
- **Edycja produktu w Katalogu**: `MenuAkcji.tsx` ma pozycję „Edytuj", zapis leci przez `routes/products.ts:270` z `akcja: "edycja_produktu"` ✓ — poprawnie wyjaśnia, dlaczego §3.3/§12 pierwszej wersji straciły aktualność od 12a, nie od P5.x.
- **Test automatyczny §6** (`rebuild/frontend/test/historia.test.tsx:128`): tytuł testu „paginacja przełącza stronę, a zmiana filtra cofa na pierwszą" zgodny z treścią przypisu ✓.
- **Test-wyrocznia §9** (`rebuild/backend/test/historia.wyrocznia.test.ts` + `historia.wyrocznia.json`): istnieje i działa jako część zwykłego zestawu testów — zgodne z twierdzeniem „porównanie… powtarza się samo przy każdej zmianie" ✓; liczba „0 różnic na 49 813 wpisach" zgodna z `docs/tickets/59-CHORE-i14j-oracle-diff-historii/raport.md:8,90`.
- Nie znaleziono żadnego zdania niezgodnego z kodem `develop` — w przeciwieństwie do poprzedniej delty (I4-v2), tu review nie wychwyciło rozjazdu.

## Parallel-test concerns

Brak zmian w testach kodu (ticket czysto dokumentacyjny) — nie dotyczy.

## Overall assessment

Bardzo solidna karta. Każde twierdzenie o zachowaniu aplikacji — w tym wszystkie liczby ze snapshotu — zweryfikowałem niezależnie wobec kodu `develop` i pomiaru bazy, i wszystko się zgadza co do słowa i co do cyfry. Format delty, separacja „Twoje odpowiedzi" vs „Przy okazji", cytaty znak w znak z pierwszej wersji, język bez żargonu (poza zatwierdzonym wyjątkiem) i aktualizacja roadmapy — wszystko spełnia wymagania. Jedyna uwaga to kosmetyczna niespójność w `plan.md` (nieodhaczone DoD mimo ukończenia), nie blokuje merge'a.
