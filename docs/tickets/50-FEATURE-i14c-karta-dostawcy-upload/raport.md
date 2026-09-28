# 50-FEATURE-i14c-karta-dostawcy-upload — raport implementacji

## Summary

Karta dostawcy dostała brakujący przycisk **„Wgraj plik"** (ukryty `input[type=file]` → `FormData`
z polem `plik` → `POST /api/dostawcy/{kod}/upload` → toast), pole „liczba minut" wróciło za furtkę
**„Inna wartość (minuty)…"** zgodnie z oryginałem, a etykieta przycisku synchronizacji została
sprostowana na zgodną z produkcją **„Synchronizuj"**. Dialog admina zostaje funkcjonalnie bez zmian
— decyzja o braku selectu presetów jest utrwalona komentarzem i testem-strażnikiem.

Przy okazji wykryto i naprawiono **bug produkcji**: toast uploadu czyta pola `nowych`/`zmian`,
których trasa nigdy nie zwracała, więc produkcja do dziś wyświetla „undefined nowych, undefined
zmian".

## Changes

- `rebuild/frontend/src/pages/konfiguracja/Dostawcy.tsx`
  - **nowe:** `wgrajPlikDostawcy()` — lokalny klient multipart (`FormData`, pole `plik`,
    `naglowki(false)`, `credentials: "include"`, komunikat błędu z `cialo.error`);
  - **nowe:** typ `WynikUploaduKarty` opisujący czytane pola odpowiedzi;
  - **nowe:** mutacja `upload` + ukryty `input[type=file]` (`accept=".csv,.xml,.xlsx"`,
    `data-testid="input-file-<KOD>"`) i przycisk `data-testid="button-upload-<KOD>"`,
    renderowane dla `sposobDostarczania ∈ {upload, mail}`;
  - `zajety` rozszerzone o `upload.isPending` — jeden stan zajętości dla sync i uploadu, jak oryginał;
  - `StanEdycji` dostaje pole `inna: boolean`; nowy helper `jestPresetem()`;
  - pole minut renderowane warunkowo (`edycja.inna`), select przełącza tryb;
  - etykieta `"Synchronizuj teraz"` → `"Synchronizuj"`;
  - nagłówek modułu i komentarz przy selekcie opisują STAN po zmianie, nie nieistniejące już
    uproszczenie.
- `rebuild/frontend/src/pages/konfiguracja/DialogKonfiguracjiDostawcy.tsx` — **bez zmian
  funkcjonalnych**; komentarz utrwalający decyzję D3 (dlaczego tu NIE ma selectu presetów).
- `rebuild/frontend/test/konfiguracja.dostawcy.test.tsx` — handler uploadu w `zamockujApi`
  (+ parametry `odpowiedzUpload` i `dostawcy`), stała `ODPOWIEDZ_UPLOADU` o kształcie backendu,
  trzy istniejące testy częstotliwości poprawione, dziewięć nowych testów.
- `rebuild/frontend/test/konfiguracja.admin.test.tsx` — test-strażnik decyzji D3.
- `docs/tickets/50-FEATURE-i14c-karta-dostawcy-upload/` — `plan.md`, `raport.md`.

**Nic poza własnością karty nie ruszone** — `git diff --name-only` względem punktu odgałęzienia
zwraca wyłącznie powyższe pliki. `rebuild/backend/**` i `contract/**` nietknięte.

## Deviations from plan

Brak odstępstw od planu. Trzy odstępstwa od ORYGINAŁU są zatwierdzone przez użytkownika i opisane
w `plan.md` (D1, D5, D6) oraz udokumentowane komentarzami w miejscu ich wystąpienia.

Dwie rzeczy warte odnotowania, obie zgodne z planem:
- **Klient uploadu trafił do `Dostawcy.tsx`, nie do `dostawcy.ts`** — `dostawcy.ts` nie jest na
  liście własności karty 14c, a lista jest whitelistą. To nie jest wybór estetyczny; roadmapa
  dostaje notę o luce w tabeli własności.
- **Rebase na `origin/develop` w trakcie pracy** — `develop` dostał commit `7a24349` z blokiem
  Iteracji 14. Podblok 14c dopisujemy do aktualnej wersji roadmapy, nie do tej sprzed rebase'u.

## Test results

- **Gate odbudowy (fixtures/kontrakt): N/D — ticket nie dotyka API.** Zmiana jest wyłącznie
  frontendowa i konsumuje gotowe, niezmienione trasy backendu. `contract/**` i `rebuild/backend/**`
  nietknięte, żadna odpowiedź API nie zmienia kształtu, więc backendowy gate nie ma czego
  rozliczać (bramki backendu zbędne, zgodnie z kartą).
  Obowiązywał natomiast **gate kształtu po stronie FE** i został rozliczony dwoma testami:
  - toast czyta `nowe`/`zmienione` — pola, które trasa REALNIE zwraca
    (`rebuild/backend/src/routes/suppliers.ts:215-222`), z jawną asercją `not.toHaveTextContent("undefined")`;
  - handler MSW rozbiera żądanie przez `request.formData()` i sprawdza nazwę pola `plik` —
    wysłanie JSON-a zamiast multipartu wywróciłoby test.
  Dane widoku nadal pochodzą z `contract/fixtures/GET_suppliers.json` przez `dostawcyZFixtura()`.
- **Unit/komponentowe: ✓ 763 testy w 48 plikach, wszystkie zielone** (`npm test`).
  Sam plik zakładki: 21/21.
- **Lint: ✓** (`npm run lint`, czysto)
- **Typecheck: ✓** (`npm run typecheck` — trzy konfiguracje TS, czysto)
- **Build: ✓** (`npm run build`, 33,6 s; ostrzeżenie o rozmiarze chunka jest sprzed ticketa)
- **Integracyjne/E2E: pominięte świadomie** — ticket nie zmienia backendu, a
  `test/integracja/dostawcy.integracja.test.ts` nie jest w własności karty. Zweryfikowano, że
  żaden istniejący test nie szuka przycisku synchronizacji po TEKŚCIE (wszystkie po
  `data-testid`), więc zmiana etykiety niczego nie wywraca.

## Review fixes applied

Review: **0 BLOCKER**, 4 SHOULD-FIX, 3 NICE-TO-HAVE (`review.md`). Rozliczenie:

- **✓ Naprawione — przełączenie selecta na „Inna wartość" zostawiało porzucony preset w polu.**
  Zweryfikowałem zarzut u źródła: listener `change` w `freq-injection.js:144-146` tylko przełącza
  widoczność, a `customInput.value` jest ustawiane wyłącznie przy budowie popovera i tylko dla
  wartości SPOZA presetów (`:141`). Ręczne przełączenie z presetu odsłania więc w oryginale PUSTE
  pole. Poprawione — to zbliżenie do oryginału, nie nowe odstępstwo, więc tabela D1–D6 bez zmian.
  Dołożone dwa testy: pole puste po przełączeniu z presetu ORAZ pole wypełnione, gdy wartość
  początkowa jest spoza presetów (drugą połowę reguły `:141` wcześniej nic nie pilnowało).
- **✓ Naprawione — brak testu na kliknięcie samego przycisku „Wgraj plik".** Pozostałe testy
  wgrywały plik prosto na ukryty input, więc regresja w `onClick` przeszłaby niezauważona.
  Nowy test ze szpiegiem na `click()` ukrytego pola.
- **✓ Naprawione — `czestotliwoscMinuty: 0` pokazywało „0" zamiast pustego pola** (NICE-TO-HAVE).
  Oryginał opiera warunki na PRAWDZIWOŚCI `currentMin` (`:129`, `:141`), więc zero nigdy nie
  trafiało do pola. Ujednolicone z wariantem `null`.
- **✓ Naprawione — `raport.md` był niezacommitowany.** Wchodzi wraz z poprawkami review.
- **✓ Naprawione — niekonsekwencja w `plan.md`** co do prawa edycji `docs/rebuild-backlog.md`
  (Krok 6 go wymagał, sekcja własności nie wymieniała). Sekcja własności doprecyzowana.
- **Zostawione świadomie — `encodeURIComponent(kod)` jest w `wgrajPlikDostawcy`, a nie ma go
  w bliźniaczym `wgrywanie.ts::wgrajPlik`.** Nasza wersja jest poprawniejsza, a `wgrywanie.ts`
  należy do równolegle idącej karty 14a i nie wolno go ruszać. Ujednolicenie po zmergowaniu obu
  kart jest już w Follow-up jako scalenie duplikatu.
- **Zostawione świadomie — brak ikony przy przycisku „Wgraj plik"** (oryginał ma ikonę `gd`).
  Reviewer sam zaznacza, że to dług sprzed ticketa: przycisk „Synchronizuj" też jest bez ikony
  od wcześniejszej sesji. Ujednolicanie ikonografii karty to osobny temat.
- **Zostawione świadomie — brak testu na szybkie podwójne kliknięcie.** Ochrona przez
  `disabled={zajety}` jest architektonicznie identyczna z synchronizacją i zapisem na tej samej
  karcie; reviewer nie blokuje.

Bramki po poprawkach: lint ✓, typecheck ✓, build ✓, **763 testy w 48 plikach ✓** (przybyły dwa).

## Breaking changes

Brak zmian łamiących API ani kontraktu. Trzy zmiany widoczne dla użytkownika, wszystkie
zatwierdzone:

1. Przycisk synchronizacji nazywa się teraz **„Synchronizuj"** — `docs/instrukcja-testow-I3.md`
   mówi Ani „Synchronizuj teraz" w ~10 miejscach i **wymaga poprawki w bloku 14d**.
2. Pole „liczba minut" nie jest już widoczne od razu — trzeba wybrać „Inna wartość (minuty)…".
3. Na kartach `upload`/`mail` pojawia się nowy przycisk „Wgraj plik".

## Follow-up

Rzeczy zauważone i ŚWIADOMIE odłożone — nie wciągane do tej karty:

- **Poprawka `docs/instrukcja-testow-I3.md`** („Synchronizuj teraz" → „Synchronizuj", opis nowego
  zachowania pola minut, opis przycisku „Wgraj plik" na karcie) — **blok 14d**, który z definicji
  idzie po 14a–14c.
- **Brak fixture dla `POST /api/dostawcy/{kod}/upload`.** `contract/openapi.yaml` ma dla tej trasy
  tylko `type: object` z notką „do zamrożenia w 2.4 fixtures". Trasa jest już używana przez dwa
  ekrany (zakładka „Wgrywanie ręczne" i teraz karta dostawcy), więc zamrożenie jej kształtu ma
  realną wartość. Poza własnością tej karty (`contract/**`).
- **`dostawcy.ts` pominięty w tabeli własności 14c** w roadmapie, mimo że jest modułem wspierającym
  `Dostawcy.tsx`. Do poprawienia w roadmapie, żeby kolejna karta nie wpadła w ten sam problem.
- **Bug `nowych`/`zmian` nadal jest w produkcji.** Naprawiliśmy odbudowę, ale żywy bundle
  produkcji dalej pokazuje „undefined nowych, undefined zmian". Do ewentualnego zgłoszenia Ani —
  poza zakresem odbudowy.
- **Duplikacja klienta uploadu** — `wgrywanie.ts::wgrajPlik` i `wgrajPlikDostawcy` robią to samo.
  Scalenie jest możliwe dopiero, gdy 14a i 14c będą zmergowane; dziś byłoby złamaniem
  rozłączności kart. Karta wprost nakazuje osobną implementację.
- **„Status dostawcy w dwóch polach"** (backlog #18) — poza zakresem I14, czeka na osobną decyzję.
