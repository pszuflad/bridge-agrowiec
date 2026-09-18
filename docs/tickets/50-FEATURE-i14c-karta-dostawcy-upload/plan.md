# 50-FEATURE-i14c-karta-dostawcy-upload — karta dostawcy: „Wgraj plik" i pole częstotliwości

> Status: Draft → **Approved** → Implemented → Shipped
> Branch: `feature/50-i14c-karta-dostawcy-upload`
> Worktree: `.worktrees/50-FEATURE-i14c-karta-dostawcy-upload`
> Blok roadmapy: **Iteracja 14, podblok 14c** (`docs/rebuild-roadmap.md:2193-2207`)

## Opis ticketa

Karta 14c z Iteracji 14. Źródło: uwagi Ani z testów Iteracji 3 (§5 i §10 `docs/instrukcja-testow-I3.md`).
Trzy pozycje + dwa rozstrzygnięcia:

1. Na kartach dostawców brakuje przycisku **„Wgraj plik"** — Ania zgłasza wprost: „tam, gdzie są
   dostawcy z wgrywaniem ręcznym, obok powinien być przycisk". Backend odbudowy jest GOTOWY.
2. Pole „liczba minut" jest w odbudowie widoczne ZAWSZE obok selectu presetów; oryginał odsłaniał
   je dopiero po wybraniu „Inna wartość (minuty)…". Stąd uwaga Ani „w nowym jest wartość
   w minutach, w starym lista wyboru".
3. Ta sama rzecz ma dwa różne UI: karta dostawcy (select + pole) kontra Konfiguracja → Admin
   (samo „Częstotliwość (minuty)") — do decyzji użytkownika.
4. Do sprawdzenia, nie do automatycznej zmiany: etykieta przycisku synchronizacji.

## Kontekst

### Własność plików — karty 14a/14b/14c idą RÓWNOLEGLE

Wolno zmieniać **wyłącznie**:
`rebuild/frontend/src/pages/konfiguracja/Dostawcy.tsx`,
`rebuild/frontend/src/pages/konfiguracja/DialogKonfiguracjiDostawcy.tsx`,
`rebuild/frontend/test/konfiguracja.dostawcy.test.tsx`,
`rebuild/frontend/test/konfiguracja.admin.test.tsx`,
`docs/tickets/50-FEATURE-i14c-karta-dostawcy-upload/**`, plus podblok 14c w `docs/rebuild-roadmap.md`.

⚠ **`rebuild/frontend/src/pages/konfiguracja/dostawcy.ts` NIE JEST na liście własności**, mimo że
jest modułem wspierającym `Dostawcy.tsx` i naturalnym miejscem na klienta uploadu. Lista jest
whitelistą, nie blacklistą — dlatego **klient uploadu ląduje wewnątrz `Dostawcy.tsx`**, a nie
w `dostawcy.ts`. To nie jest wybór estetyczny, tylko respektowanie rozłączności kart.
Do roadmapy idzie nota, że tabela własności 14c pominęła `dostawcy.ts`.

NIE DOTYKAMY: `Wgrywanie.tsx`, `detekcja.ts`, `wgrywanie.ts`, `test/konfiguracja.test.tsx` (14a) ·
`pages/Staging.tsx`, `pages/staging/**`, `test/staging.test.tsx` (14b) · `rebuild/backend/**`,
`contract/**`.

### Ustalenia z weryfikacji oryginału (zrobione w tej sesji, nie przepisane z karty)

**Żywy bundle produkcji** to `mirror/frontend/assets/index-PRICEFMT1783512500.js`
(potwierdzone `grep -o 'src="./assets/index[^"]*"' mirror/frontend/index.html`). Sprawdzony,
bo `deminified/frontend-index.js` jest z 13.08, sprzed czterech łatek.

- **Ścieżka uploadu jest w żywym bundlu bajt w bajt taka jak w deminifikacie** — żadna z łatek
  jej nie ruszyła. Warunek renderowania `sposobDostarczania ∈ {"upload","mail"}`, ukryty
  `<input type="file" accept=".csv,.xml,.xlsx">`, `FormData` z polem `"plik"`,
  `POST /api/dostawcy/{kod}/upload`, `credentials: "include"`, `data-testid`
  `input-file-${kod}` i `button-upload-${kod}`.
- **Etykieta przycisku synchronizacji w produkcji to „Synchronizuj"**, nie „Synchronizuj teraz"
  (`grep -o 'Synchronizuj[a-zęą ]\{0,10\}'` na żywym bundlu → jedno trafienie: `Synchronizuj`).
  Rozjazd z pkt. 4 karty jest **realny**. Warunek renderowania (`sposobDostarczania === "url"`)
  odbudowa ma już zgodny z oryginałem.

### ⚠ Bug w produkcji, wykryty w tej sesji — zmienia pkt 1 karty

Oryginalny toast składa opis z pól, których **nigdy nie było w odpowiedzi**:

```js
description: `${o.liczbaProduktow} produktów, ${o.nowych} nowych, ${o.zmian} zmian`
```

Trasa `POST /api/dostawcy/:kod/upload` w `mirror/backend/index.cjs` odsyła
`{ok, nazwaPliku, liczbaProduktow, ...tk(), podglad}`, a `tk()` zwraca `nowe`, `zmienione`,
`wycofane`, `bezZmian`, `doStagingu`, `autoZatwierdzone`. `grep -o 'nowych:'` i `grep -o 'zmian:'`
po całym bundlu backendu — **zero trafień**. Produkcja od zawsze wyświetla
„N produktów, **undefined** nowych, **undefined** zmian".

`tk()` ma w żywym bundlu **jedną** definicję (`grep -c 'function tk('` → 1), więc nie jest to
przypadek cieniowania duplikatem opisany w `CLAUDE.md`. Backend odbudowy
(`rebuild/backend/src/routes/suppliers.ts:215-222`) zwraca `{ok, nazwaPliku, liczbaProduktow,
...statystyki, podglad}` — dokładnie te same nazwy co oryginał.

### ⚠ Pułapka, której karta nie przewidziała — ukrywanie pola minut kontra „brak harmonogramu"

Oryginalny `freq-injection.js` to **osobny popover patchujący WYŁĄCZNIE `czestotliwoscMinuty`**
(`:100-108`). Odbudowa scaliła to w jeden formularz zapisujący **cztery pola naraz** (URL,
częstotliwość, sposób dostarczania, status). Do tego w oryginale **nie da się wyczyścić
harmonogramu**: puste pole custom wpada w `if (!val || val < 1) { ...; return }` (`:167-171`)
i zapis jest blokowany. Odbudowa to potrafi (puste = `null`) i ma na to test.

Dokładne zachowanie oryginału (`freq-injection.js:124-147`):
- opcje = 11 presetów (`OPTIONS_MIN`) + `custom` „Inna wartość (minuty)...";
- `hasCurrent` = true, gdy `currentMin` jest prawdziwe i równe któremuś presetowi → ta opcja
  zaznaczona;
- `if (!hasCurrent && currentMin) select.value = 'custom'`;
- **gdy `currentMin` jest null/0 — ŻADNA gałąź nie ustawia `select.value`**, więc select zostaje
  na pierwszej opcji, czyli **„5 min"**;
- `customInput` widoczny dokładnie wtedy, gdy `select.value === 'custom'`.

Odtworzenie tego 1:1 znaczyłoby, że dostawca z `czestotliwoscMinuty: null` po wejściu w edycję
ma w selekcie „5 min", a ponieważ nasz formularz zapisuje wszystkie pola razem — **zmiana samego
statusu po cichu włączyłaby mu odpytywanie co 5 minut**. Stąd decyzja D5.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Ticket nie zmienia kontraktu ani fixtures** — to zmiana wyłącznie frontendowa, konsumująca
istniejące, gotowe trasy backendu. `contract/**` nie jest ruszane (i nie wolno go ruszać).

Trasy konsumowane przez zmieniony kod:

| Metoda + ścieżka | Rola w tickecie | Fixture |
|---|---|---|
| `POST /api/dostawcy/{kod}/upload` | **nowa ścieżka na FE** — przycisk „Wgraj plik" | brak fixture; `contract/openapi.yaml:19314-19325` ma dla niej tylko `type: object` z notką „do zamrożenia w 2.4 fixtures" |
| `GET /api/dostawcy` | źródło karty (`czestotliwoscMinuty`, `sposobDostarczania`, numeryczne `id`) | `contract/fixtures/GET_suppliers.json` — używany przez testy |
| `PATCH /api/dostawcy/{id}` | zapis edycji karty (bez zmian w tym tickecie) | — |
| `PATCH /api/admin/supplier-config/{kod}` | dialog admina (bez zmian funkcjonalnych) | `contract/fixtures/GET_admin_supplier-config.json` |

**GATE odbudowy (fixtures/kontrakt) nie obowiązuje w wersji backendowej** — ticket nie dotyka
`rebuild/backend/**` ani `contract/**` i nie zmienia żadnej odpowiedzi API. Obowiązuje natomiast
**gate kształtu odpowiedzi po stronie FE**: toast musi czytać pola, które trasa REALNIE zwraca
(`nowe`/`zmienione`), co weryfikujemy testem asertującym na kształcie z
`rebuild/backend/src/routes/suppliers.ts`. Gdyby w trakcie okazało się, że trzeba ruszyć
`contract/fixtures/` — STOP i pytanie do użytkownika (nauka z 13c: fixtures są wspólne dla BE i FE).

Bramki backendu są zbędne (`rebuild/backend/**` nietknięty).

## Decisions

Wszystkie poniższe zapadły w Q&A z użytkownikiem (dwie rundy).

- **D1 — Treść toasta uploadu: NAPRAWIAMY, nie odtwarzamy buga.** Opis brzmi
  `„{liczbaProduktow} produktów, {nowe} nowych, {zmienione} zmienionych"`, czytany z pól, które
  trasa realnie zwraca. *Za:* wierne przepisanie bundla dałoby „undefined nowych, undefined zmian",
  co Ania i tak zgłosiłaby jako usterkę odbudowy; roadmapa 14c już to sugeruje zdaniem „treść
  toasta dopasować do tego, co realnie zwraca kontrakt, nie do nazw pól z bundla".
  *Przeciw:* to **ŚWIADOME ODSTĘPSTWO** od zachowania produkcji — idzie do backlogu jako nowy wpis
  (dziś go nie ma) i do roadmapy.
- **D2 — Etykieta przycisku synchronizacji: „Synchronizuj teraz" → „Synchronizuj".**
  *Za:* wierność 1:1 z żywym bundlem, czyli domyślna reguła projektu.
  *Przeciw:* `docs/instrukcja-testow-I3.md` mówi Ani „Synchronizuj teraz" w ~10 miejscach.
  Poprawka instrukcji **należy do bloku 14d** (DOCS, idzie po 14a–14c) — zgłaszamy ją tam jako
  zadanie, nie ruszamy cudzego pliku z tej karty.
- **D3 — Dialog admina zostaje surowy** (samo pole „Częstotliwość (minuty)", bez selectu presetów).
  *Za:* to osobna trasa (`PATCH /api/admin/supplier-config/{kod}`) o innej semantyce — wysyła
  tylko pola ZMIENIONE i rozróżnia „nie ruszaj" od „wyczyść" przez `hasOwnProperty`; select
  wymusza wartość i psułby to rozróżnienie. Dodatkowo **w oryginale nie ma żadnego React UI dla
  tej trasy**, więc nie ma czego odtwarzać ani z czym ujednolicać. *Przeciw:* dwa różne UI do
  pozornie tej samej rzeczy — dlatego różnicę **dokumentujemy komentarzem w kodzie**, żeby
  następna sesja nie „poprawiła" tego z rozpędu.
- **D4 — Wynik uploadu pokazujemy TOASTEM**, jak oryginał (`useToast` jest w odbudowie gotowy
  i zamontowany od 4b). *Za:* 1:1 z produkcją. *Przeciw:* na jednej karcie dwa kanały informowania
  (synchronizacja leci przez lokalny `komunikat`, bo przerobiła ją wcześniejsza sesja) — przyjęte
  świadomie.
- **D5 — Pole minut widoczne ⟺ select stoi na „Inna wartość"; dostawca bez harmonogramu startuje
  na „Inna wartość" z pustym polem.** *Za:* reguła widoczności jest 1:1 z oryginałem
  (`freq-injection.js:138-147`), a jedyna różnica — wartość POCZĄTKOWA dla `czestotliwoscMinuty:
  null` — jest **wymuszona**: odtworzenie „5 min" sprawiłoby, że zapis dowolnego innego pola
  po cichu włącza harmonogram (patrz „Pułapka" wyżej). Zachowuje też semantykę „puste = brak
  harmonogramu" i istniejący test. *Przeciw:* odstępstwo w wartości początkowej — **ŚWIADOME**,
  udokumentowane w kodzie i w roadmapie.
- **D6 — `<input type="file">` jest czyszczony po wysyłce** (`e.target.value = ""`).
  *Za:* oryginał tego nie robi, więc wgranie tego samego pliku drugi raz z rzędu nie wywołuje
  `onChange` i interfejs wygląda na zawieszony; Ania realnie poprawia plik u dostawcy i wgrywa go
  ponownie pod tą samą nazwą. *Przeciw:* drobne **ŚWIADOME ODSTĘPSTWO**, udokumentowane w kodzie.

### Zestawienie świadomych odstępstw od oryginału (do backlogu i roadmapy)

| # | Odstępstwo | Uzasadnienie |
|---|---|---|
| D1 | toast czyta `nowe`/`zmienione` zamiast nieistniejących `nowych`/`zmian` | produkcja pokazuje „undefined"; naprawa zamiast odtworzenia buga |
| D5 | dostawca bez harmonogramu startuje na „Inna wartość", nie na „5 min" | inaczej zapis innego pola po cichu włącza polling co 5 min |
| D6 | reset `<input type="file">` po wysyłce | inaczej powtórne wgranie tego samego pliku nie działa |
| (D4) | wynik uploadu w toaście, synchronizacji w linijce — dwa kanały na jednej karcie | konsekwencja wcześniejszej decyzji o `komunikat` dla sync |

## Implementation plan

### Krok 1 — przycisk „Wgraj plik" (`Dostawcy.tsx`)

1. W module (nie w `dostawcy.ts` — patrz Własność plików) dopisać lokalny klient:
   ```ts
   type WynikUploaduKarty = {
     ok: boolean; nazwaPliku: string; liczbaProduktow: number;
     nowe: number; zmienione: number;
   };
   async function wgrajPlikDostawcy(kod: string, plik: File): Promise<WynikUploaduKarty>
   ```
   `FormData` z polem `"plik"`, `POST ${BAZA_API}/api/dostawcy/${kod}/upload`,
   `headers: naglowki(false)` (⚠ **nie** `application/json` — zepsułoby multipart),
   `credentials: "include"`. Błąd: komunikat z `cialo.error`, w ostateczności własny.
   Wzorzec (czytany, NIE importowany — własność 14a): `wgrywanie.ts::wgrajPlik`.
2. W `KartaDostawcy`: `useRef<HTMLInputElement>(null)`, `useToast()`, mutacja `upload`.
3. Render dla `sposobDostarczania ∈ {"upload","mail"}` — ukryty
   `<input type="file" accept=".csv,.xml,.xlsx" className="hidden" data-testid={`input-file-${kod}`}>`
   + `<Button variant="outline" size="sm" data-testid={`button-upload-${kod}`}>Wgraj plik</Button>`
   wołający `ref.current?.click()`. Umiejscowienie: w tym samym rzędzie akcji, obok
   „Synchronizuj"/„Zmień" (oryginał: zaraz po przycisku sync).
4. `onSuccess`: `toast({ title: "Plik wczytany", description: "…" })` wg **D1** + `odswiez()`
   (istniejący helper unieważnia `["/api/dostawcy"]` i `["/api/staging"]`).
   ⚠ Oryginał unieważnia `["/api/suppliers"]`, ale odbudowa pobiera ten ekran kluczem
   `["/api/dostawcy"]` — użycie klucza z oryginału NIE odświeżyłoby widoku. Powód udokumentowany
   już w nagłówku `Dostawcy.tsx`.
5. `onError`: `toast({ title: "Błąd", description: e.message, variant: "destructive" })`.
6. Reset inputa wg **D6**. Przycisk `disabled` przy `zajety` — rozszerzyć `zajety`
   o `upload.isPending` (oryginał dzieli jeden stan zajętości między sync i upload).

### Krok 2 — pole minut odsłaniane przez „Inna wartość" (`Dostawcy.tsx`)

1. `StanEdycji` dostaje pole `inna: boolean`.
2. `stanZDostawcy`: `inna` = `true`, gdy `czestotliwoscMinuty == null` **lub** nie jest presetem;
   `false`, gdy jest presetem. (Wariant „null → inna" to **D5**.)
3. `value` selecta = `edycja.inna ? "inna" : edycja.czestotliwosc`.
4. `onChange` selecta: `"inna"` → `{ ...edycja, inna: true }` (wartość zostaje, użytkownik ją
   edytuje); preset → `{ ...edycja, inna: false, czestotliwosc: e.target.value }`.
5. `<Input data-testid={`input-freq-${kod}`}>` renderowany **tylko gdy `edycja.inna`**.
6. Walidacja w `zapisz()` bez zmian (puste = `null`, `< 1` = błąd) — nadal osiągalna, bo pole
   jest widoczne dokładnie wtedy, gdy wartość jest wpisywana ręcznie.
7. **Zaktualizować komentarz** przy selekcie — dziś opisuje uproszczenie „pole zawsze widoczne",
   które właśnie znika. Nowy komentarz ma nazwać regułę oryginału i odstępstwo D5.

### Krok 3 — etykieta „Synchronizuj" (`Dostawcy.tsx`)

`Dostawcy.tsx:213`: `"Synchronizuj teraz"` → `"Synchronizuj"`. Stan ładowania („Synchronizuję…")
zostaje — to już wcześniejsze odstępstwo odbudowy (oryginał animuje ikonę zamiast zmieniać tekst)
i ticket go nie rusza.

### Krok 4 — dialog admina (`DialogKonfiguracjiDostawcy.tsx`)

**Bez zmian funkcjonalnych.** Dopisać komentarz przy polu „Częstotliwość (minuty)"
(`:126-134`) utrwalający **D3**: dlaczego tu NIE ma selectu presetów i dlaczego to nie jest
przeoczenie.

### Krok 5 — testy

`rebuild/frontend/test/konfiguracja.dostawcy.test.tsx`:
- **do poprawki:** „pozwala wpisać wartość spoza presetów" i „puste pole częstotliwości = `null`"
  — obie sięgają po `input-freq-*` bez wybrania „inna"; dodać wcześniejszy `selectOptions(…, "inna")`
  tam, gdzie dostawca startuje z presetu;
- **nowe:** pole minut jest UKRYTE przy presecie i odsłania się po wyborze „Inna wartość";
- **nowe:** dostawca bez harmonogramu startuje na „Inna wartość" z pustym polem (**D5**);
- **nowe:** przycisk „Wgraj plik" jest przy `upload` i `mail`, a NIE ma go przy `url`;
- **nowe (GATE):** klik → wysyłka `multipart/form-data` z polem `plik` na
  `POST /api/dostawcy/{kod}/upload` — handler MSW czyta `await request.formData()` i sprawdza
  nazwę pola oraz kod dostawcy w URL-u;
- **nowe (GATE D1):** toast „Plik wczytany" pokazuje liczby z pól `nowe`/`zmienione`, czyli tych,
  które trasa realnie zwraca — a NIE „undefined";
- **nowe:** błąd uploadu daje toast `destructive` z komunikatem z ciała odpowiedzi.

`rebuild/frontend/test/konfiguracja.admin.test.tsx`:
- **nowe:** dialog admina ma surowe pole liczbowe i NIE ma selectu presetów — strażnik decyzji
  **D3**, żeby następna sesja nie ujednoliciła tego „dla spójności".

Wzorzec testu z plikiem w jsdom jest już w repo (`test/konfiguracja.test.tsx` — czytany, nie
ruszany; to własność 14a).

### Krok 6 — docs

Podblok **14c** w `docs/rebuild-roadmap.md` (blok Iteracja 14 **już istnieje**, `:2116-2232`):
przepisać z zamiaru na STAN (data + ID ticketa), wpisać zakres faktycznie dowieziony, rozstrzygnąć
pkt 4 (etykieta) faktem z żywego bundla. Nota **do bloku 14d** (nie do 14c): instrukcja testów
wymaga poprawki „Synchronizuj teraz" → „Synchronizuj" w ~10 miejscach. Nota o pominięciu
`dostawcy.ts` w tabeli własności 14c. Nowe wpisy w `docs/rebuild-backlog.md` dla odstępstw D1/D5/D6.
**NIE ruszamy tablicy postępu §4** — wiersz iteracji zakłada 14d.

## Testing strategy

Bramki (`rebuild/frontend/`): `npm run lint && npm run typecheck && npm run build && npm test`
— wszystko zielone. Bramki backendu zbędne (`rebuild/backend/**` nietknięty).

Weryfikujemy:
1. **Kształt odpowiedzi uploadu** — test asertuje, że toast czyta `nowe`/`zmienione`; to jest
   nasz odpowiednik gate'u dla D1. Wartości w mocku MSW ustawione wg kształtu z
   `rebuild/backend/src/routes/suppliers.ts:215-222`.
2. **Multipart** — handler MSW czyta `request.formData()` i sprawdza pole `plik`; bez tego test
   „przeszedłby" nawet przy wysłaniu JSON-a.
3. **Warunki renderowania** — upload przy `upload`/`mail`, sync tylko przy `url`.
4. **Reguła widoczności pola minut** i wariant „bez harmonogramu" (D5).
5. Dane z `contract/fixtures/GET_suppliers.json` przez istniejący helper `dostawcyZFixtura()` —
   widok sprawdzany przeciwko kształtowi, który realnie oddaje produkcja.

Pomijamy: testy integracyjne z prawdziwym backendem (`test/integracja/**`) — ticket nie zmienia
backendu, a istniejący `dostawcy.integracja.test.ts` nie jest w naszej własności. E2E — brak
w projekcie dla tego ekranu.

## Out of scope

- **„Status dostawcy w dwóch polach"** (ustawienie ręczne + wyliczony status techniczny) —
  propozycja Ani z §12, backlog **#18**. Rusza BE + schemat + kontrakt, czeka na osobną decyzję
  i osobną kartę.
- Poprawka `docs/instrukcja-testow-I3.md` („Synchronizuj teraz" → „Synchronizuj") — **blok 14d**.
- Zamrożenie fixture dla `POST /api/dostawcy/{kod}/upload` — `contract/**` poza własnością karty.
- Zakładka „Wgrywanie ręczne" i jej dialog (14a), ekran Staging (14b).
- Ujednolicanie klienta uploadu z `wgrywanie.ts` — świadomie osobna, samodzielna implementacja
  (karta mówi wprost: „NIE współdzieli komponentu z dialogiem z zakładki Wgrywanie ręczne").

## Definition of done

- [ ] Przycisk „Wgraj plik" renderuje się przy dostawcach `upload` i `mail`, nie renderuje przy `url`
- [ ] Klik otwiera wybór pliku (`accept=".csv,.xml,.xlsx"`) i wysyła `FormData` z polem `plik`
      na `POST /api/dostawcy/{kod}/upload`
- [ ] Sukces → toast „Plik wczytany" z liczbami z REALNYCH pól odpowiedzi (`nowe`/`zmienione`),
      bez „undefined"; unieważnione `["/api/dostawcy"]` i `["/api/staging"]`
- [ ] Błąd → toast `destructive` z komunikatem z ciała odpowiedzi
- [ ] `<input type="file">` wyczyszczony po wysyłce (D6)
- [ ] Pole „liczba minut" widoczne dokładnie wtedy, gdy select stoi na „Inna wartość (minuty)…"
- [ ] Dostawca bez harmonogramu startuje na „Inna wartość" z pustym polem; zapis innego pola
      NIE włącza mu harmonogramu (D5)
- [ ] Nadal da się wyczyścić harmonogram (puste pole → `czestotliwoscMinuty: null`)
- [ ] Etykieta przycisku synchronizacji to „Synchronizuj"
- [ ] Dialog admina bez zmian funkcjonalnych, decyzja D3 utrwalona komentarzem + testem
- [ ] Komentarz przy selekcie częstotliwości opisuje STAN (reguła oryginału + odstępstwo D5),
      a nie nieistniejące już uproszczenie
- [ ] `npm run lint && npm run typecheck && npm run build && npm test` — zielone
- [ ] Podblok 14c w roadmapie opisuje STAN; nota dla 14d wpisana DO BLOKU 14d; backlog uzupełniony
      o D1/D5/D6
- [ ] Żaden plik spoza własności karty nie ruszony (`git diff --name-only` sprawdzony)
