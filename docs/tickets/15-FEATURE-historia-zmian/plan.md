# 15-FEATURE-historia-zmian — Iteracja 5: Historia

> Status: Draft → **Approved** → Implemented → Shipped
> Branch: `feature/15-historia-zmian`
> Worktree: `.worktrees/15-FEATURE-historia-zmian`

## Opis ticketa

> Iteracja 5 — Historia (wierna odbudowa Bridge)
>
> Realizuj Iterację 5 wg `docs/rebuild-roadmap.md` (§5 „Iteracja 5" — cały blok + ostrzeżenia;
> §3 zasady). Jedna sesja (BE+FE). Zależy od I3 (gotowe). Idzie RÓWNOLEGLE z 4a — inne pliki
> (historia vs narzuty), bez kolizji.
>
> CEL (Ania klika): otwiera `/historia`, widzi zmiany cen/stanów z importów.
>
> ZAKRES:
> - Backend: `GET /api/history`, `/api/history/meta`, `/api/history/paged` (`Wa` = `historia_cen`).
>   Za `requireAuth` — w oryginale meta/paged były publiczne przez podwójną rejestrację, u nas z auth (§3).
> - Frontend: widok `/historia` — tabela + paginacja + filtry. Wpięty w istniejący shell/router.
>
> ⚠ ODPORNOŚĆ WIDOKU: wpisy mogą mieć `szczegoly_json = NULL`; `encja_id` bywa kodem,
> którego NIE MA w `suppliers`.
>
> POZA ZAKRESEM: `/api/audit-log` jako osobny widok (I12); mutacje.
>
> GATE: trzy ścieżki zgodne kształtem z fixtures + walidacja openapi; paginacja/filtry działają;
> widok odporny na NULL szczegóły i niezłączalny `encja_id`; lint/typecheck/build czyste.

## Kontekst

### Rozjazd faktu w opisie ticketa i w roadmapie — rozstrzygnięty PRZED planem

Ticket i `docs/rebuild-roadmap.md` §5 mówią „`Wa` = `historia_cen`". **To nieprawda.** Fakty
sprawdzone w oryginale (nie hipotezy):

| Teza | Dowód |
|---|---|
| `Wa` to tabela SQL **`history`**, nie `historia_cen` | `deminified/backend-index.cjs:43833` — `Wa = Nt("history", {...})`; jedno wystąpienie `Wa =` w pliku (brak cieniowania) |
| `historia_cen` to **inna** tabela, RAW SQL, własność `analytics_module.cjs` | `mirror/backend/analytics_module.cjs:26-95`; czytelnik to `GET /api/analytics/prices/product-history` → **Iteracja 10** |
| `GET /api/history` czyta tabelę `history` | `:48692` → `u.json(U.listHistory())`; `listHistory()` = `:44962-44964` — `select().from(Wa).orderBy(desc(Wa.data))` |
| `GET /api/history/meta` i `/paged` **nie czytają ani `history`, ani `historia_cen`** — czytają **`audit_log`** | `:48335-48391` → obie wołają `U.listAudit(5e3)`; `listAudit` = `:45068-45073` — `select().from(Za).orderBy(desc(Za.kiedy)).limit(t)`, gdzie `Za = Nt("audit_log", …)` (`:43921`) |
| Widok `/historia` woła **wyłącznie** `/paged` + `/meta` | `deminified/frontend-index.js:25374-25390` — `fetch(.../api/history/paged?...)` i `queryKey:["/api/history/meta"]`; brak wywołania `/api/history` |
| `/api/history` wołają **inne** ekrany | `frontend-index.js:16852` (Pulpit → I10), `:10287-10337` (optymistyczny cache edycji katalogu) |

Skutek dla zakresu: **I5 nie dotyka `historia_cen` w ogóle.** Nasz `repos/historia.ts` (pisarz
`historia_cen` z bloku 3d-1) zostaje nietknięty; jego czytelnik należy do I10.

### Co ten widok naprawdę pokazuje

Podtytuł ekranu w oryginale (`frontend-index.js:25393`) brzmi dosłownie:
**„Log każdego importu, eksportu i ręcznej edycji produktu w katalogu"**. To log **zdarzeń**
(jeden wiersz = jeden import / eksport / edycja), a **nie** lista zmian cen per produkt.
Nie ma tu prezentacji „przed → po" — kolumna „Szczegóły" pokazuje przy edycji tylko **nazwy**
zmienionych pól (`szczegoly_json.zmiany`, do 6 + „… i N więcej"). Wartości `staraWartosc` /
`nowaWartosc` żyją w tabeli `history` i wychodzą wyłącznie przez `GET /api/history`, którego
ten ekran nie woła.

### Filtr akcji — dlaczego większość naszych wpisów audytu będzie niewidoczna

`/paged` i `/meta` mapują `akcja → typ` sztywnym słownikiem (`:48341`, `:48363`) i **odrzucają**
(`filter(Boolean)`) wszystko, co się nie dopasowało:

| `akcja` w `audit_log` | `typ` |
|---|---|
| `upload_pliku`, `import_cennika` | `import` |
| `eksport_csv`, `eksport_shoper` | `eksport` |
| `edycja_produktu` | `edycja` |
| **wszystko inne** | `null` → **wypada z wyniku** |

Z dwunastu akcji, które nasz backend zapisuje dziś (3d-2 / 3f-1 / 3f-2), przez ten filtr
przechodzą **dwie**: `upload_pliku` (`routes/suppliers.ts:203`) i `import_cennika`
(`routes/staging-mutacje.ts:149`) — obie z `encja_typ: "dostawca"` i sensownym
`szczegoly_json`, więc **Ania zobaczy realne wpisy swoich importów wraz z dostawcą,
liczbą pozycji i nazwą pliku.** Pozostałe dziesięć (`import_z_url`, `import_pliku`,
`synchronizacja_reczna`, `edycja_dostawcy`, `edycja_stagingu`, `akceptacja_stagingu`,
`odrzucenie_stagingu`, `override`, `usuniecie_override`, `czyszczenie_stagingu`) są
odfiltrowywane — **tak samo jak w produkcji**. To port 1:1, nie usterka.

### Ostrzeżenia z roadmapy — gdzie realnie uderzają

`synchronizacja_reczna` (NULL `szczegoly_json`, `encja_id` niezłączalny z `suppliers`) jest
przez powyższy filtr odrzucana, więc **do widoku nie dociera**. Ale `listAudit(5000)` czyta
**wszystkie** wiersze, więc kod mapujący musi znieść NULL i zepsuty JSON **zanim** dojdzie do
filtra — oryginał robi to `try { JSON.parse(...) } catch {}` z fallbackiem `{}` (`:48338-48342`).
Odtwarzamy dokładnie to i **testujemy wprost** (obie sytuacje w seedzie GATE), bo ten sam kod
parsujący obsłuży `/api/audit-log` w I12.

### Podwójna (właściwie potrójna) rejestracja tras

Rdzeń rejestruje `/meta` i `/paged` **bez** `we` (`requireAuth`) w `:48335` / `:48352`.
`mirror/backend/pagination_module.cjs:136,168` rejestruje je ponownie **z** `requireAuth`, a moduł
jest ładowany dwukrotnie (`extensions.cjs:449-451` + bezpośrednio z `index.cjs`) — czyli
rejestracje są **trzy**, nie dwie (`docs/spec-backend.md:51-54` mówi o dwóch). Express bierze
pierwszy pasujący handler, więc w produkcji te trasy są **faktycznie publiczne** i tak zamraża
je `contract/openapi.yaml:627-650` (`security: []`).

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

| Ścieżka (`contract/openapi.yaml`) | Fixture | Uwagi |
|---|---|---|
| `GET /api/history` (`:627-634`) | `contract/fixtures/GET_history.json` | goła tablica; 10 pól na wiersz; `_body_przyciete_z: 46916` |
| `GET /api/history/meta` (`:635-642`) | `contract/fixtures/GET_history_meta.json` | `{ dostawcy: string[] }`; `_przyciete.dostawcy: 8` |
| `GET /api/history/paged` (`:643-650`) | `contract/fixtures/GET_history_paged.json` | `{ items, total, pages, page, limit }`; 12 pól na `item`; `_przyciete.items: 50` |

`_przyciete` / `_body_przyciete_z` to artefakt sanityzacji nagrania (`contract/README.md`),
**nie** pole API — harness GATE pomija klucze na `_` (`test/gate/ksztalt.ts:21`).

**Rozjazdy i jak je rozstrzygamy:**
- `security: []` w kontrakcie ↔ `requireAuth` u nas — **świadome odstępstwo D1**, kontynuacja
  decyzji z I1/I2/3b (`routes/staging.ts:29-33`). GATE waliduje kody i ścieżki, nie `security`
  (`test/gate/kontrakt.ts:8-13`), więc nie zapala się na tym.
- roadmapa „`Wa` = `historia_cen`" ↔ kod „`Wa` = `history`" — **wygrywa kod**, roadmapa do poprawy
  (decyzja D3).
- `docs/spec-backend.md:51-54` „podwójna rejestracja" ↔ realne **trzy** rejestracje — doprecyzowanie
  w docs, bez wpływu na implementację (wynik ten sam).

## Decyzje

**D1 — `requireAuth` na wszystkich trzech trasach (odstępstwo świadome).**
Kontrakt mówi `security: []`, bo produkcja jest publiczna. Trzymamy linię z §3 roadmapy i I1:
auth na wszystkich trasach danych. Identycznie jak `GET /api/products` (I2) i `GET /api/staging` (3b).

**D2 — Port 1:1, bez rozszerzeń (decyzja użytkownika, runda Q&A).**
Filtr pięciu akcji zostaje jak w oryginale — `import_z_url` / `import_pliku` / `synchronizacja_reczna`
pozostają niewidoczne, `historia_cen` nie wchodzi do tego widoku. *Za:* wierność, brak dryfu
w stronę I10. *Przeciw:* Ania nie zobaczy tu importów z URL ani zmian cen per produkt — trzeba jej
to powiedzieć. Rozważane i odrzucone: (b) rozpoznawanie naszych akcji importu, (c) druga zakładka
z `historia_cen`.

**D3 — Poprawiamy fakt w roadmapie i PRZENOSIMY przypisanie `historia_cen` do I10
(decyzja użytkownika).** W bloku I5: `Wa` = tabela `history`, a `/meta` + `/paged` czytają
`audit_log`. W bloku **I10** dopisujemy notę, że `historia_cen` ma pisarza od 3d-1 i czeka tam
na czytelnika `/api/analytics/prices/product-history`. Zgodnie z `CLAUDE.md` §2: ustalenie
o przyszłym bloku idzie DO TEGO BLOKU.

**D4 — `GET /api/history` implementujemy w pełni (decyzja użytkownika).**
Tabela `history` nie ma dziś w rebuildzie żadnego pisarza (jedyny pisarz oryginału to
`PUT`/`PATCH /api/products/:id`, `:48435` / `:48475` — mutacja poza zakresem), ale endpoint jest
w kontrakcie, ma fixture i wołają go Pulpit (I10) oraz cache edycji katalogu. Zaślepka `[]`
zdegenerowałaby GATE do sprawdzania pustej tablicy.

**D5 — Stany `isLoading` / `isError` w widoku (odstępstwo świadome, decyzja użytkownika).**
Oryginał (`data = {}` domyślnie) renderuje podczas ładowania pustą tabelę z „Brak wpisów
w historii.", a błąd sieci wygląda identycznie jak pusta historia. Robimy jak nasz `Staging.tsx`
(`:60`, `:226`) — jeden wzorzec ładowania w całym rebuildzie. Warstwa czysto prezentacyjna,
kontrakt i dane bez zmian.

**D6 — nazewnictwo repo (moje, żeby nie powielić pułapki).**
W `src/repos/` będą obok siebie `historia.ts` (tabela `historia_cen`, 3d-1) i nowy plik dla
tabeli `history`. Nazwy różniące się jedną literą to gotowa pomyłka, więc nowy plik nazywam
**`repos/dziennik-zmian.ts`** i wstawiam **wzajemne** ostrzeżenia w docstringach obu plików
oraz w `repos/audit.ts` (trzecia podobna tabela).

## Plan implementacji

### Backend

1. **`src/repos/dziennik-zmian.ts` (nowy)** — odczyt tabeli `history` (`db/schema.ts:162-173`).
   - `listaDziennikaZmian(db): WpisDziennika[]` — port `listHistory()` (`:44962`):
     `select().from(history).orderBy(desc(history.data)).all()`. Bez limitu, bez parametrów.
   - Docstring: co to za tabela, kto ją zapisuje w oryginale (mutacja produktu, poza zakresem),
     ⚠ „NIE MYLIĆ z `repos/historia.ts` (`historia_cen`, I10) ani z `repos/audit.ts` (`audit_log`)".
2. **`src/repos/audit.ts` (edycja)** — dopisać `listaAudytu(db, limit = 500): WierszAudytu[]`,
   port `listAudit(t = 500)` (`:45068`): `orderBy(desc(auditLog.kiedy)).limit(limit)`.
   Dopisać ostrzeżenie o trzech podobnych tabelach.
3. **`src/repos/historia.ts` (edycja, tylko komentarz)** — dopisać wzajemne ostrzeżenie
   i sprostować docstring: czytelnika dowozi **I10** (`/api/analytics/prices/product-history`),
   nie I5.
4. **`src/historia/mapowanie.ts` (nowy)** — czyste funkcje, port `:48335-48391`:
   - `typWpisu(akcja: string): TypWpisu | null` — słownik pięciu akcji.
   - `parsujSzczegoly(szczegolyJson: string | null): Record<string, unknown>` —
     `try { JSON.parse } catch { {} }`, NULL → `{}` (**1:1 z `:48338-48342`**).
   - `naWpisHistorii(wiersz): WpisHistorii | null` — mapowanie 12 pól, w tej samej kolejności
     fallbacków co oryginał:
     `dostawca = encjaTyp === "dostawca" ? encjaId : szczegoly.dostawca ?? null`,
     `liczbaPozycji = import ? (liczbaProduktow ?? wczytanych ?? doStagingu ?? null) : eksport ? (liczbaProduktow ?? liczbaDostawcow ?? null) : 1`,
     `uwagi = import ? "Plik: " + (nazwaPliku ?? "?") : eksport ? "Format: " + (akcja === "eksport_shoper" ? "shoper" : "csv") : null`,
     `kodProduktu = edycja ? encjaId : null`,
     `zmienionePola = edycja && Array.isArray(szczegoly.zmiany) ? szczegoly.zmiany : []`.
   - `dostawcyHistorii(wpisy): string[]` — `Array.from(new Set(…)).sort()` (sort domyślny,
     leksykograficzny — jak `:48348`).
   - `stronaHistorii(wpisy, filtry): StronaHistorii` — filtr `typ` / `dostawca` / `search`
     (`JSON.stringify(wpis).toLowerCase().includes(fraza)` — **przeszukuje cały zmapowany
     obiekt**, `:48383`), sort malejąco po `kiedy`, `slice((page-1)*limit, …)`,
     `pages = Math.max(1, Math.ceil(total / limit))`.
5. **`src/routes/history.ts` (nowy)** — `trasyHistorii({ db })`, trzy trasy z `requireAuth`.
   - `GET /api/history` → `res.json(listaDziennikaZmian(db))`.
   - `GET /api/history/meta` → `{ dostawcy: dostawcyHistorii(wpisy) }`.
   - `GET /api/history/paged` → clamp **dokładnie jak `:48353-48354`**:
     `page = Math.max(parseInt(String(q.page ?? "1")) || 1, 1)`,
     `limit = Math.min(Math.max(parseInt(String(q.limit ?? "50")) || 50, 1), 200)`.
     ⚠ Fallback `|| 1` / `|| 50` stoi **po** `parseInt` (inaczej niż w `pagination_module`
     używanym przez `/api/staging/paged`, gdzie `||` działa na stringu) — tu `page=0`
     i `page=abc` dają obie `1`, bez wycieku `NaN`. Kolejność do odtworzenia dosłownie
     i utrwalenia testem.
     Oba handlery czytają `listaAudytu(db, 5000)` — limit **przed** filtrowaniem, jak w oryginale.
   - Kolejność rejestracji: `/api/history/meta` i `/api/history/paged` **przed** `/api/history`
     nie jest wymagana (brak `:id`), ale trzymamy ją dla czytelności.
   - Docstring z odstępstwem D1 i notą o potrójnej rejestracji w oryginale.
6. **`src/app.ts` (edycja)** — `app.use(trasyHistorii({ db }))` po `trasyOverrides`.

### Frontend

7. **`src/pages/historia/dane.ts` (nowy)** — typy `WpisHistorii` / `StronaHistorii` / `MetaHistorii`,
   `ROZMIARY_STRONY = [25, 50, 100]`, `OPCJE_FILTRA_TYPU` (Wszystkie typy / Importy / Eksporty /
   Edycje — teksty 1:1 z `:25430-25444`), `adresStrony({ page, limit, search, typ, dostawca })`
   budujący `/api/history/paged?page=…&limit=…&search=…&typ=…&dostawca=…`
   (`encodeURIComponent` na `search`, jak `:25382`). Wzorzec: `pages/staging/dane.ts`.
8. **`src/pages/historia/TabelaHistorii.tsx` (nowy)** — tabela + `OdznakaTypu`
   (port `QT()`, `:25350-25373`: import → niebieska, eksport → zielona, edycja → bursztynowa;
   `variant="outline"`, `text-[10px]`). Kolumny 1:1: **Data · Typ · Dostawca · Użytkownik ·
   Pozycji · Szczegóły**. Data: `new Date(kiedy).toLocaleString("pl-PL", { dateStyle: "short",
   timeStyle: "short" })`. Puste: `—` dla `dostawca`, `uzytkownik`, `liczbaPozycji`, `nazwaPliku`.
   Szczegóły wg `typ`: import → „Plik: `nazwaPliku ?? "—"`" + `uwagi` w nawiasie na bursztynowo;
   eksport → „Format: `format`" + `uwagi`; edycja → `kodProduktu` + `<ul>` z `zmienionePola`
   uciętą do 6 + „… i N więcej". Pusty stan: `colSpan={6}`, „Brak wpisów w historii.".
9. **`src/pages/Historia.tsx` (nowy)** — port `GT()` (`:25374-25635`): stan filtrów, `useEffect`
   resetujący stronę przy zmianie `search` / `typ` / `dostawca` (`:25375-25377`), `useQuery` po
   `[adres]` (konwencja `lib/queryClient.ts`), druga `useQuery` po `["/api/history/meta"]`.
   Nagłówek: tytuł „Historia zmian", podtytuł „Log każdego importu, eksportu i ręcznej edycji
   produktu w katalogu". Pasek filtrów: `Input` z ikoną `Search` i placeholderem „Szukaj po kodzie
   produktu, dostawcy lub treści zmiany...", `Select` typu (`w-44`), `Select` dostawcy
   („Wszyscy dostawcy" + lista z `/meta`), po prawej „`N` wpisów". Stopka paginacji: „Na stronie:"
   + 25/50/100, „Strona X z Y · Z wpisów", „« Pierwsza / Poprzednia / Następna / Ostatnia »".
   **D5:** `isLoading` / `isError` jak w `Staging.tsx:226-237`.
10. **`src/pages/placeholdery.ts` (edycja)** — usunąć wpis `/historia`, dopisać do nagłówkowego
    komentarza (jak zrobiły to I2 / 3e / 3f-1).
11. **`src/App.tsx` (edycja)** — `<Route path="/historia" component={Historia} />`.
12. **`src/pages/Staging.tsx` (edycja, tylko komentarz)** — nagłówkowa nota mówi „Widać je dopiero
    w historii cen (Iteracja 5)". To nieprawda (patrz Kontekst) — `historia_cen` czyta I10.
    Sprostować.

### Testy

13. **`test/gate/dane.ts` (edycja)** — dwa seedy:
    - `zasiejDziennikZmianZFixtures(db)` — wiersze wprost z `GET_history.json`.body do tabeli `history`.
    - `zasiejAudytHistorii(db)` — wiersze **wejściowe** `audit_log` skonstruowane tak, by mapowanie
      dało wynik zgodny z `GET_history_paged.json` / `GET_history_meta.json`: pięć
      `edycja_produktu` (`szczegoly_json = {"zmiany":[…]}`, `uzytkownik_imie: "Marta Bieguniak"`),
      kilka `upload_pliku` / `import_cennika` z `encja_typ: "dostawca"` i kodami MO1/MO2/MO3/MO6/MO10
      (zasilają `meta.dostawcy`), plus **trzy pułapki**: `synchronizacja_reczna` z
      `szczegoly_json = NULL` i `encja_id` spoza `suppliers`, wpis z **niepoprawnym JSON-em**
      w `szczegoly_json`, wpis z akcją spoza słownika. Znaczniki `kiedy` tak dobrane, żeby pięć
      wpisów `edycja_produktu` było najświeższe.
14. **`test/historia.gate.test.ts` (nowy)** — wzorzec `staging.gate.test.ts`:
    `sprawdzZgodnoscZKontraktem` + `sprawdzZgodnoscZFixture` dla trzech ścieżek; test
    „item ma dokładnie te 12 kluczy co fixture"; test „wiersz `/api/history` ma dokładnie te
    10 kluczy"; test „bez tokenu → 401 mimo `security: []` w kontrakcie" (D1).
15. **`test/historia.mapowanie.test.ts` (nowy)** — unit na czystych funkcjach: słownik pięciu
    akcji + `null` dla reszty; `szczegoly_json = NULL` → `{}` (nie rzuca); zepsuty JSON → `{}`;
    `encja_id` niezłączalny z `suppliers` nie psuje mapowania; kolejność fallbacków
    `liczbaPozycji`; clamp `page` / `limit` (`0`, `abc`, `999`, brak); `search` po całym obiekcie;
    sort malejąco po `kiedy`; `pages` przy `total = 0`.
16. **`test/historia.odczyt.test.ts` (nowy)** — integracyjnie na realnej bazie: filtry `typ` /
    `dostawca` / `search` zwężają wynik, paginacja tnie strony, `synchronizacja_reczna` **nie
    pojawia się** w wyniku (port 1:1), `meta.dostawcy` zawiera tylko dostawców z wpisów, które
    przeszły filtr.
17. **FE `test/historia.test.tsx` (nowy)** — wzorzec `staging.test.tsx` + MSW: render tabeli
    z wpisem `import` (jest „Plik: …"), `edycja` (kod + lista pól, ucięcie do 6 + „… i N więcej"),
    pusty wynik → „Brak wpisów w historii.", zmiana filtra resetuje stronę na 1, przyciski
    paginacji wyłączone na skrajach, `isError` → komunikat błędu.

### Kolejność commitów

1. repo (`dziennik-zmian.ts`, `listaAudytu`, sprostowania w docstringach)
2. mapowanie + testy jednostkowe
3. trasy + `app.ts` + testy odczytu
4. seed GATE + `historia.gate.test.ts`
5. FE: `dane.ts` + `TabelaHistorii.tsx` + `Historia.tsx` + router/placeholder
6. testy FE

## Strategia testów

- **GATE odbudowy (obowiązkowy).** Trzy ścieżki z sekcji „Kontrakt i fixtures" × dwie asercje:
  `sprawdzZgodnoscZKontraktem` (ścieżka, metoda, kod, content-type wg `contract/openapi.yaml`)
  i `sprawdzZgodnoscZFixture` (kształt 1:1 wobec `contract/fixtures/`). Do tego twarde
  porównanie **kompletnych zbiorów kluczy** (12 dla `paged.items`, 10 dla `history`) — samo
  `porownajKsztalt` mogłoby przepuścić pole obecne tylko w części z pięciu nagranych wierszy.
  **Rozjazd = STOP**, fixture'a nie ruszamy. Nie przewiduję wyjątków `WyjatekGate`.
- **Jednostkowe** — mapowanie i paginacja jako czyste funkcje (pkt 15). Tu żyje cała logika
  wrażliwa na wierność (kolejność fallbacków, clamp, `try/catch`), więc pokrycie ma być gęste.
- **Integracyjne** — realna baza SQLite w katalogu tymczasowym + `supertest` (istniejący
  `stworzSrodowiskoTestowe`). Zero mocków DB.
- **FE** — Testing Library + MSW, jak reszta rebuildu. Bez E2E: to widok tylko do odczytu,
  a przepływ „import → wpis w historii" pokrywają testy backendu.
- **Bramki:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` w
  `rebuild/backend/` **i** `rebuild/frontend/`.

## Poza zakresem

- `/api/audit-log` i jego widok — **I12**.
- Czytelnik `historia_cen` (`GET /api/analytics/prices/product-history`) i Pulpit — **I10**.
- Pisarz tabeli `history`, czyli `PUT`/`PATCH /api/products/:id` (ręczna edycja produktu w katalogu)
  — mutacja katalogu, osobna iteracja. Do tego czasu `GET /api/history` zwraca `[]` na stagingu.
- Rozszerzanie słownika akcji o `import_z_url` / `import_pliku` / `synchronizacja_reczna` — **D2**.
- Eksporty (`eksport_csv`, `eksport_shoper`) — typ obsłużony w mapowaniu (bo tak robi oryginał),
  ale pisarza tych akcji dowozi iteracja od eksportu.

## Definition of done

- [ ] `GET /api/history`, `/api/history/meta`, `/api/history/paged` działają za `requireAuth`
      i przechodzą GATE (kontrakt + fixtures, kształt 1:1).
- [ ] Mapowanie `akcja → typ` odtworzone 1:1 wraz z odrzucaniem akcji spoza słownika.
- [ ] `szczegoly_json = NULL` i niepoprawny JSON nie wywracają odczytu (test).
- [ ] `encja_id` niezłączalny z `suppliers` nie wywraca odczytu ani widoku (test).
- [ ] Clamp `page` / `limit` odtworzony dosłownie (`|| po parseInt`), utrwalony testem.
- [ ] Widok `/historia` wpięty w router i shell, placeholder zdjęty.
- [ ] Tabela, filtry (szukaj / typ / dostawca), paginacja 25/50/100 i wszystkie teksty PL
      zgodne z oryginałem.
- [ ] `isLoading` / `isError` wg wzorca `Staging.tsx` (D5).
- [ ] `lint`, `typecheck`, `test`, `build` czyste po obu stronach.
- [ ] Roadmapa: blok I5 zamknięty (data + ID ticketa), fakt `Wa = history` sprostowany,
      nota o `historia_cen` przeniesiona do bloku I10 (D3).
