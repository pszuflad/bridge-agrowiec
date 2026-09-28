# 15-FEATURE-narzuty-promocje-ceny — Iteracja 4a: silnik cen + narzuty/promocje + wpięcie w import

> Status: Draft → Approved → Implemented → Shipped
> Branch: `feature/15-narzuty-promocje-ceny`
> Worktree: `.worktrees/15-FEATURE-narzuty-promocje-ceny`

## Opis ticketa

> Iteracja 4a — Silnik cen + narzuty/promocje + integracja z importem (wierna odbudowa Bridge)
>
> Realizuj Iterację 4, sesję 4a (BACKEND) wg `docs/rebuild-roadmap.md` (§5 „Iteracja 4" — cały blok
> + ostrzeżenia; §3 zasady). Frontend (`/narzuty`) to osobna sesja 4b PO merge tej.
>
> CEL: dostarczyć CRUD narzutów/promocji, silnik przeliczania cen, i — kluczowe — DOMKNĄĆ lukę
> zostawioną przez I3: wpiąć liczenie narzutu/promocji w ścieżkę importu.
>
> ZAKRES: CRUD `/api/markups` i `/api/promotions` (za `requireAuth`); silnik cen
> `recalcPricesFromRules`; wpięcie gałęzi cenowej w `acceptStaging` i `addProductsBulk`; lista pól
> edytowalnych zamykająca mass-assignment (backlog #14); potwierdzenie, że audyt loguje `c.body`
> w całości.
>
> POZA ZAKRESEM: widok `/narzuty` i kolumna „Promocja" (4b).
>
> GATE: fixtures markups/promotions (kształt 1:1 + openapi); testy formuły cenowej; **czekający
> test charakteryzacyjny importu (3d-2) przechodzi z regułami w tabelach**; testy listy pól
> edytowalnych; lint/typecheck/build czyste.

## Kontekst

Iteracja 3 świadomie NIE przeportowała gałęzi cenowej w `acceptStaging` — na pustych tabelach
`markups`/`promotions` warunek `if (__mm || __pp)` nigdy nie wchodzi, więc pominięcie było bez
skutku. Dowodzi tego charakteryzacja 3d-2, która wycina z produkcyjnego bundla PRAWDZIWYCH
pomocników (`__bridgePickMarkup`/`__bridgePickPromo`) i uruchamia oryginalną gałąź obok naszego
portu. Ta iteracja pozwala wpisać pierwszą regułę — i od tej chwili luka przestaje być nieszkodliwa.

Tabele `markups` i `promotions` **już istnieją** w `rebuild/schema/001_schema.sql:143-168`
i `rebuild/backend/src/db/schema.ts:175-201`, 1:1 z produkcją i zgodne z fixture'em. Migracja
nie jest potrzebna. W `rebuild/` nie ma dziś ŻADNEGO kodu narzutów/promocji.

Dotykamy: nowe `src/repos/ceny.ts`, `src/repos/markups.ts`, `src/repos/promotions.ts`,
`src/routes/markups.ts`, `src/routes/promotions.ts`, `src/app.ts` (rejestracja), oraz
`src/import/akceptacja.ts` (wpięcie gałęzi cenowej w miejsce komentarza „ŚWIADOMIE POMINIĘTE").

### Fakty ustalone przed planem (sprostowania, nie decyzje)

1. **To `PATCH`, nie `PUT`.** Oryginał `e.patch("/api/markups/:id", we, …)` (`:48699`)
   i `e.patch("/api/promotions/:id", we, …)` (`:48722`); `contract/openapi.yaml:739-751`
   i `:901-913` też mają wyłącznie `patch`. Roadmapa w linii 823 pisze „PUT/DELETE" — **błąd
   roadmapy, do poprawienia w Kroku 13.**
2. **`recalcPricesFromRules` NIE ustawia `status`.** Ustawia wyłącznie `cena_sprzedazy`
   i `marza_pct` (`:44685-44691`). `status` ustawia tylko gałąź cenowa w `acceptStaging`
   (`:44891`) i `addProductsBulk` (`:44782`). Ticket sugeruje inaczej — wierzymy oryginałowi.
3. **`GET /api/markups` i `/api/promotions` są w produkcji PUBLICZNE** (`security: []`
   w openapi, brak `we` przy trasie). U nas idą za `requireAuth` — to **kontynuacja decyzji D1
   z I1**, zastosowanej już w `overrides.ts`, `products.ts`, `staging.ts`, a nie nowa decyzja.
4. **Brak cieniowania definicji.** `grep -c "function <nazwa>("` w `mirror/backend/index.cjs`
   daje dokładnie 1 dla `__bridgeCondMatch`, `__bridgeMarkupMatches`, `__bridgePromoMatches`,
   `__bridgePickMarkup`, `__bridgePickPromo`, `recalcPricesFromRules` oraz `be()` (audyt).
   Pułapka z `CLAUDE.md` §5 w tym zakresie nie występuje.
5. **Audyt narzutów/promocji NIE ma niespójności dostawców.** Trasy logują `c.body` w całości
   (`:48699-48737`, wszystkie sześć wywołań `be(...)`), a nie wybrane pola. Potwierdzone
   lekturą wszystkich sześciu tras — nie kopiujemy rozwiązania `POLA_AUDYTOWANE_DOSTAWCY`.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

| Ścieżka `contract/openapi.yaml` | Fixture |
|---|---|
| `GET /api/markups` (`:709`) | `contract/fixtures/GET_markups.json` |
| `POST /api/markups` (`:717`) | — (brak nagrania mutacji) |
| `PATCH /api/markups/{id}` (`:739`) | — |
| `DELETE /api/markups/{id}` (`:728`) | — |
| `GET /api/promotions` (`:871`) | `contract/fixtures/GET_promotions.json` |
| `POST /api/promotions` (`:879`) | — |
| `PATCH /api/promotions/{id}` (`:901`) | — |
| `DELETE /api/promotions/{id}` (`:890`) | — |

`GET_markups.json` — jeden rekord, jedenaście pól: `id, typ, zakres, warunki (JSON jako STRING),
nazwa, wartosc, jednostka, priorytet, status, zmienilUzytkownikId, zmienionoData`. Odpowiedź to
**goła tablica**, nie koperta.

`GET_promotions.json` — **pusta tablica**. Ograniczenie tej siatki nazywamy wprost: kształt
wiersza promocji NIE jest pokryty żadnym nagraniem produkcji. Pokrywają go schemat
(`001_schema.sql:156-168`) i testy silnika, a gate dowodzi wyłącznie, że pusty katalog promocji
zwraca `[]` z kodem 200.

**Znane rozjazdy i jak je rozstrzygamy:**
- roadmapa „PUT" vs oryginał/openapi „PATCH" → **PATCH** (fakt 1), roadmapa do poprawy;
- ticket „ustawia marzaPct i status" vs oryginał → **oryginał** (fakt 2);
- ticket „GET za requireAuth" vs openapi `security: []` → **requireAuth** (fakt 3, decyzja D1).

## Decyzje

**D1 — `addProductsBulk` zostaje w Iteracji 12; 4a dowozi REUŻYWALNY silnik.**
`addProductsBulk` i `POST /api/products` nie istnieją dziś w `rebuild/` — roadmapa przypisuje
je do I12 (`docs/rebuild-roadmap.md:1024-1057`, backlog #14). 4a buduje gałąź cenową jako jedną
funkcję `zastosujRegulyCenowe(rekord, narzuty, promocje)` i wpina ją TYLKO w `acceptStaging` —
jedyną istniejącą dziś ścieżkę importu. Do bloku I12 wchodzi jawny wymóg wywołania jej w tym
samym miejscu co oryginał (`:44773-44783`). *Za:* zero martwego kodu, zgodne z zasadą „nie buduj
tego, czego nikt nie woła" (korekta 3a). *Przeciw:* I12 musi pamiętać — dlatego wymóg trafia
DO BLOKU I12, nie do zamykanego I4 (`CLAUDE.md`, zasada 2).

**D2 — audyt loguje SUROWE `c.body`, port 1:1.** Lista pól edytowalnych filtruje ZAPIS, ale nie
audyt. *Za:* audyt zapisuje ZAMIAR, nie wynik — spójne z decyzją przy `synchronizacja_reczna`
z I3 (audyt powstaje nawet dla nieistniejącego dostawcy); port audytu pozostaje dosłowny;
próba wysłania lewego pola zostaje w dzienniku jako sygnał bezpieczeństwa. *Przeciw:* audyt może
pokazać pole, które nie zostało zapisane — **nowa niespójność, którą świadomie wprowadzamy**;
opisana komentarzem w kodzie i dopisana do backlogu #14.

**D3 — pełne kolumny biznesowe na liście pól edytowalnych, filtr na PATCH **i** POST.**
- `POLA_EDYTOWALNE_NARZUTU` = `typ, zakres, warunki, nazwa, wartosc, jednostka, priorytet, status`
- `POLA_EDYTOWALNE_PROMOCJI` = `nazwa, rabatPct, zasieg, warunki, priorytet, start, koniec, status`
- odcięte wszędzie: `id` (tożsamość), `zmienilUzytkownikId`, `zmienionoData` (ustawia SERWER).

To pokrywa 100% realnych kolumn obu tabel, więc widok z 4b nic nie traci. Filtr na POST jest
konsekwencją tej samej decyzji: dwie trasy tego samego zasobu nie powinny mieć różnej
powierzchni ataku, a lewe pole w POST wywalałoby INSERT błędem zamiast zostać zignorowane.
*Odstępstwo od 1:1* — zamyka backlog #14 dla narzutów i promocji, wzorem `POLA_EDYTOWALNE_DOSTAWCY`
(3f-2) i `POLA_EDYTOWALNE` stagingu (3d-2, samo w sobie port 1:1 z `:48598`).

**D4 — promocje: daty `start`/`koniec` są IGNOROWANE, port 1:1 + wpis w backlogu.**
`__bridgePromoMatches` (`:44615-44628`) nie czyta `start` ani `koniec` — o zastosowaniu promocji
decyduje wyłącznie `status === "aktywna"` i dopasowanie po `warunki`/`zasieg`. Wygasła promocja
nadal obniża ceny. Odtwarzamy dosłownie; nowy wpis backlogu opisuje defekt ze statusem
„⬜ do decyzji", a blok I4b w roadmapie dostaje notę, że wyłączenie promocji w UI to zmiana
`status`, nie upływ daty. *Za:* zero rozjazdu z produkcją, charakteryzacja zostaje twarda.
*Przeciw:* ceny liczone z wygasłą promocją — dokładnie jak dziś w produkcji.

**D5 — asymetria 404 w PATCH-ach odtworzona 1:1.** `PATCH /api/markups/:id` ma
`if (!p) return u.status(404)` (`:48709`), a `PATCH /api/promotions/:id` **NIE MA** tego
sprawdzenia (`:48722-48731`) — na nieistniejącym id oddaje 200 z pustym ciałem. Port dosłowny,
zgodnie z regułą D4 (1:1 + backlog). Nowy wpis backlogu + nota dla 4b, żeby frontend nie
zakładał obiektu w odpowiedzi.

## Plan implementacji

**Krok 1 — silnik cen: `rebuild/backend/src/repos/ceny.ts`** (port `:44572-44693`)
- `dopasujWarunek(produkt, warunek)` ← `__bridgeCondMatch` (`:44572`). Dziewięć typów warunku
  (`dostawca` — równość; `kategoria`/`marka`/`produkt`/`konstrukcja`/`vfIf`/`rozmiar`/`bieznik`
  — `includes`; `srednica` — równość), pusta `wartosc` ⇒ `true`, nieznany `typ` ⇒ `true`.
- `narzutPasuje(regula, produkt)` ← `__bridgeMarkupMatches` (`:44599`): `status !== "aktywny"`
  ⇒ `false`; `warunki` z JSON-a (uszkodzony JSON ⇒ `[]`), niepusta lista ⇒ `every`;
  `typ === "globalny"` ⇒ `true`; inaczej pojedynczy warunek `{typ, wartosc: zakres}`.
- `promocjaPasuje(promocja, produkt)` ← `__bridgePromoMatches` (`:44615`): `status !== "aktywna"`
  ⇒ `false`; `warunki` jak wyżej; inaczej `zasieg.includes(marka) || zasieg.includes(kategoria)`,
  pusty `zasieg` ⇒ `false`. **Bez dat** (D4).
- `wybierzNarzut(reguly, produkt)` ← `__bridgePickMarkup` (`:44632`): sort malejąco po
  `priorytet ?? 50`, pierwsza pasująca „specyficzna" (`typ !== "globalny"` LUB niepuste `warunki`)
  wygrywa i przerywa; globalna zapamiętywana tylko jako fallback.
- `wybierzPromocje(promocje, produkt)` ← `__bridgePickPromo` (`:44652`): filtr + sort, pierwsza.
- `zastosujRegulyCenowe(rekord, narzuty, promocje): boolean` ← gałąź z `:44884-44892`
  (identyczna z `:44773-44783`). Mutuje `rekord`: `cenaSprzedazy`, `marzaPct`, `status`.
  Wchodzi tylko gdy `wybierzNarzut(...) || wybierzPromocje(...)`. **To jest funkcja, którą I12
  wywoła w `addProductsBulk` (D1).**
- `przeliczCenyZRegul(db, idProduktow?)` ← `recalcPricesFromRules` (`:44658`): czyta obie tabele,
  pomija `cenaZakupu <= 0`, próg zapisu `> 0.005` / `> 0.05`, jedna transakcja
  `UPDATE products SET cena_sprzedazy=?, marza_pct=? WHERE id=?` przez surowy uchwyt
  better-sqlite3 (`uchwytSqlite`), zwrot `{ checked, updated }`. **Nie rusza `status`** (fakt 2).

Formuła (wspólna dla obu miejsc):
`cenaSprzedazy = floor(zakup × (1 + narzut/100) × (1 − rabat/100) × (1 + vat/100))`,
`marzaPct = round(narzut × 10) / 10`, `vat = produkt.vat ?? 23`.

**Krok 2 — `src/repos/pola-edytowalne.ts`**: generyczne `odsiejPola(cialo, lista)` wyciągnięte
z `suppliers.ts` (DRY). `odsiejPolaEdytowalne` w `suppliers.ts` deleguje do niego, zachowując
nazwę, sygnaturę i zachowanie — testy `dostawcy.patch.test.ts` muszą zostać zielone bez zmian.

**Krok 3 — `src/repos/markups.ts` i `src/repos/promotions.ts`** (port `:44965-45007`):
`listaNarzutow`, `dodajNarzut`, `aktualizujNarzut`, `usunNarzut` (+ analogiczne dla promocji);
`POLA_EDYTOWALNE_NARZUTU` / `POLA_EDYTOWALNE_PROMOCJI` (D3). **Każda mutacja woła
`przeliczCenyZRegul(db)` bez filtra — czyli przelicza CAŁY katalog** — opakowana w `try/catch`,
dokładnie jak `try { recalcPricesFromRules() } catch {}` w oryginale. `aktualizujNarzut` zwraca
wiersz po zapisie albo `undefined`, gdy id nie istnieje.

**Krok 4 — `src/routes/markups.ts` i `src/routes/promotions.ts`** (port `:48692-48737`):
cztery trasy na zasób, wszystkie za `requireAuth` (fakt 3). POST i PATCH nakładają serwerowe
`zmienilUzytkownikId: req.user.id` i `zmienionoData: new Date().toISOString()` NA WIERZCH
odsianego ciała. Audyt: `zapiszAudyt(db, { akcja, encjaTyp, encjaId, szczegoly: req.body })` —
surowe ciało (D2), akcje `dodanie_narzutu`/`edycja_narzutu`/`usuniecie_narzutu` (encja `narzut`)
oraz `dodanie_promocji`/`edycja_promocji`/`usuniecie_promocji` (encja `promocja`).
DELETE zwraca `{ ok: true }`. 404 tylko w PATCH narzutu (D5).

**Krok 5 — rejestracja w `src/app.ts`**: `trasyNarzutow({ db })`, `trasyPromocji({ db })`.

**Krok 6 — ⭐ wpięcie w import: `src/import/akceptacja.ts`**. Komentarz „ŚWIADOMIE POMINIĘTE:
narzuty i promocje (:44882-44895)" zastąpiony realnym kodem: `try { if (Number(rekord.cenaZakupu)
> 0) { … } } catch {}` — selecty obu tabel **wewnątrz** try, tak jak oryginał, bez cache'owania
między pozycjami (oryginał czyta tabele przy KAŻDEJ akceptowanej pozycji). Miejsce: dokładnie
między ustawieniem `status` a `const istniejacy = …`.

**Krok 7 — dokumentacja**: nowe wpisy w `docs/rebuild-backlog.md` (daty promocji — D4;
asymetria 404 — D5; domknięcie #14 dla narzutów/promocji + nowa niespójność audytu z D2),
poprawki w `docs/rebuild-roadmap.md` (PUT→PATCH, zamknięcie 4a, wymóg dla I12, noty dla 4b).
Robi to Faza 5 (doc-checker).

## Strategia testów

**GATE — `test/narzuty.gate.test.ts`** (wzorzec: `staging.gate.test.ts`)
- `GET /api/markups` po zasianiu bazy wprost z `GET_markups.json`: `sprawdzZgodnoscZKontraktem`
  + `sprawdzZgodnoscZFixture` (kształt 1:1) + asercja na KOMPLETNY zbiór jedenastu kluczy;
- `GET /api/promotions` na pustej tabeli: kontrakt + fixture (`[]`);
- `GET /api/promotions` po wstawieniu wiersza — kształt względem schematu (nie fixture'a,
  bo nagranie jest puste), z komentarzem nazywającym to ograniczenie;
- 401 bez tokenu na wszystkich ośmiu ścieżkach;
- nowy seed `zasiejNarzutyZFixtures` w `test/gate/dane.ts`.

**Silnik — `test/ceny.silnik.test.ts`** (unit, prawdziwa baza w katalogu tymczasowym)
- formuła: znane wejście → znany `cenaSprzedazy`/`marzaPct`, w tym `floor` (a nie `round`)
  i domyślny VAT 23 przy `vat = null`;
- `cenaZakupu <= 0` pomijana;
- priorytet: wyższy wygrywa; **specyficzna reguła bije globalną nawet przy niższym priorytecie**;
- `status` inny niż `aktywny`/`aktywna` ⇒ reguła nie działa;
- `warunki` jako lista (koniunkcja `every`), uszkodzony JSON ⇒ pusta lista ⇒ fallback na `typ`/`zakres`;
- promocja po `zasieg` i po `warunki`; **promocja z datami w przeszłości NADAL działa (D4)**;
- próg zapisu: różnica poniżej progu nie generuje UPDATE-u (`updated === 0`);
- `przeliczCenyZRegul` nie zmienia `status` (fakt 2).

**⭐ Charakteryzacja — `test/akceptacja.charakteryzacja.test.ts` + `charakteryzacja/akceptacja/scenariusze.mjs`**
To jest gate, o który chodzi w tickecie. Harness (`oryginal.mjs`) **już wstrzykuje `Bt` i `hn`**,
więc oryginał wykona pełną gałąź cenową bez żadnej zmiany w harnessie. Do zrobienia:
- `zasiej()` dostaje wstawianie do `markups` i `promotions`; `scenariusze.d.mts` — nowe pola
  `narzuty?` / `promocje?`;
- **nowe scenariusze z REGUŁAMI w tabelach**, każdy porównywany port ↔ uruchomiony oryginał:
  narzut globalny; narzut specyficzny po dostawcy wygrywający z globalnym; narzut z `warunki`;
  sama promocja po `zasieg`; narzut + promocja razem; reguła nieaktywna (bez efektu);
  promocja wygasła (nadal działa — D4); `cenaSprzedazyNowa` z pozycji **nadpisana** przez reguły;
  `cenaZakupu = 0` (gałąź pominięta mimo istniejących reguł);
- asercja „przydatność próby" w `describe 3` rozszerzona o nazwy nowych scenariuszy, żeby zielony
  wynik nie mógł wziąć się z pustych tabel;
- **kontrola negatywna**: test, który dowodzi, że scenariusz z regułą FAKTYCZNIE zmienia cenę
  względem domyślnego `zakup × 1,25` — bez tego cała nowa próba mogłaby być pusta.

**Pola edytowalne — `test/narzuty.patch.test.ts`** (wzorzec: `dostawcy.patch.test.ts`)
- PATCH z polem spoza listy (`id`, `zmienilUzytkownikId`, `zmienionoData`, pole nieistniejące)
  → pole NIE trafia do bazy, reszta patcha przechodzi;
- serwer nadpisuje `zmienilUzytkownikId`/`zmienionoData` własnymi wartościami;
- POST z polem spoza listy → wiersz powstaje, pole zignorowane (D3);
- **audyt zawiera SUROWE ciało, łącznie z odrzuconym polem (D2)** — to jest asercja, która
  pilnuje tej decyzji;
- 401 bez tokenu; 404 na PATCH nieistniejącego narzutu; **200 z pustym ciałem na PATCH
  nieistniejącej promocji (D5)**;
- mutacja narzutu przelicza ceny katalogu (dowód, że `przeliczCenyZRegul` jest realnie wołane).

**Bramki**: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` w `rebuild/backend/`
(Node 20 z nvm). Testy używają bazy w katalogu tymczasowym i portów efemerycznych — bez zmian.

## Poza zakresem
- Widok `/narzuty` i kolumna „Promocja" w `/katalog` — **sesja 4b** (frontend).
- `addProductsBulk` i `POST /api/products` — **Iteracja 12** (D1); 4a zostawia gotową funkcję
  i wymóg wpisany do bloku I12.
- Naprawa dat promocji (D4) i asymetrii 404 (D5) — port 1:1, wpisy w backlogu.
- `PATCH /api/products/:id` (backlog #14, Iteracja 12).
- Zmiana `POLA_EDYTOWALNE_DOSTAWCY` — dotykamy `suppliers.ts` wyłącznie w zakresie delegacji
  do wspólnego `odsiejPola`, bez zmiany zachowania.

## Definition of done
- [ ] `GET/POST /api/markups`, `PATCH/DELETE /api/markups/{id}` — działają, za `requireAuth`
- [ ] `GET/POST /api/promotions`, `PATCH/DELETE /api/promotions/{id}` — jw.
- [ ] Silnik cen (`ceny.ts`) odtwarza `:44572-44693` co do gałęzi, z formułą i progiem zapisu
- [ ] Każda mutacja narzutu/promocji przelicza cały katalog (`try/catch`, jak oryginał)
- [ ] Gałąź cenowa wpięta w `acceptStaging` w miejscu i kolejności jak oryginał
- [ ] Charakteryzacja 3d-2 **z regułami w tabelach** zielona (port == uruchomiony oryginał)
- [ ] Kontrola negatywna dowodzi, że nowe scenariusze faktycznie zmieniają cenę
- [ ] GATE: `GET_markups.json` i `GET_promotions.json` — kształt 1:1 + walidacja kontraktu
- [ ] Listy pól edytowalnych (D3) z testami; audyt loguje surowe ciało (D2) z testem
- [ ] `npm run lint`, `typecheck`, `build`, `test` — czyste
- [ ] Roadmapa: 4a zamknięte, PUT→PATCH sprostowane, wymóg dla I12 w bloku I12, noty dla 4b
- [ ] Backlog: #14 zaktualizowany, nowe wpisy D4 i D5
