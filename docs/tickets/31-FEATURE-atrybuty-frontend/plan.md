# 31-FEATURE-atrybuty-frontend — Iteracja 7b: widok `/atrybuty` + słownik w dialogu reguł

> Status: Draft
> Branch: `feature/31-atrybuty-frontend`
> Worktree: `.worktrees/31-FEATURE-atrybuty-frontend`

## Opis ticketa

Iteracja 7, sesja 7b (FRONTEND). Natywny widok `/atrybuty` w Reakcie (TanStack Query) zamiast
placeholdera — pełen CRUD słownika i workflow kolejki pending na 18 operacjach backendu z 7a,
z parytetem wobec `pending-injection.js` (57 KB) BEZ samego skryptu (bez React Fiber
i MutationObservera). Dodatkowo CZĘŚĆ B: domknięcie degradacji z I4b — dialog reguł w `/narzuty`
zasila listy ze słownika atrybutów zamiast z danych produktów.

⚠ Sesja 8b (`30-FEATURE-selly-panel-frontend`) pracuje równolegle na `src/pages/Katalog.tsx`,
`src/pages/katalog/eksport.ts`, `test/katalog*.test.*` i stronach `/selly` — TE PLIKI SĄ NIETYKALNE.
Część katalogowa Iteracji 7 jest świadomie wydzielona do sesji 7c.

## Kontekst

**Ekran produkcyjny ma TRZY warstwy, nie dwie** (ustalenie tej sesji, mapa kodu wymienia tylko
injection):
1. bazowy widok React (`deminified/frontend-index.js:27277-27650`) — kafle, dialogi „Nowy rodzaj"
   / „Dodaj atrybut", tabela wartości; działa na lokalnych tablicach `Ae`/`dt`, nie na API;
2. **mostek wbudowany w bundle** (`:9960-10268`) — `setQueryDefaults` + `setQueryData` na martwych
   kluczach `["/api/attributes"]` / `["/api/attribute-kinds"]`, zasilany `fetch("/panel/api/atrybuty")`,
   plus **write-through**: opatchowane `Hb`/`Qb`/`Gb` wysyłają POST/PUT/DELETE na
   `/panel/api/atrybuty/wartosci`, a `window.__atrybutyAddRodzaj` — POST na `/rodzaje`.
   To dlatego produkcja realnie zapisuje mimo „fałszywego" Query key;
3. `mirror/frontend/assets/pending-injection.js` — przejmuje `<main>`, chowa kafle bazowego
   Reacta, zostawia tylko `<h1>Atrybuty</h1>` i kontener przycisków, i renderuje własny DOM.

**Co realnie widzi Ania** (efekt złożony — to jest wzorzec parytetu):
nagłówek + `Nowy rodzaj` · `Dodaj wartość` (injection podmienia napis z „Dodaj atrybut") ·
`Do akceptacji [badge]` → siatka kafli rodzajów (topbar „● Zsynchronizowane z DB",
„N rodzajów, M wartości", `Odśwież`; kafel: label, opis, licznik wartości, tag `wbudowany`/`własny`;
pod spodem sekcja „Sieroty w DB") → klik w kafel = panel wartości („← Wróć do kafli", pole dodawania,
szukajka, filtr źródła, tabela Wartość/Źródło/Akcje: `Podgląd`, `Edytuj`, `Usuń`) ·
`Do akceptacji` = panel kolejki (filtr rodzaju z licznikami, szukajka, „Wyświetlono X z Y",
`Wyczyść pending: <rodzaj>`, `Wyczyść wszystkie pending (N)`, tabela
Rodzaj/Wartość/Wystąpień/Sugerowane aliasy/Akcje: `Akceptuj`, `Edytuj`, `Odrzuć`;
chip aliasu = akceptacja jako alias; licznik wystąpień = modal produktów).

**Nieosiągalne w produkcji** (ustalone grafem wywołań, nie nazwą): `DELETE /rodzaje/{value}` —
przycisk „Usuń rodzaj" istnieje tylko w bazowym Reakcie, mostek go NIE patchuje na API, a injection
chowa kafle; `PUT /rodzaje/{value}` — zero konsumentów w całym froncie; `POST /scan-pending` —
zero konsumentów, skan odpala backend po `POST /api/staging/accept`.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

Ticket nie zmienia backendu — konsumuje 13 ścieżek / 18 operacji zamkniętych w 7a
(`contract/openapi.yaml:333-530`, wszystkie za `requireAuth`, błędy `{ok:false,error}`).
Fixtures są **kontraktem kształtu dla typów TS i parsowania** oraz źródłem danych dla MSW:

| Fixture | Kształt wiążący |
|---|---|
| `GET_atrybuty.json` | `{ok, rodzaje:[{value,label,opis,core,utworzony}], wartosci:[{id,rodzaj,wartosc}]}`; `core` to **liczba** 0/1 |
| `GET_atrybuty_rodzaje.json` | jw. **bez `utworzony`** — widok nie może na nim polegać |
| `GET_atrybuty_wartosci.json` | `{ok, wartosci:[{id,rodzaj,wartosc}]}` — **bez `origin`** |
| `GET_atrybuty_liczniki.json` | **goła mapa** `"<rodzaj>::<wartosc>": liczba`, BEZ `ok` — osobna ścieżka parsowania |
| `GET_atrybuty_pending.json` | `{ok, count:498, items:[{id,rodzaj,wartosc,ile_wystapien,pierwszy_import,ostatni_import,dostawcy,sugerowane_aliasy:[{wartosc,podobienstwo}]}]}` |
| `GET_atrybuty_uzycie.json` | nagrany jako **400** `{ok:false,error:"Nieznany rodzaj atrybutu: undefined"}` — NIE pokazuje kształtu sukcesu; `{ok,count,products}` bierzemy z `routes/atrybuty.ts:296` |

CZĘŚĆ B dokłada `GET /api/suppliers` (`GET_suppliers.json`) i `GET /api/products` (bez zmian).
Klucze fixtures są `snake_case` i backend 7a je odtwarza (zapytania idą surowym `sql` z jawnymi
kolumnami, nie Drizzle `select()` bez projekcji) — pułapka z `CLAUDE.md` tu nie występuje,
ale typy TS muszą używać `ile_wystapien`, `sugerowane_aliasy`, `pierwszy_import`, nie camelCase.

**Kody spoza kontraktu, które UI musi obsłużyć** (backlog #43, luka kontraktu nie kodu):
403 „Nie można usunąć wbudowanego rodzaju"; 409 „Rodzaj '<v>' już istnieje" / „Taka wartość już
istnieje dla tego rodzaju"; 404 „Nie znaleziono" / „Pozycja pending nie istnieje";
400 m.in. „Kanoniczna "<k>" nie istnieje w katalogu <r>".

## Decisions

Wszystkie wg rekomendacji Mastera, zatwierdzone przez użytkownika („wyduch rekomendacji", 2026-09-04).

- **D1. Nawigacja 1:1 z produkcją** — kafle → panel wartości („← Wróć do kafli"), kolejka jako
  osobny widok przełączany przyciskiem `Do akceptacji` z badge'em. Odrzucone: zakładki `Tabs`
  (czytelniejsze, ale to inny ekran niż produkcyjny).
- **D2. ODSTĘPSTWO: `window.prompt`/`confirm` → dialogi Radix.** Oryginał robi edycję wartości,
  edycję pozycji pending, powód odrzucenia i wszystkie potwierdzenia natywnymi oknami przeglądarki.
  Zastępujemy je dialogami, **zachowując dosłownie te same teksty i przepływ**. Uzasadnienie:
  celem iteracji jest „natywnie w Reakcie", a `prompt()` w drzewie React to obcy twór; teksty
  zostają, więc parytet treści jest zachowany.
- **D3. Kafel „Wszystkie atrybuty" — NIE odtwarzamy.** Istnieje tylko w bazowym Reakcie, injection
  go chowa, Ania go nie widzi. Odtworzenie byłoby nową decyzją produktową, nie parytetem.
- **D4. ODSTĘPSTWO: filtr „Źródło" (`origin`) pominięty.** Żaden endpoint nie zwraca `origin`
  (potwierdzone w `atrybuty_module.cjs:185-196` i w fixture), więc w produkcji filtr zawsze pokazuje
  „user" — jest martwy. Pomijamy filtr i kolumnę; wpis do backlogu.
- **D5. CRUD rodzajów tylko w zakresie osiągalnym w produkcji:** dodawanie TAK
  (`POST /rodzaje` — write-through mostka), edycja i usuwanie rodzaju NIE. `PUT`/`DELETE`
  `/rodzaje/{value}` oraz `POST /scan-pending` zostają bez konsumenta w UI — zapisane w roadmapie
  jako fakt, nie jako zaległość.
- **D6. Kolejka bez paginacji i wirtualizacji** — 1:1 z injection: pełne 498 pozycji, filtr rodzaju,
  szukajka i licznik „Wyświetlono X z Y". Koszt ładowania widoczny przez stan ładowania.
- **D7. ODSTĘPSTWO (dodanie informacji, nie zmiana zachowania):** dialogi „Akceptuj z edycją"
  i „jako alias" pokazują liczbę produktów, których dotknie masowy `UPDATE products`
  (`GET /api/atrybuty/uzycie` → `count`), a toast po sukcesie — `produktow_zaktualizowano`
  z odpowiedzi. Powód: backend NIE loguje tych akcji do audytu (backlog #39, ⬜ do decyzji —
  **nie naprawiamy go w tej sesji**), więc operacja jest nieodwracalna i nieudokumentowana.
- **D8. CZĘŚĆ B — źródła list w dialogu reguł 1:1 z oryginałem** (`:24203-24211`, zweryfikowane):
  marki = słownik (`rodzaj==="marka"`) ∪ marki z produktów (bez `"—"`), sort `localeCompare(pl)`;
  kategorie = **wyłącznie** słownik, sort `localeCompare(pl)`; **dostawcy = `["/api/suppliers"]`**,
  `value = kod`, etykieta `"kod · nazwa"`, bez dedupu i sortu (kolejność z API).
  ⚠ Teza z briefu („dostawcy z produktów") **obalona** — oryginał ma osobne `useQuery(["/api/suppliers"])`.
  Zgodność z silnikiem cen sprawdzona: `repos/ceny.ts:52` porównuje `produkt.dostawca === wartosc`,
  a `products.dostawca` = `"MO9"` = `suppliers.kod` (fixtures), więc zmiana źródła nie psuje dopasowania.
- **D9. Współdzielony Query key `["/api/atrybuty"]`** dla widoku i dialogu reguł (konwencja
  `queryKey.join("/") === URL` z `lib/queryClient.ts`). Jedna invalidacja po mutacjach słownika
  odświeża oba miejsca. Odrzucone: osobne zapytanie w dialogu (dublowałoby ruch i rozjeżdżało cache).
- **D10. `konstrukcja`/`vfIf` w dialogu reguł na selecty ze słownika.** Oryginał MA gotowy
  renderer selecta dla obu (`:24286-24313`, zasilany `ty(rodzaj)` = wartości słownika,
  `localeCompare(pl)`); były nieosiągalne tylko dlatego, że lista typów miała sześć pozycji.
  4b dołożyło te typy jako pola tekstowe (odstępstwo D4 z 4b) — to dokończenie tego samego portu.
- **D11. `/atrybuty` owija się w `AppShell`** — placeholder `WidokWPrzygotowaniu` już to robi,
  więc zdjęcie go bez `AppShell` zabrałoby sidebar. Systemowego ujednolicenia z backlogu #36
  (⬜ do decyzji) **nie ruszamy**.
- **D12. Backlog #39–#43 nietknięty** — to zastane defekty odtworzone 1:1 w 7a, wszystkie
  ⬜ DO DECYZJI UŻYTKOWNIKA. Widoczne skutki w UI (self-match `podobienstwo:100` dla „AGRI STAR II"
  z seedu `products.model`, brak sugestii dla „BKT"/„bkt", rodzaje `model`/`zastosowanie`
  nieakceptowalne z edycją) pokazujemy takimi, jakie są.

## Implementation plan

### Krok 1 — warstwa danych `/atrybuty`
**Nowy** `src/pages/atrybuty/api.ts`:
- typy z fixtures: `Rodzaj` (`value,label,opis,core:number,utworzony?`), `Wartosc` (`id,rodzaj,wartosc`),
  `PozycjaPending` (z `ile_wystapien`, `sugerowane_aliasy`), `Uzycie` (`ok,count,products`),
  `Liczniki = Record<string, number>`;
- funkcje mutacji przez `zadanie()` z `lib/api.ts` (rzuca `"<status>: <treść>"`), plus
  `komunikatBledu(err)` mapujący 403/404/409/400 na polski tekst z ciała `{ok:false,error}`;
- `pobierzLiczniki()` — **osobna ścieżka parsowania**, bo trasa oddaje gołą mapę bez `ok`;
- `pobierzUzycie(rodzaj, wartosc)` — wymaga OBU parametrów (bez nich backend daje 400).

### Krok 2 — widok i podkomponenty
**Nowy** `src/pages/Atrybuty.tsx` — `AppShell` + `PageHeader` + pasek przycisków
(`Nowy rodzaj`, `Dodaj wartość`, `Do akceptacji [badge]`) + przełącznik trzech stanów
(`kafle` | `wartosci` | `pending`) trzymany w `useState`, jak `state.view` injection.
**Nowe** w `src/pages/atrybuty/`:
- `KafleRodzajow.tsx` — topbar, siatka kafli, liczniki z `wartosci`, sekcja „Sieroty w DB"
  (rodzaje obecne w `wartosci`, których nie ma w `rodzaje`);
- `PanelWartosci.tsx` — dodawanie (Enter i przycisk), szukajka, sort `localeCompare(pl)`,
  tabela z `Podgląd`/`Edytuj`/`Usuń`;
- `PanelPending.tsx` — filtr rodzaju z licznikami, szukajka, „Wyświetlono X z Y", dwa przyciski
  czyszczące, tabela z chipami aliasów (`wartosc (podobienstwo%)`) i akcjami;
- `DialogProduktow.tsx` — modal „Produkty używające atrybutu" (`GET /uzycie`), **jeden komponent**
  używany z `Podgląd` w wartościach i z licznika wystąpień w kolejce (w oryginale zduplikowany
  w dwóch miejscach); kolumny Dostawca/Kod/Nazwa/Marka/Rozmiar/Stan, komunikat „pokazano 200 z N"
  gdy `count > products.length`; **bez** nawigacji „Katalog →" przez `sessionStorage` + ręczny
  setter na input (to obejście injection — patrz „Poza zakresem").
**Nowe** prymitywy w `src/components/`: `DialogPotwierdzenia.tsx` (zamiennik `confirm`)
i `DialogTekstu.tsx` (zamiennik `prompt`, z wartością początkową) — D2.

### Krok 3 — routing i placeholder
`src/App.tsx`: `<Route path="/atrybuty" component={Atrybuty} />`.
`src/pages/placeholdery.ts`: usunąć wpis `/atrybuty`, zostaje wyłącznie `/moje-konto`;
zaktualizować komentarz nagłówkowy (liczba tras routera bez zmian).

### Krok 4 — CZĘŚĆ B, dialog reguł
`src/pages/narzuty/DialogReguly.tsx`: `useQuery(["/api/atrybuty"])` + `useQuery(["/api/suppliers"])`;
`slownik()` przepisane na regułę D8/D10; `odswiez()` bez zmian (mutacje słownika żyją w `/atrybuty`).
`src/pages/narzuty/warunki.ts`: rozdzielić „typy z selecta" na słownikowe
(`marka`, `kategoria`, `konstrukcja`, `vfIf`) i `dostawca` (osobne źródło, etykieta `kod · nazwa`).
**Nowy** `src/pages/narzuty/slownik.ts` — czysta funkcja scalania list (bez Reacta), żeby dała
się testować wprost i żeby test złapał odwrócenie reguły „marki = suma / kategorie = tylko słownik".

### Krok 5 — grep kontrolny
Po zmianach `grep -rn "attributes\|attribute-kinds" rebuild/frontend/src` ma zwrócić **zero**.

## Testing strategy

**GATE odbudowy:** ticket nie zmienia backendu ani kontraktu — gate realizujemy przez to, że
wszystkie mocki MSW i typy TS biorą dane **prosto z `contract/fixtures/GET_atrybuty*.json`**
(wzorzec `test/msw/kontrakt.ts`), więc zmiana kształtu fixtura wywala testy. Dodatkowo test
integracyjny sprawdza kształty przeciw ŻYWEMU backendowi 7a.

- **Nowe** w `test/msw/kontrakt.ts`: `atrybutyZFixtura()`, `rodzajeZFixtura()`, `wartosciZFixtura()`,
  `pendingZFixtura()`, `licznikiZFixtura()`.
- **Nowy** `test/atrybuty.test.tsx` — kafle (liczniki, tagi, sieroty), wejście w rodzaj, CRUD wartości
  (dodanie, edycja przez dialog, usunięcie), szukajka i sort, modal „Podgląd" z „pokazano 200 z N",
  komunikaty 403/409/404 po polsku.
- **Nowy** `test/atrybuty.pending.test.tsx` — workflow kolejki: cztery akcje z właściwymi ciałami
  (`akceptuj` bez ciała, `{nowa_wartosc}`, `{kanoniczna_wartosc}`, `{powod}`), chip aliasu,
  filtr rodzaju + szukajka + licznik, oba czyszczenia z potwierdzeniem mówiącym wprost, że to
  „schowaj", nie „odrzuć", ostrzeżenie o liczbie produktów przy akcjach masowych (D7).
- **Nowy** `test/atrybuty.slownik.test.ts` — czysta logika scalania list CZĘŚCI B:
  **marki = suma słownika i produktów**, **kategorie = wyłącznie słownik** (test ma paść, jeśli
  ktoś odwróci regułę), dostawcy = `kod` z `/api/suppliers`, sortowanie `localeCompare(pl)`.
- **Rozszerzony** `test/narzuty.dialog.test.tsx` — `zamockujApi()` dostaje `GET /api/atrybuty`
  i `GET /api/suppliers`; sprawdzamy, że kategoria spoza katalogu (jest w słowniku, nie ma jej
  w produktach) JEST wybieralna, a wartość warunku „dostawca" to `kod`. Pozostałe testy
  `/narzuty` z 4b muszą przejść bez zmian w asercjach.
- **Nowy** `test/integracja/atrybuty.integracja.test.ts` — żywy backend na porcie efemerycznym
  (wzorzec `dostawcy.integracja.test.ts`): 401 bez tokenu, kształt `GET /api/atrybuty`,
  `rodzaje` bez `utworzony` na `/rodzaje`, gołą mapę na `/liczniki`, 400 na `/uzycie` bez parametrów.
  Uruchamiany tylko `npm run test:integracja`.
- Bramki: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` w `rebuild/frontend/`.

## Out of scope

- `/katalog` i degradacja D3 z I2 (listy filtrów ze słownika) — **sesja 7c**, po merge 8b.
  Pliki `Katalog.tsx`, `katalog/eksport.ts`, `test/katalog*` należą do 8b — nie dotykamy.
- Backend atrybutów (7a) — trasy, repozytoria, kontrakt bez zmian.
- Ożywianie martwego `GET /api/atrybuty` w `/staging` (nota z 3e) — byłaby to nowa decyzja.
- Backlog #39–#43 — zastane defekty, ⬜ do decyzji użytkownika (D12).
- Systemowe ujednolicenie `AppShell` (backlog #36) — dotykamy wyłącznie nowego widoku (D11).
- Obejścia specyficzne dla injection, które po natywnym porcie tracą sens i **nie są portowane**:
  React Fiber i `MutationObserver`, pętla `tick()` z `cleanup()` przy zmianie trasy,
  `hideOriginalContent()`/`unhideOriginalContent()`, podmiana węzła tekstowego przycisku,
  ręczne wstrzykiwanie CSS i toastów, skeleton chroniący przed przebiciem starego widoku,
  nawigacja „Katalog →" przez `sessionStorage.katalog_prefilter` + natywny setter na kontrolowanym
  inpucie Reacta, `setQueryDefaults`/`setQueryData` na martwych kluczach i write-through mostka.

## Definition of done

- [ ] `/atrybuty` działa natywnie: kafle, panel wartości z CRUD, kolejka pending z czterema akcjami,
      oba czyszczenia, modal produktów — bez React Fiber i MutationObservera
- [ ] placeholder zdjęty; w `placeholdery.ts` zostaje wyłącznie `/moje-konto`
- [ ] `DialogReguly.tsx` czyta słownik z `["/api/atrybuty"]`, dostawców z `["/api/suppliers"]`;
      degradacja z 4b zamknięta, kategoria spoza katalogu wybieralna
- [ ] `grep -rn "attributes\|attribute-kinds" rebuild/frontend/src` = 0 trafień
- [ ] testy komponentów i logiki zielone, w tym test łapiący odwrócenie reguły marki/kategorie
- [ ] testy `/narzuty` z 4b nadal przechodzą
- [ ] lint / typecheck / build czyste w `rebuild/frontend/`
- [ ] roadmapa: 7b ✅ z datą i ID ticketa, I7 nadal 🔨, **założony blok 7c** z faktami o `/katalog`,
      nota „Efekt uboczny dla I4b" USUNIĘTA jako wykonana, nota dla I2 PRZENIESIONA do 7c
