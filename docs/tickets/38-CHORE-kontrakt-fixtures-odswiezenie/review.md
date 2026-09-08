# 38-CHORE-kontrakt-fixtures-odswiezenie — Code review

> Reviewed: 2026-09-08
> Branch: `chore/38-kontrakt-fixtures-odswiezenie`
> Diff: 32 pliki, 9 commitów (`origin/develop...HEAD`)

## BLOCKER

- [ ] `docs/rebuild-roadmap.md:1740,1750` i `docs/rebuild-backlog.md:129,282` — roadmapa i backlog
      **w ogóle nie zostały zaktualizowane** (diff nie dotyka żadnego z tych plików), mimo że
      Definition of Done w `plan.md:390-391` tego wprost wymaga („roadmapa 12d rozliczone,
      błędny zapis o `uwaga_cena` usunięty… backlog #3, #4 zaktualizowane").
  - Reason: To nie jest kosmetyka. `docs/rebuild-roadmap.md:1740` wciąż oznacza sesję 12d jako
    **⬜ (nie zrobione)**, a linia 1750 wciąż twierdzi „`uwaga_cena`… ujawnienie jej wymaga tego
    samego przenagrania" — czyli DOKŁADNIE to twierdzenie, które ten ticket obalił dowodem (D1)
    i wpisał do `kolumny.ts` oraz do strażnika w `katalog.gate.test.ts`. `docs/rebuild-backlog.md:282`
    również wciąż mówi „nadal otwarte: ujawnienie `uwagaCena`… → 12d", a `docs/rebuild-backlog.md:129`
    wciąż odsyła do „przenagrania w sesji 12d" jako do przyszłości. Sesja 12e (następna, wg
    roadmapy samego tego bloku) przeczyta ten plik jako WEJŚCIE i odziedziczy fałszywe ustalenie —
    to dokładnie ten sam błąd metodologiczny, który `CLAUDE.md` opisuje w regułach 1 i 4
    („roadmapa opisuje STAN, nie zamiar"; „prompt nie koryguje roadmapy — roadmapa koryguje
    siebie") i przed którym ten właśnie projekt już się wielokrotnie potykał (`bridge_ext.cjs`,
    `PUT /api/config`). Dodatkowo `docs/rebuild-roadmap.md:1746` i `docs/rebuild-backlog.md:162`
    nadal opisują `WYJATKI_SZEROKOSC` jako istniejący mechanizm, mimo że ten sam ticket go usunął.
  - Suggestion: Zamknąć sesję 12d w roadmapie (status, data, ticket 38), usunąć/sprostować zapis
    o `uwaga_cena` w obu plikach zgodnie z D1, zaktualizować statusy backlogu #3 i #4, usunąć
    martwe odwołania do `WYJATKI_SZEROKOSC` — zanim ticket pójdzie dalej niż `review`.

## SHOULD-FIX

- [ ] `tools/record-write-fixtures.cjs:204-224` (`zasiejUwageCeny`) wołane w `main()` (linia 641)
      **przed** `odegrajScenariusze` — seedowany wiersz (`status='wstrzymany'`, najniższe `id`
      z `ean IS NOT NULL`) trafia jako **pierwszy element** do `GET_products.json` i
      `GET_products_bez-parametrow.json` (potwierdzone: id `97794`, `status: "wstrzymany"`
      w obu plikach). Te dwa fixture'y mają być niezależnym dowodem ze snapshotu, a jeden z ich
      rekordów niesie stan wprowadzony przez samą nagrywarkę, nie przez produkcję/snapshot.
  - Reason: Nie psuje GATE (kształt, nie wartość, jest tym co się porównuje), ale zaprzecza
    zasadzie nadrzędnej ticketu („dowód niezależny z oryginału") dla tej jednej wartości i nie
    jest to nigdzie odnotowane w `raport.md` (Deviation #2 tłumaczy zasiew wyłącznie względem
    `/uwagi-cena`, nie wspomina o tym, że wycieka też do `GET_products*`).
  - Suggestion: Seedować produkt spoza pierwszych 5 rekordów `GET /api/products` (np. po `id`
    z górnej granicy zakresu) albo nagrywać `GET_products*` PRZED `zasiejUwageCeny`, a dopiero
    potem siać dla `/uwagi-cena`+`/hold-reasons`.

- [ ] `tools/generate-openapi-schemas.cjs:95-101` (`scalDwa`) — gdy dwa scalane schematy mają
      różne, niekompatybilne typy (co innego niż `integer`/`number`), funkcja zwraca `{}`
      (akceptuje wszystko), zamiast np. `oneOf` albo rzucenia błędu.
  - Reason: To dokładnie przypadek, przed którym ostrzega `CLAUDE.md` („nie ufaj pustym/cichym
      wynikom") — realny rozjazd typu w próbce (np. pole bywa raz stringiem, raz liczbą/`null`
      obsłużonym gdzie indziej) zostanie po cichu rozmyty do „dowolny typ" zamiast zasygnalizowany.
      Dla generatora, którego całą racją bytu jest „nie ukrywać rozjazdów", to osłabia siłę
      dowodu schematu.
  - Suggestion: Przy niekompatybilnych typach budować `oneOf` (analogicznie do mechanizmu już
      istniejącego dla wariantów całej operacji) albo rzucać z nazwą pola, zamiast cicho wracać `{}`.

- [ ] `tools/record-write-fixtures.cjs` — zero testów automatycznych (żaden plik w
      `rebuild/backend/test/` ani obok narzędzia nie testuje `zamaskuj`/`przytnij`), mimo że
      ten sam plik miał w tym tickecie realny wyciek sekretu (token JWT wyciekł do fixture'a w
      pierwszym biegu — `raport.md` „Kontrola wycieku").
  - Reason: Jedynym zabezpieczeniem przed regresją tego konkretnego błędu jest dziś ręczne
      `grep` po fixtures wykonane przez implementera przed commitem — nie jest to powtarzalne
      ani wymuszone przy kolejnym rozszerzeniu nagrywarki (np. o kolejne scenariusze z nowymi
      polami wrażliwymi).
  - Suggestion: Dopisać mały test jednostkowy dla `zamaskuj`/`przytnij` (import jako moduł albo
      `require`) sprawdzający maskowanie klucza wrażliwego na najwyższym poziomie i zagnieżdżony
      — dokładnie ten przypadek, który wcześniej przeszedł niezauważony.

## NICE-TO-HAVE

- [ ] `rebuild/backend/test/kontrakt.spojnosc.test.ts:176-179` — `expect(zAdnotacja).toHaveLength(14)`
      zamraża konkretną liczbę zamiast reguły. Zamierzone (strażnik wzrostu wymaga decyzji,
      jak `WYJATKI_SZEROKOSC` wcześniej), ale przy rozszerzeniu D3 o kolejne trasy trzeba będzie
      pamiętać o ręcznej korekcie tej liczby.
- [ ] `tools/record-write-fixtures.cjs:344-386` (`nagraj`) — `fixture.request = zamaskuj(cialo)`
      nie jest przycinane jak `body` (`przytnij`); dla obecnych scenariuszy ciała są małe, ale
      przy przyszłym scenariuszu z dużą tablicą w `request` fixture urósłby bez ograniczenia.

## Plan compliance

### Done ✓
- Krok 1 — `tools/record-write-fixtures.cjs` w repo, uruchomiony niezależnie w tym review
  (dwukrotnie) — piaskownica sprząta się poprawnie, brak osieroconych procesów/katalogów,
  17/19 nagrań bajt-w-bajt identyczne między biegami (dwa różnią się wyłącznie zegarem
  i losowym `kodImportu`, zgodnie z zastrzeżeniem w nagłówku pliku).
- Krok 2 — 19 scenariuszy nagranych, kolejność operacji niszczących na końcu, `usun-nieopony`
  przed `clear` (odstępstwo #1 z raportu, uzasadnione i poprawne).
- Krok 3 — generator schematów: zweryfikowana idempotencja niezależnie (`--sprawdz` zielony,
  pełny bieg dał plik bajt-w-bajt identyczny z commitowanym).
- Krok 4 — `401` dla `/api/me` i `/api/login` dopisane; `x-odbudowa-auth` przy 14 operacjach
  (policzone w pliku, zgadza się z testem i raportem); `security` nietknięte (zweryfikowane
  diffem — zero usuniętych/zmienionych linii `security:`).
- Krok 5 — `WYJATKI_SZEROKOSC` usunięty kompletnie z kodu testowego (`WyjatekGate` ma nowego,
  jedynego użytkownika w `gate.harness.test.ts`).
- Krok 6 — nowe testy GATE dla wszystkich 12+ operacji, w tym D1-strażnik i test „oba warianty
  różnią się kształtem"; asercje realnie sprawdzają treść (nie przechodzą trywialnie —
  sprawdzone ręcznie na kilku fixture'ach, m.in. snake_case dla `/uwagi-cena`).
- D1 (uwaga_cena) — zweryfikowane niezależnie w `deminified/backend-index.cjs` i
  `mirror/backend/uwaga_cena_patch.cjs`: `listProducts`/`getProduct` faktycznie używają
  `X.select().from(he)` bez jawnych kolumn, patch faktycznie nie dotyka tych dwóch funkcji,
  `kolumny.ts` to wyłącznie zmiana komentarza (zero zmian logiki).
- `GET_products.json` przenagrany: `szerokosc` jako TEXT z zerami końcowymi, 72 klucze
  (zweryfikowane programowo).
- `npm run lint`, `npm run typecheck`, `npx vitest run` — czyste, 1199/1199 zielone (uruchomione
  w tym review).

### Missing or deviating ✗
- **Krok 7 (dokumentacja) — częściowo niedowieziony.** `contract/README.md` zaktualizowany
  poprawnie i solidnie. **Roadmapa i backlog — nie zaktualizowane wcale** (zob. BLOCKER).
- Deviation #2 z raportu (`zasiejUwageCeny`) nie wspomina o efekcie ubocznym na
  `GET_products*` (zob. SHOULD-FIX) — nie jest to odstępstwo od planu, ale luka w opisie
  odstępstwa, które sam raport już dokumentuje.

### Definition of done
- [x] `tools/record-write-fixtures.*` w repo, działa, sprząta po sobie
- [x] 12+ operacji zapisujących nagranych z ORYGINAŁU, z `request` i odpowiedzią
- [x] `GET_products.json` przenagrany — TEXT, 72 klucze
- [x] `GET_products_bez-parametrow.json` + `uwagi-cena` + `hold-reasons`
- [x] `WYJATKI_SZEROKOSC` usunięty, testy zielone bez niego
- [x] `uwagaCena` dalej ukryta, komentarz oparty na dowodzie, strażnik 72 kluczy
- [x] `openapi.yaml`: 401 dla `/api/me`/`/api/login`, `x-odbudowa-auth`+401 przy 14 trasach,
      schematy ciał z `components/schemas` i `$ref`
- [x] `openapi.yaml` waliduje się, generator idempotentny (zweryfikowane niezależnie)
- [x] `contract/README.md` opisuje nowy stan
- [ ] roadmapa i backlog zaktualizowane — **NIE zrobione, zero zmian w obu plikach** (BLOCKER)
- [x] lint/typecheck/build/test czyste w `rebuild/backend`

## Parallel-test concerns

None — wszystkie nowe/zmienione testy używają istniejącego wzorca `stworzSrodowiskoTestowe()`
(baza w katalogu tymczasowym, port efemeryczny). `kontrakt.spojnosc.test.ts` woła to samo API
in-process (supertest na `srodowisko.app`), bez portów ani plików współdzielonych.
`tools/record-write-fixtures.cjs` (nie jest testem vitest, ale narzędziem) też jest
równoległo-bezpieczny: `fs.mkdtempSync` + `wolnyPort()` + tylko odczyt `db/snapshot.db`.

## Overall assessment

Techniczna robota (nagrywarka, generator, testy GATE) jest solidna i w większości zweryfikowana
niezależnie w tym review — idempotencja generatora, reprodukowalność nagrań, dowód D1 i brak
importów z `rebuild/` wszystkie się potwierdziły. Sanityzacja sekretów jest dziś szczelna
(zero tokenów/haseł w fixtures), choć bez testu regresyjnego dla błędu, który już raz się
zdarzył w tym samym tickecie. Główny problem to nie kod, tylko dokumentacja: roadmapa i backlog
zostały efektywnie pominięte, mimo że DoD i `CLAUDE.md` traktują to jako obowiązek, a stan,
który tam dziś stoi, jest wprost sprzeczny z ustaleniem D1, na którym stoi ten właśnie ticket.
To trzeba domknąć przed mergem.
