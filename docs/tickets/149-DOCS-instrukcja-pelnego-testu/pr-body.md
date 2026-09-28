## Ticket
149-DOCS-instrukcja-pelnego-testu — instrukcja pełnego testu systemu dla Ani (dokument 1 z 3)

## Summary
Powstał `docs/instrukcja-pelnego-testu.md` — lista kontrolna całego systemu dla Ani przed cutoverem,
bez ścieżki krytycznej (ta idzie do TEST.2 i jest odesłana jednym akapitem). Dokument odsyła do
`docs/przeglad-12-widokow.md` zamiast go przepisywać i dokłada wyłącznie deltę po 22.09 plus dwa
ostrzeżenia, bez których Ania zgłosiłaby działające zabezpieczenia jako usterki.

## Problem / Motivation
Karta TEST.1 zakładała jeden dokument obejmujący cały system razem ze ścieżką krytyczną. Wejście 148
(decyzja użytkownika 2026-09-24) podzieliło to na trzy dokumenty — ścieżka krytyczna wyszła do TEST.2,
a TEST.1 zostaje tym, czym miało być: listą kontrolną „wejdź, sprawdź, że działa i wygląda sensownie".
Przegląd 13 widoków został zweryfikowany wobec `develop` z 22.09, więc wszystko nowsze wymagało
osobnego opisania.

## Solution
- **Nowy:** `docs/instrukcja-pelnego-testu.md` — warunki środowiskowe, dwa ostrzeżenia wstępne,
  Część 1 (sześć punktów delty w układzie „co zmieniliśmy → polecenie → rezultat"), Część 2 (lista
  kontrolna 14 pozycji), „Czego NIE zgłaszać", „Do Twojej decyzji" (cztery pozycje z wariantami).
- `docs/karty/TEST.1/karta.md` — oznaczona ✅, zakres przepisany na stan faktyczny (usunięte punkty,
  które ticket obalił), wypełnione „Decyzje"/„Dowiezione"/„Do koordynatora".
- **Nowe:** `docs/karty/TEST.2/wejscie-149.md`, `docs/karty/TEST.3/wejscie-149.md`.
- Zero zmian w `rebuild/`, `contract/`, `rebuild/schema/`.

## Design decisions
- **D1 — stare zgłoszenia w poczekalni: uprzedzić, nie czyścić bazy.** Baza stagingu to kopia
  produkcji z 23.09, więc zastane zgłoszenia nie mają znacznika polityki i akceptacja im odmawia.
  Instrukcja mówi, że to poprawne, i każe najpierw zrobić jeden import. Blokada zostaje sprawdzona
  zamiast obejścia, zero roboty na VPS.
- **D2 — granica TEST.1/TEST.2 biegnie „ekran vs. potok".** TEST.1 bierze to, co Ania widzi i klika
  na `/staging`; TEST.2 bierze mechanizmy, które te decyzje wytwarzają. Bez tej granicy oba dokumenty
  opisywałyby to samo.
- **D3** — kratki ✅/❌ jak w przeglądzie, dla namacalnego wyniku testu.
- **D4** — „Do Twojej decyzji": priorytet reguły narzutu, podział admin/użytkownik, ciche nadpisywanie
  poprawek Marty, złączenie czterech par bieżników.
- **D5** — odświeżania dostępności nie testujemy; jedno zdanie, że brak CSV po imporcie jest oczekiwany.
- **D6** — ostrzeżenie przed „Akceptuj wszystkie" (kilkanaście minut w jednym żądaniu).
- **D7** — kolumna „Blokowane formy płatności" jedną linijką; „—" przy MO6 jest poprawne.

Odstępstw od zachowania oryginału ticket nie wprowadza — dokument opisuje odstępstwa zatwierdzone
wcześniej (pełne pliki CSV analityki, wspólna lista przewoźników, daty realnie kończące promocję).

## Tests
- **Gate odbudowy: N/D** — ticket nie dotyka API. `git diff --name-only origin/develop...HEAD` poza
  `docs/` → pusto.
- **Weryfikacja faktów** (odpowiednik gate'u dla DOCS-a): każda etykieta UI cytowana z kodu na
  `develop` — filtr i odznaka stagingu, okno „Rozstrzygnij"/„Sprawdź kartę", siedem komunikatów
  blokad wraz z **kolejnością pierwszeństwa**, kolumna „Blokowane formy płatności" i „—" dla MO6,
  cztery reguły alertów katalogowych, 9 kart analityki z CSV / 2 bez. Warunki środowiskowe
  potwierdzone w `tools/deploy-staging.sh`, `server.ts`, `config/env.ts` i audycie w `docs/cutover.md`.
- **Pomiar własny:** `staging_items` = 3362, z czego 0 ma znacznik polityki — dowód, że blokada
  odrzuci akceptację zastanych zgłoszeń. Liczba świadomie **nie** trafiła do dokumentu (migawka
  z 13.08, baza stagingu z 23.09).
- Bramki `rebuild/backend/` nie uruchamiane — zakres gałęzi i zmiany z bazy to wyłącznie `docs/`.

## Breaking changes
None.

## Follow-up
1. **Trzy poprawki do `docs/przeglad-12-widokow.md` — dla koordynatora** (zapisane w „Do koordynatora"
   karty TEST.1, bo ten plik nie należy do TEST.1): punkt 8 i pozycja 9 listy zbiorczej twierdzą,
   że plik CSV z analityki to dokładnie tabela z ekranu — po P10.5 nieprawda dla ośmiu z dziewięciu
   kart; punkt 2 opisuje filtr stagingu nieaktualnymi nazwami; punkt 12 cytuje komunikat Selly jako
   „tryb wyłączony", a realny tekst to „Integracja Selly wyłączona na tym środowisku".
2. **Świadomie pominięte w dokumencie:** trzy karty MO8 wracające do kodu konstrukcji „D" (zbyt
   niszowe) oraz temat pustej marki/kategorii w promocjach — skala 0 produktów, karta 14m zdecydowała
   19.09 nie opisywać tego Ani.
3. **Cztery odpowiedzi od Ani** z sekcji „Do Twojej decyzji" wracają drogą: decyzja → wpis w backlogu
   → `/feature` (opisane w `docs/karty/TEST.3/wejscie-149.md`).

## Review
<details>
<summary>Code review</summary>

# 149-DOCS-instrukcja-pelnego-testu — Code review

> Reviewed: 2026-09-24
> Branch: `docs/149-instrukcja-pelnego-testu`
> Diff: 3 pliki (`docs/instrukcja-pelnego-testu.md`, `docs/tickets/149-.../plan.md`, `docs/tickets/149-.../raport.md`), 2 commity

## BLOCKER

- [ ] `docs/karty/TEST.1/karta.md` — karta nie została zaktualizowana po dowiezieniu ticketu.
  - Reason: `Stan:` nadal `⬜ po I15.9`, sekcje `Dowiezione` i `Do koordynatora` puste (`—`), mimo że
    `plan.md` w Definition of done wprost wymaga „`docs/karty/TEST.1/karta.md` oznaczona ✅ z sekcją
    «Dowiezione»” i mimo reguły `CLAUDE.md`: „Po każdej zamkniętej karcie jej `karta.md` opisuje STAN,
    nie zamiar”. Porównaj z wzorcem `docs/karty/PR.6/karta.md` (`Stan: ✅ 2026-09-22 · 102-DOCS-...`,
    wypełnione „Dowiezione”). Bez tej aktualizacji koordynator kolejnej fali zobaczy kartę jako
    nieukończoną.
  - Suggestion: uzupełnić `Stan: ✅ 2026-09-24 · 149-DOCS-instrukcja-pelnego-testu`, sekcję „Dowiezione”
    (co faktycznie powstało) i przenieść tam sprostowanie do `przeglad-12-widokow.md` (dziś jest tylko
    w `raport.md`/`plan.md`, a docelowo to jest informacja „do koordynatora” w karcie).

## SHOULD-FIX

- [ ] `docs/instrukcja-pelnego-testu.md:227-237` (sekcja „Czego NIE zgłaszać”, punkty 1 i 3) — liczby
  „8 wierszy zamiast 4” (bieżniki) i „9 takich pozycji” (EAN w Historii dostępności) pochodzą z pomiaru
  na `db/snapshot.db` wykonanego przy tickecie 141 (`docs/tickets/141-DOCS-runda-decyzyjna-backlog/raport.md:5-6`:
  „pomiar na `db/snapshot.db`”) — czyli tej samej migawce z mtime 2026-08-13, którą `raport.md` TEGO
  ticketu świadomie wykluczył z dokumentu dla liczby 3362, bo „baza stagingu to kopia produkcji
  z 23.09”. Tej samej ostrożności nie zastosowano tutaj: liczby z `wejscie-141.md` weszły do dokumentu
  bez zastrzeżenia, choć `historia_cen` rośnie z każdym importem i dokładna liczba duplikatów EAN
  (podobnie skład par bieżników w słowniku atrybutów) mogła się zmienić między 13.08 a kopią z 23.09.
  - Reason: dokument obiecuje Ani konkretną, policzalną wartość („znajdziesz 9 takich pozycji”) jako
    znany, odłożony defekt — jeśli faktyczna liczba na stagingu jest inna, nie spowoduje to fałszywego
    zgłoszenia usterki (sekcja i tak mówi „nie zgłaszaj”), ale podważa wiarygodność reszty dokumentu,
    skoro `raport.md` deklaruje rygor akurat w tym punkcie dla innej liczby.
  - Suggestion: albo przeformułować na jakościowe („kilka par”, „kilkanaście pozycji”, tak jak już
    zrobiono dla 3362), albo jawnie zaznaczyć, że liczba pochodzi z migawki i może się różnić na
    aktualnych danych.

- [ ] `docs/instrukcja-pelnego-testu.md:34-35` i linia checklisty Selly w Części 2 — cytat „tryb
  wyłączony” w cudzysłowie nie jest dosłownym tekstem UI. Rzeczywisty komunikat na ekranie Selly przy
  `SELLY_TRYB=wylaczony` to „Integracja Selly wyłączona na tym środowisku”
  (`rebuild/frontend/src/pages/selly/BladSekcji.tsx:29`); frazy „tryb wyłączony” nie ma nigdzie w kodzie
  ekranu Selly (`grep` po `rebuild/frontend/src/pages/selly/` i `Selly.tsx` — brak wyniku).
  - Reason: dokument konsekwentnie używa cudzysłowu „…” dla dosłownych etykiet/komunikatów UI (np.
    „Braki w cenniku”, „Nie zapisano zmian”) — w tym jednym miejscu łamie tę konwencję i może skłonić
    Anię do szukania na ekranie frazy, której tam nie ma.
  - Suggestion: zamienić na opis („ekran pokazuje wyjaśnienie, że integracja jest wyłączona na tym
    środowisku”) albo zacytować faktyczny komunikat.

## NICE-TO-HAVE

- [ ] `docs/instrukcja-pelnego-testu.md` — sekcja „Na czym testujesz” podaje „Wersja: najnowsza z gałęzi
  roboczej (`develop`)”, co jest technicznie poprawne jako opis polityki deployu, ale nie mówi Ani, na
  jakim dokładnie stanie stoi staging w chwili, gdy zacznie testować (wg `docs/cutover.md` to `c0ee7a5`
  z 24.09, po czym `develop` poszedł dalej o kolejne PR-y #160/#161). Nie jest to błąd, ale warto
  rozważyć dopisanie „sprawdzimy z Tobą przed testem, czy staging ma najnowszy build”.

## Plan compliance

### Done ✓
- Jeden nowy plik `docs/instrukcja-pelnego-testu.md`, układ zgodny z planem: warunki środowiskowe →
  odesłanie do TEST.2 → odesłanie do przeglądu → „Zanim zaczniesz” → Część 1 (delta 22.09+) → Część 2
  (lista kontrolna) → „Czego NIE zgłaszać” → „Do Twojej decyzji”.
- Wszystkie etykiety UI zweryfikowane w tym review zgadzają się co do znaku z kodem na `develop`:
  filtr/odznaka stagingu (`pages/staging/dane.ts`), tytuły okna „Rozstrzygnij”/„Sprawdź kartę”
  (`polityka.ts`, `OknoRozstrzygniecia.tsx`), siedem komunikatów `odmow()` w `blokady.ts` (w tym
  dokładny cytat blokady nr 3 i nr 2, z poprawną kolejnością pierwszeństwa), kolumna „Blokowane formy
  płatności” i „—” dla MO6 (`formatowanie.tsx`), cztery reguły alertów katalogowych
  (`silnik-katalogu.ts`), etykieta „Braki w cenniku” w `DialogWgrywania.tsx`, wzór wagi gabarytowej
  GEIS (60×50×50 / 10000 = 15 kg), liczba 8 zakładek Konfiguracji, 9 kart z CSV / 2 bez CSV w
  Analityce.
- Trzy blokady Selly (`SELLY_TRYB=wylaczony`, `SELLY_SCHEDULER` nieustawione, brak sekretów) i warunki
  środowiskowe (8329 produktów, migracje 001–013, `IMPORT_SCHEDULER=true`) zgodne z
  `tools/deploy-staging.sh` i audytem w `docs/cutover.md`.
- Granica z TEST.2 zachowana — dokument nie powtarza scenariuszy import/parsery/baza/CSV/Selly, odsyła
  jednym zdaniem na start.
- Trzy znane defekty z `wejscie-141.md` są w sekcji „Czego NIE zgłaszać”, opisane zgodnie z treścią
  wejścia (choć patrz SHOULD-FIX o liczbach ze stałej migawki).
- Liczba 3362 świadomie nie trafiła do dokumentu (potwierdzone w treści — brak jej w pliku).
- Cztery pozycje „Do Twojej decyzji” zgodne z D4 (priorytet narzutu, podział admin/user, #137.2,
  bieżniki), każda z wariantami do zaznaczenia.
- Format „co zmieniliśmy → polecenie → rezultat” z kratkami ✅/❌, bez technikaliów (brak nazw plików
  kodu, zmiennych env, numerów wpisów backlogu w treści dla Ani — sprawdzone `grep`em).

### Missing or deviating ✗
- `docs/karty/TEST.1/karta.md` nie zaktualizowana o stan „zrobione” (zob. BLOCKER) — formalnie ostatni
  punkt Definition of done ticketu nie jest spełniony.

### Definition of done
- [x] `docs/instrukcja-pelnego-testu.md` istnieje, układ „co zmieniliśmy → polecenie → rezultat”,
  kratki ✅/❌
- [x] Ścieżka krytyczna odesłana do TEST.2 jednym zdaniem, bez powtórzenia scenariuszy
- [x] `docs/przeglad-12-widokow.md` odesłany, nie przepisany
- [x] Warunki środowiskowe zgodne z `tools/deploy-staging.sh`/`docs/cutover.md`; trzy blokady Selly
  wymienione
- [x] Ostrzeżenie o starych zgłoszeniach (D1) i o braku CSV po imporcie (`wejscie-144`) obecne
- [x] Sekcja „Do Twojej decyzji” ma cztery pozycje z D4, z wariantami
- [x] Trzy znane defekty z `wejscie-141` opisane jako „nie zgłaszaj”
- [x] Sprostowanie do punktu 8 przeglądu (plik CSV ≠ tabela) obecne w dokumencie
- [x] Etykiety UI zgodne co do znaku z kodem na `develop` (poza jednym miejscem — patrz SHOULD-FIX
  „tryb wyłączony”)
- [x] `git diff --stat` pokazuje wyłącznie `docs/`
- [ ] `docs/karty/TEST.1/karta.md` oznaczona ✅ z sekcją „Dowiezione” — **NIE spełnione**, zob. BLOCKER
- [ ] Gałąź zsynchronizowana z `origin/develop`, PR `MERGEABLE` — nie sprawdzane w tym review (poza
  zakresem code review; do weryfikacji przy pushu)

## Parallel-test concerns

Brak testów automatycznych w tym tickecie (ticket dokumentacyjny, bramki `rebuild/backend/` nie
uruchamiane, zgodnie z planem). Nic do flagowania pod kątem równoległości.

## Overall assessment

Dokument jest solidny i w przytłaczającej większości wierny kodowi na `develop` — sprawdzone
dosłownie etykiety, komunikaty blokad (wraz z poprawną kolejnością pierwszeństwa blokad, co jest
subtelnym i łatwym do pomylenia miejscem) i warunki środowiskowe zgadzają się co do znaku. Forma dla
Ani (krótko, bez technikaliów, kratki, „Do Twojej decyzji”) jest dotrzymana. Jedyny twardy problem to
formalny: `docs/karty/TEST.1/karta.md` nie odzwierciedla ukończenia pracy, co narusza jawną regułę
projektu i punkt Definition of done — do poprawienia przed mergem. Dwa SHOULD-FIX (liczby z tej samej
stałej migawki, której ostrożności raport.md nie zastosował konsekwentnie; niedosłowny cytat „tryb
wyłączony”) warto poprawić, ale nie blokują merge'a — nie spowodują fałszywego zgłoszenia usterki
przez Anię.

</details>

---
Ticket docs: `docs/tickets/149-DOCS-instrukcja-pelnego-testu/`
Zsynchronizowane z `develop` (`6288066`); merge czysty, zakres gałęzi i zmiany z bazy wyłącznie w `docs/`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
