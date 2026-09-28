# 47-CHORE-i13e-frontend-bridgeone — Code review

> Reviewed: 2026-09-09
> Branch: `chore/47-i13e-frontend-bridgeone`
> Diff: 7 plików (2 źródła FE, 3 testy, plan + raport), 2 commity

## Weryfikacja wierności (zrobiona samodzielnie, nie z raportu)

Porównanie `git show main:mirror/frontend/assets/index-PRICEFMT1783512500.js` ze stanem sprzed
łatki (`.bak_szer_marka_20260904_1500`), oba rozbite po `;{}` i zdiffowane: **łatka `szer_marka`
ma DOKŁADNIE dwa hunki** i oba są w diffie ticketa:

1. `Wfmt` — usunięty blok `if(!rs.includes("/")){ … /^(A)\s*[xX]\s*(B)/ … }`; reszta funkcji
   (`s==null||s===""`, `isFinite`, pętla po tokenach, `String(N)`) bez zmian. Port w
   `formatowanie.tsx:44-62` jest równoważny — nic poza gałęzią nie zniknęło i nic nie doszło.
2. memo `L` — `.filter(e=>e&&!/\d/.test(e))` doklejone na gałęzi słownikowej marek. Port
   w `filtrowanie.ts:155-159` równoważny (`Boolean(marka) && !/\d/.test(marka)`), kolejność
   `[...zeSlownika, ...zProduktow]`, `.filter(Boolean)`, `localeCompare(…,"pl")` bez zmian.

Sprawdzone dodatkowo:

- **`listaKategorii` nietknięta** — w bundlu memo `F` też się nie zmieniło (dalej bez filtra cyfr
  i z gołym `sort()`); test-strażnik `kategorie: zwykły sort() i brak filtra cyfr` zostaje.
- **Zasięg zmiany zgodny z oryginałem** — w żywym bundlu `Wfmt` ma trzy wystąpienia: definicję,
  wywołanie w `OT` (eksport CSV) i w `DT` (tabela). Czyli CSV MA się zmienić razem z widokiem;
  w odbudowie `eksport.ts:78` woła to samo `formatujSzerokosc` i to jedyne dwa wywołania.
- **Brak wycieku na `/narzuty`** — `listaMarek` jest wołane wyłącznie z `Katalog.tsx:257`; dialog
  reguł ma własne `markiDoWyboru` (`narzuty/slownik.ts:51`), tak jak memo `h` w oryginale, które
  filtra cyfr nie ma i łatka go nie ruszyła.
- **Zera końcowe** — `formatujSzerokosc("8.00","8.00x20")` i `formatujSzerokosc(8,"8.00x20")`
  dają `"8.00"` (pętla po tokenach `rozmiar` je niesie); pokryte testem.
- **`contract/`, `rebuild/backend/`, `rebuild/schema/`, `mirror/` bez zmian** —
  `git diff --name-only origin/develop...HEAD` to potwierdza; `GET_products.json` nietknięty,
  pozycja `[2]` to faktycznie `id 97796`, `rozmiar "8.00x20"`, `szerokosc "8.00"`,
  `cenaSprzedazy 782` (→ `"782,-"`), `konstrukcja "Diagonalna"` — asercje testu są poprawne.
- **Pomiar „587 z 7395" zweryfikowany na `db/snapshot.db`**: 7405 wierszy `products`, z czego
  7395 ma niepustą `szerokosc`; stary vs nowy formater różnią się na **587** wierszach. Zgadza się.
- **Bramki FE przebiegły u mnie**: `lint` ✓, `typecheck` ✓, `build` ✓, `test` ✓ (751/751, 48 plików).
- Testy odwrócone testują NOWE zachowanie, nie „dopasowały się do implementacji": asercje
  `formatujSzerokosc(14.9,"14.9x28") === "14.9"` i `expect(wynik).not.toContain("Gruma 3")`
  na starym kodzie muszą paść. Dołożona asercja `toContain("Michelin")` chroni przed
  nadgorliwym filtrem.

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `rebuild/frontend/src/pages/katalog/formatowanie.tsx:39-40` — lista przykładów miesza dwie
      konwencje i w dwóch pozycjach jest NIEPRAWDZIWA. Zdanie brzmi „zmienia zapis
      (`8.00x20`→`8.00`, `16x6-8`→`16`, `23x10.50-12`→`23`, `300x15`→`300`)", czyli czyta się je
      jako „stary zapis → nowy zapis", ale zniesiona gałąź `AxB` oddawała tylko DWA pierwsze
      człony: dla `rozmiar="16x6-8"` pokazywała `16x6` (nie `16x6-8`), a dla `23x10.50-12` →
      `23x10.50` (sprawdzone przez uruchomienie starej wersji `Wfmt` na `db/snapshot.db`).
      Prawdziwe są tylko `8.00x20`→`8.00` i `300x15`→`300`.
  - Reason: komentarze są tu nośnikiem wiedzy o oryginale — następna sesja odtworzy z tej listy
    błędny obraz starego zachowania. Ta sama lista siedzi w `plan.md:109` i `raport.md`.
  - Suggestion: rozdzielić kolumny („`rozmiar` → nowy zapis (stary)"): `16x6-8` → `16` (było `16x6`),
    `23x10.50-12` → `23` (było `23x10.50`).
- [ ] `docs/spec-frontend.md:173` — nieaktualny fakt po tym tickecie: „obie listy to SUMA słownika
      i danych katalogu, **z filtrem „bez cyfr" wyłącznie na gałęzi produktowej marek**".
  - Reason: `spec-frontend.md` opisuje STAN (CLAUDE.md, obowiązek 1), a od tej gałęzi filtr
    obejmuje obie gałęzie marek. Zostawiony bez sprostowania będzie mylił tak samo, jak mylił
    opis endpointów w I11.
  - Suggestion: dopisać sprostowanie z datą łatki (nie przepisywać bloku historycznego I2/7c).
- [ ] `deminified/frontend-index.js` + `deminified/frontend-active-bundle.txt` — brak trwałej noty,
      że deminifikat to bundle `index-PRICEFMT…` w stanie **z 2026-08-13**, czyli SPRZED trzech
      łatek z 04.09 (`tr_fix`, `ackalerts`, `szer_marka`).
  - Reason: to główne źródło portu FE i od dziś rozjeżdża się z produkcją w co najmniej czterech
    miejscach. Komentarze w kodzie chronią tylko dwa sportowane punkty — kto następnym razem
    zacznie od `grep`a w deminifikacie, „przywróci" gałąź `AxB` jako rzekomo zgubioną.
  - Suggestion: jedna linia w `frontend-active-bundle.txt` (albo w roadmapie przy 13e) z listą
    łatek, których deminifikat NIE zawiera.
- [ ] Dokumentacja z Definition of done nie jest jeszcze w diffie: roadmapa (13e jako zrobione,
      zakres faktyczny), backlog #61 → zrobione, sprostowanie #58, nowy wpis o regresji
      `konstrukcja` w żywej produkcji.
  - Reason: plan przewiduje to jako Fazę 5, ale DoD tego wymaga — bez tego następna sesja czyta
    roadmapę opisującą zamiar, nie stan (i #58 dalej twierdzi „dokładnie jak bundle produkcji").

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/katalog/formatowanie.tsx:1-7,18` — nagłówek dalej deklaruje
      „1:1 z `Wfmt` i `DT` (`deminified/frontend-index.js:23098-23190`)", choć funkcja jest teraz
      świadomie PRZED deminifikatem (stan po łatce 04.09). Wystarczy dopisek przy odwołaniu.
- [ ] `rebuild/frontend/test/katalog.formatowanie.test.tsx:217` — asercja
      `tekstKomorki(…, "konstrukcja") === "Diagonalna"` jest poprawna dla odbudowy, ale żywa
      produkcja pokazuje tu `—` (regresja z D4). Pół zdania w komentarzu testu oszczędzi
      następnemu czytelnikowi weryfikacji, czy to nie rozjazd.
- [ ] `rebuild/frontend/test/katalog.eksport.test.ts:99-101` — `as unknown as Partial<Produkt>`
      dla `szerokosc: "8.00"`; jeśli typ `Produkt` dopuszcza wariant TEXT ze stagingu (backlog #3),
      lepiej to odzwierciedlić w typie niż podwójnym rzutowaniem w teście.

## Plan compliance

### Done ✓
- Krok 1 — `formatujSzerokosc` bez gałęzi `AxB`, docblock przepisany z 5 na 4 kroki + noty
  o łatce i o zerach końcowych (`formatowanie.tsx:23-43`).
- Krok 2 — `listaMarek` filtruje też słownik, ostrzeżenie o asymetrii przepisane, asymetria
  marka↔kategoria wprost oznaczona jako „zostaje" (`filtrowanie.ts:139-149`).
- Krok 3 — testy odwrócone i dopisane: notacja `AxB`, zera końcowe, strażnik ukośnika, pozycja
  `[2]` z fixtura, filtr marek ze słownika, przypadek CSV w `katalog.eksport.test.ts`.
- Zakres z „Poza zakresem" nie przeciekł: brak kodu pseudo-alertów, brak zmian w `rebuild/backend/`,
  `contract/`, `mirror/`, brak zmian w `listaKategorii` i w enhancerze stagingu.
- Decyzje D1–D4 spójne z tym, co widać w bundlu (rebrand i PRICEFMT faktycznie już 1:1;
  łatka `konstr` faktycznie poszła do martwego `index-BRIDGEONE2…`).

### Missing or deviating ✗
- Krok 4 (dokumentacja: roadmapa, backlog #61/#58, nowy wpis o regresji, `spec-frontend.md`) —
  nie ma go w diffie. Plan lokuje go w Fazie 5, więc to dług do domknięcia przed merge'em, nie
  odstępstwo od zamiaru.

### Definition of done
- [x] `formatujSzerokosc` bez gałęzi `AxB`; `14.9x28`/`14.9` → `"14.9"`, `8.00x20`/`"8.00"` → `"8.00"`
- [x] `listaMarek` odsiewa wartości z cyframi także ze słownika; `listaKategorii` bez zmian
- [x] Testy odwrócone/dopisane, w tym asercja przeciw pozycji `[2]` z `contract/fixtures/GET_products.json`
- [x] `contract/` i `rebuild/backend/` bez zmian w diffie gałęzi
- [x] Bramki FE zielone: `lint`, `typecheck`, `build`, `test` (751/751, potwierdzone w review)
- [ ] Roadmapa: 13e jako zrobione — brak w diffie
- [ ] Backlog: #61 → zrobione, #58 sprostowane, nowy wpis o regresji — brak w diffie
- [ ] PR do `develop` — do zrobienia

## Parallel-test concerns

Brak — dotknięte testy to czyste testy jednostkowe vitest (formatery, listy filtrów) bez bazy,
portów, plików tymczasowych ani stanu globalnego. Fixture `contract/fixtures/GET_products.json`
czytany jest tylko do odczytu.

## Overall assessment

Zmiana jest mała, dobrze uzasadniona i — co najważniejsze w tym projekcie — **wierna**:
niezależny diff obu bundli daje dokładnie te dwa hunki, które ticket portuje, ani jednego więcej,
a zasięg (tabela + CSV, bez `/narzuty`, bez `listaKategorii`) zgadza się z grafem wywołań
oryginału. Testy są odwrócone merytorycznie, nie kosmetycznie, a pomiar 587/7395 potwierdziłem
samodzielnie na `db/snapshot.db`. Blokerów nie ma; do domknięcia zostaje warstwa dokumentacyjna
(roadmapa, backlog, `spec-frontend.md`) oraz dwa mylące przykłady w komentarzu `formatowanie.tsx`,
które opisują stary zapis niezgodnie z tym, co ta gałąź faktycznie wypisywała.
