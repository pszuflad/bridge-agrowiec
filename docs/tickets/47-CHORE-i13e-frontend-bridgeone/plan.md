# 47-CHORE-i13e-frontend-bridgeone — I13/13e: frontend (rebrand + tr_fix/ackalerts/szer_marka/PRICEFMT)

> Status: Draft
> Branch: `chore/47-i13e-frontend-bridgeone`
> Worktree: `.worktrees/47-CHORE-i13e-frontend-bridgeone`

## Opis ticketa

Ostatnia karta toru I13 (13d odłożone). Frontend odbudowy ma odtworzyć pięć zmian, które Ania
wdrożyła w zminifikowanym bundlu produkcji między 2026-07-31 a 2026-09-04: rebrand „Bridge ONE"
oraz łatki oznaczone `tr_fix`, `ackalerts`, `szer_marka`, `PRICEFMT`. Nazwa kopii `.bak` daje tylko
ETYKIETĘ — realny zakres trzeba było ustalić z diffu bundla. Backlog #61, roadmapa §5 blok I13 (13e).

## Kontekst

### Rozkład diffu — co każda etykieta NAPRAWDĘ zmienia

Materiał: `git show main:mirror/frontend/assets/<plik>` (kopie `.bak` istnieją **tylko na `main`**,
weszły commitem `31aa0e5`/`d88ac15` z 2026-09-08; na `develop` ich nie ma). Bundle rozbite na
kawałki po `;{}` i porównane `diff -u`.

**Łańcuch kopii (ta sama godzina = ta sama łatka przyłożona do dwóch plików):**

| kopia | data | znaczenie |
|---|---|---|
| `.bak_konstr_20260901_1122` | 01.09 11:22 | stan przed łatką `konstr` (tylko BRIDGEONE2) |
| `.bak_tr_fix_20260904_1418` | 04.09 14:18 | stan przed `tr_fix` |
| `.bak_ackalerts_20260904_1440` | 04.09 14:40 | stan przed `ackalerts` |
| `.bak_szer_marka_20260904_1500` | 04.09 15:00 | stan przed `szer_marka` |
| plik bez sufiksu | — | stan bieżący (po wszystkim) |

**⚠ Który bundle jest ŻYWY.** `mirror/frontend/index.html:16` ładuje
`./assets/index-PRICEFMT1783512500.js`. `index-BRIDGEONE21783342500.js` to poprzednie wydanie,
martwe od łatki `pricefmt` (potwierdzenie: `index.html.bak_pre_pricefmt_20260731` wskazuje jeszcze
BRIDGEONE2). Linia rodowa: `AUTOFILL` → `BRIDGEONE` (31.07 13:01) → `BRIDGEONE2` (31.07 13:55) →
`PRICEFMT` (31.07). Łatki `tr_fix`/`ackalerts`/`szer_marka` Ania przyłożyła do OBU plików,
łatkę `konstr` — tylko do martwego (patrz „Rozjazdy").

#### 1. rebrand „Bridge ONE" (2026-07-31, nie 09-01…04)

- `index.html`: `<title>Bridge dla Agrowca — konsolidacja cenników opon</title>` →
  `<title>Bridge ONE — konsolidacja cenników opon</title>`. `<meta name="description">` bez zmian.
- bundle, trzy miejsca: `children:"Bridge"` → `children:"BridgeOne"` (**bez spacji**) —
  nagłówek mobilny, nagłówek sidebara, `<h1>` ekranu logowania.
- usunięty podtytuł „dla Agrowca" w dwóch miejscach (`<div class="text-xs …">` w sidebarze,
  `<p class="text-sm …">` na logowaniu).
- `aria-label="Bridge"` na SVG logo — **bez zmian**. Teksty pomocnicze („Bridge sam rozpozna
  dostawcę…", „monitorowanych przez Bridge") — bez zmian.

**Stan odbudowy: JUŻ 1:1** — `rebuild/frontend/index.html:6`, `src/components/AppShell.tsx:47,73`,
`src/pages/Login.tsx:48`. Weszło ticketem 2 (`751a8e2`), bo deminifikat robiono z bundla PO
rebrandzie. Data „2026-09-01…04" w backlogu #61 opisuje nazwę PLIKU bundla, nie rebrand.

#### 2. `PRICEFMT` — komórka „Cena sprzedaży" w katalogu

Diff `index-BRIDGEONE2….bak_tr_fix` vs `index-PRICEFMT….bak_tr_fix` (te same godziny, więc izoluje
samą łatkę `pricefmt`). W `DT` (formater komórki katalogu):

```js
// przed:  if("cenaZakupu"===t||"cenaSprzedazy"===t) return "number"==typeof n ? n.toFixed(2) : "—";
// po:     if("cenaZakupu"===t)    return "number"==typeof n ? n.toFixed(2) : "—";
//         if("cenaSprzedazy"===t) return "number"==typeof n ? `${Math.floor(n)},-` : "—";
```

`cenaZakupu` zostaje `1234.56`, `cenaSprzedazy` staje się `1234,-`. Eksport CSV (`OT`) — nietknięty.

**Stan odbudowy: JUŻ JEST** — `src/pages/katalog/formatowanie.tsx:167,169`, pokryte asercją
`tekstKomorki(pierwszy,"cenaSprzedazy") === "7252,-"` w `test/katalog.formatowanie.test.tsx:186`.

#### 3. `tr_fix` — jeden token mniej w liście słów „to nie opona"

```js
// h2 (lista słów dyskwalifikujących): usunięto "tr-"
["…","wentyl","valve","zawór","zawor",  "tr-",  "łańcuch",…]   // przed
["…","wentyl","valve","zawór","zawor",          "łańcuch",…]   // po
```

`h2` czyta wyłącznie `v2(nazwa, kategoria)` (klasyfikator „opona / nie-opona"), a `v2` woła wyłącznie
`pv()` — silnik PSEUDO-ALERTÓW liczonych z `GET /api/products`. Regex `\btr-\b` łapał `TR-135`
w nazwach opon BKT (granica słowa wypada między `-` a cyfrą), więc opony trafiały na alert
„Nie-opona w katalogu — błąd parsera". Łatka to fałszywe trafienie usuwa.

#### 4. `ackalerts` — cztery zmiany, wszystkie w silniku pseudo-alertów

1. **Odcisk wartości w `id` alertu** — potwierdzenie przestaje kleić się do alertu na zawsze:
   `${id}-marza-ujemna` → `${id}-marza-ujemna-${Math.round(marzaPct*10)/10}`; tak samo
   `-marza-niska`; `${id}-nie-opona` → `…-${(nazwa||'')+'|'+(kategoria||'')}`;
   `dostawca-${d}-brak-importu` → `…-${dniOdImportu}` (obie gałęzie, ≥7 i ≥30 dni).
2. **Pulpit (`N2`) respektuje potwierdzenia** — dokłada `useState`+`useEffect`, czyta
   `alerty-statusy` z IndexedDB i przekazuje do `pv(produkty, statusy)` zamiast `pv(produkty, {})`.
3. **Zdarzenie synchronizujące** — widok alertów po zapisie statusów robi
   `window.dispatchEvent(new Event("alerty-statusy-updated"))`, pulpit na nie nasłuchuje.
4. **Ukrycie rozwiązanych** — `.filter(e => e.status!=="rozwiazany" || filtrStatusu==="rozwiazany")`.

#### 5. `szer_marka` — **NIE kolumna**: dwie poprawki (szerokość + marka)

**(a) `Wfmt` traci gałąź `AxB`** (formater szerokości, wspólny dla tabeli `DT` i eksportu `OT`):

```js
// USUNIĘTE:
if(!rs.includes("/")){
  const xm = rs.match(/^([0-9]+(?:[.,][0-9]+)?)\s*[xX]\s*([0-9]+(?:[.,][0-9]+)?)/);
  if(xm){ const seg1=xm[1].replace(",","."); if(Number(seg1)===N) return `${seg1}x${xm[2].replace(",",".")}` }
}
```

Skutek: dla `rozmiar="14.9x28"`, `szerokosc=14.9` kolumna pokazywała `14.9x28`, teraz `14.9`.
**Pomiar na `db/snapshot.db`: 587 z 7395 pozycji zmienia wyświetlanie** (`8.00x20`→`8.00`,
`16x6-8`→`16`, `23x10.50-12`→`23`, `300x15`→`300`). Zera końcowe z `rozmiar` zostają zachowane
(pętla po tokenach `rozmiar` działa dalej) — `8.00x20`/`szerokosc="8.00"` daje `8.00`, nie `8`.

**(b) filtr „marka bez cyfr" rozszerzony na wartości ze SŁOWNIKA:**

```js
// przed: t=(I?.wartosci||[]).filter(e=>"marka"===e.rodzaj).map(e=>e.wartosc)
// po:    t=(I?.wartosci||[]).filter(e=>"marka"===e.rodzaj).map(e=>e.wartosc).filter(e=>e&&!/\d/.test(e))
```

Dotąd filtr wisiał tylko na gałęzi produktowej — asymetria była w odbudowie świadomie
odtworzona i opisana (`filtrowanie.ts:137-143`). Łatka ją **znosi po stronie marek**;
kategorie (`listaKategorii`) filtra dalej nie mają w żadnej gałęzi.

### Stan odbudowy wobec pięciu etykiet

`deminified/frontend-index.js` to bundle **PRICEFMT w stanie sprzed 04.09** (zmierzone:
zawiera `"tr-"`, `id` alertów bez odcisku, `Wfmt` z gałęzią `AxB`, ale już `Math.floor(n),-`).
Dlatego port z I0–I12 wciągnął rebrand i PRICEFMT automatycznie, a trzech łatek z 04.09 nie.

| etykieta | odbudowa | robota w 13e |
|---|---|---|
| rebrand | 1:1 od ticketa 2 | brak kodu, decyzja D1 |
| PRICEFMT | 1:1 (`formatowanie.tsx:167,169`) | brak |
| tr_fix | brak `pv`/`v2`/`h2` — pseudo-alertów nie ma (D1 z I6) | brak, decyzja D2 |
| ackalerts | j.w.; pkt 2 spełniony konstrukcyjnie (pulpit czyta REALNE statusy) | brak, decyzje D2/D4 |
| szer_marka | stan sprzed łatki w obu miejscach | **cały kod ticketa** |

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

Ticket **nie dotyka API** — zmiany są wyłącznie w warstwie prezentacji frontendu. Żaden endpoint,
żaden kształt odpowiedzi ani kod HTTP się nie zmienia; `rebuild/backend/` nie jest ruszany.

Fixtures wchodzą jako **dane wejściowe testów FE**, nie jako przedmiot zmiany:

- `contract/fixtures/GET_products.json` (`/api/products?limit=5`, 72 klucze, `body.items`) —
  `test/katalog.formatowanie.test.tsx` porównuje formatery z prawdziwą pozycją. Pozycja `[2]`
  (`id 97796`, `rozmiar:"8.00x20"`, `szerokosc:"8.00"`) jest DOKŁADNIE przypadkiem, który
  `szer_marka` zmienia: `"8.00x20"` → `"8.00"`. Fixture zostaje NIETKNIĘTY — zmienia się
  oczekiwanie testu, bo zmienia się formater, a nie dane.
- `contract/fixtures/GET_alerts.json` — poza zakresem (nie portujemy `ackalerts`).

GATE odbudowy w wersji „nie dotyka kontraktu": uzasadnienie wyżej + dowód, że zestaw
`contract/` nie ma zmian w diffie gałęzi.

## Decyzje

**D1 — rebrand: zostaje jak jest, bez zmian w kodzie.** Odbudowa ma już `<title>Bridge ONE —
konsolidacja cenników opon</title>` i `BridgeOne` w trzech miejscach UI, czyli stan produkcji 1:1.
Rozjazd zapisu („Bridge ONE" w tytule vs „BridgeOne" w UI) JEST w bundlu Ani i odtwarzamy go
świadomie. Odrzucone: ujednolicenie na „Bridge ONE" (byłoby odstępstwem) oraz sprzątanie
`package.json`/`README.md` (produkcja tych plików nie ma; poza zakresem). Backlog #61
„Do nowej wersji? ⬜ do decyzji" rozstrzygnięty: **✅ TAK — i już jest**.

**D2 — `tr_fix` i punkty 1–3 `ackalerts`: nie portujemy, bo nie ma czego.** Obie łatki żyją
w silniku pseudo-alertów (`pv`/`v2`/`h2` + IndexedDB `alerty-statusy`), którego odbudowa
świadomie nie ma — decyzja D1 z I6 (`18-FEATURE-widok-alerty`), udokumentowana w
`src/pages/Alerty.tsx:4-10`, `src/pages/pulpit/kpi.ts:53-59` i backlogu #26 (⬜ do decyzji).
`/alerty` odbudowy stoi na REALNYCH alertach importu z `GET /api/alerts`. Punkt 2 `ackalerts`
(pulpit ma respektować potwierdzenia) jest w odbudowie spełniony konstrukcyjnie: `aktywneAlerty()`
filtruje po `status === "nowy"` z realnej odpowiedzi API, więc potwierdzenie zawsze schodzi
z licznika — bez IndexedDB i bez zdarzenia `alerty-statusy-updated`. Odrzucone: pełny port
pseudo-alertów (cofa D1 z I6, dwa różne zbiory pod jednym linkiem).

**D3 — `ackalerts` pkt 4 (ukrycie rozwiązanych): nie portujemy.** Oryginał ma TRZY statusy
(`nowy`/`przejrzany`/`rozwiazany`) i domyślny filtr „wszystkie", więc reguła „ukryj `rozwiazany`,
chyba że wybrano go wprost" realnie coś zawęża. Odbudowa ma DWA statusy i domyślny filtr ustawiony
na `nowy` (`grupowanie.ts:41-45`), więc ta sama reguła zdegenerowałaby opcję „Wszystkie statusy"
do duplikatu opcji „nowy". Cel łatki (rozwiązane nie zaśmiecają listy roboczej) odbudowa realizuje
już domyślnym filtrem. Odrzucone: port mimo degeneracji; port + usunięcie martwej opcji z `Select`
(to już byłoby odstępstwo — oryginalny `Select` tę opcję ma).

**D4 — regresja `konstrukcja` w żywej produkcji: NIE odtwarzamy, prostujemy dokumentację.**
Łatka `konstr` z 01.09 11:22 (pass-through `n||""` / `n||null` obok mapowania kodów) trafiła
do `index-BRIDGEONE21783342500.js`, którego `index.html` nie ładuje — potwierdza to
`mirror/backend/CHANGELOG.md:101`, gdzie Ania wpisała właśnie tę ścieżkę. Żywy
`index-PRICEFMT1783512500.js` ma `…"Diagonalna":""` / `…"Diagonalna":null`, czyli **produkcja
pokazuje dziś „—" w kolumnie „Konstrukcja opony" i pustą kolumnę w eksporcie CSV** dla wszystkich
7392 wierszy zmigrowanych na pełne słowa. Odbudowa po 13c ma pass-through i działa POPRAWNIE —
to od dziś **świadome odstępstwo od żywej produkcji**, nie „port 1:1". Odrzucone: usunięcie
pass-through, żeby odtworzyć regresję (świadome wdrożenie zepsutego zachowania i cofnięcie 13c).
Skutek dokumentacyjny: sprostowanie fałszywego faktu w backlogu #58 („dokładnie jak bundle
produkcji od 2026-09-01") + nowy wpis backlogu opisujący regresję do zgłoszenia Ani.

### Świadome odstępstwa od oryginału po tym tickecie

- **D4** — pass-through `konstrukcja` (odbudowa poprawniejsza niż żywy bundle produkcji).
- **D2/D3** — brak pseudo-alertów katalogowych; kontynuacja D1 z I6, backlog #26.
- Brak nowych odstępstw poza powyższymi.

## Plan implementacji

**Krok 1 — `szer_marka` (a): `formatujSzerokosc` traci gałąź `AxB`.**
`rebuild/frontend/src/pages/katalog/formatowanie.tsx:36-64` — usunąć blok
`if (!tekstRozmiaru.includes("/")) { … notacjaAxB … }`. Docblock (`:19-35`) opisuje pięć kroków
i wprost wymienia krok 3 („cała notacja `AxB`") — przepisać na cztery kroki i dopisać, że
gałąź została zdjęta łatką `szer_marka` z 2026-09-04 (bundle `index-PRICEFMT…`, kopia
`.bak_szer_marka_20260904_1500`), z pomiarem 587/7395. `eksport.ts:78` woła tę samą funkcję,
więc CSV zmienia się razem z tabelą — dokładnie jak `OT`/`DT` w oryginale. Bez zmian w `eksport.ts`.

**Krok 2 — `szer_marka` (b): `listaMarek` filtruje też słownik.**
`rebuild/frontend/src/pages/katalog/filtrowanie.ts:146-156` — dopisać
`.filter((wartosc) => Boolean(wartosc) && !/\d/.test(wartosc))` na `zeSlownika`. Przepisać ostrzeżenie
`⚠ FILTR „BEZ CYFR" DOTYCZY WYŁĄCZNIE MAREK Z PRODUKTÓW` (`:137-143`) — od tej łatki dotyczy OBU
gałęzi; zostawić informację, że `listaKategorii` filtra dalej nie ma (asymetria marka↔kategoria
przetrwała) i że wcześniejszy stan był poprawny do 2026-09-04.

**Krok 3 — testy.**
- `test/katalog.formatowanie.test.tsx:68-74` — test „dla rozmiaru w notacji AxB oddaje całą
  notację" (`14.9x28`) odwrócić na „z notacji AxB bierze sam pierwszy człon" → `"14.9"`;
  test „notacji AxB nie stosuje, gdy rozmiar zawiera ukośnik" przepisać na strażnika rozmiarów
  ze slashem (`620/70R42` → `"620"`) bez odwoływania się do nieistniejącej już gałęzi.
- Dołożyć test zer końcowych dla `AxB`: `formatujSzerokosc("8.00","8.00x20") === "8.00"`
  (najłatwiejsza regresja do wprowadzenia „upraszczając" pętlę po tokenach).
- `test/katalog.formatowanie.test.tsx:182-190` — rozszerzyć test przeciw fixture o pozycję `[2]`
  z `GET_products.json` (`8.00x20`), żeby zmiana była zakotwiczona w nagranych danych produkcji.
- `test/katalog.filtrowanie.test.ts:197-205` — test „filtr «bez cyfr» dotyczy WYŁĄCZNIE marek
  z produktów" odwrócić: `"Gruma 3"` ze słownika ma teraz WYPAŚĆ. Zaktualizować komentarz.
- `test/katalog.eksport.test.ts` — sprawdzić, czy któraś asercja CSV opiera się o `szerokosc`
  w notacji `AxB`; jeśli tak, poprawić, jeśli nie — dopisać przypadek, bo eksport zmienia się razem.

**Krok 4 — dokumentacja** (Faza 5, doc-checkery): roadmapa (13e jako zrobione, ze stanem
faktycznym: kodu tylko `szer_marka`), backlog #61 (→ zrobione, z rozkładem etykiet i decyzjami
D1–D3), backlog #58 (sprostowanie faktu o bundlu produkcji), NOWY wpis backlogu o regresji
`konstrukcja` w żywej produkcji, `docs/spec-frontend.md` (zapis szerokości + lista marek).

## Strategia testów

- **Gate odbudowy (fixtures/kontrakt): N/D** — ticket nie dotyka API. Dowód: diff gałęzi nie
  rusza `contract/` ani `rebuild/backend/`. Zamiast tego fixtures wchodzą jako dane wejściowe
  testów FE (pozycje `[0]` i `[2]` z `GET_products.json`).
- **Jednostkowe (vitest):** formatowanie szerokości (tabela + eksport CSV), lista marek.
  Pełne bramki FE: `npm run lint && npm run typecheck && npm run build && npm test`
  w `rebuild/frontend/` (Node ≥ 20).
- **Backend:** nietknięty, bramek nie uruchamiamy poza kontrolnym `git diff --stat`.
- Pomijamy E2E — zmiana jest czysto prezentacyjna i w całości pokryta testami jednostkowymi
  spiętymi z nagraną odpowiedzią produkcji.

## Poza zakresem

- Port silnika pseudo-alertów (`pv`/`v2`/IndexedDB) — backlog #26, decyzja D2.
- Zmiana nazwy w UI na „Bridge ONE" ze spacją, `package.json`, `README.md` — decyzja D1.
- Naprawa regresji `konstrukcja` PO STRONIE PRODUKCJI (to robota na VPS u Ani) — decyzja D4,
  z ticketa wychodzi tylko wpis w backlogu.
- Enhancer konfiguratora kolumn stagingu (`ex_marka`/`ex_szerokosc` doklejone niezminifikowane
  w bundlu) — mylące skojarzenie z etykietą `szer_marka`, ale to inna, wcześniejsza zmiana;
  odbudowa go nie ma i 13e go nie wnosi.
- Jakikolwiek kod w `rebuild/backend/` — konwencje `nazwa`/`konstrukcja` domknięte w 13b/13c.

## Definition of done

- [ ] `formatujSzerokosc` bez gałęzi `AxB`; `14.9x28`/`14.9` → `"14.9"`, `8.00x20`/`"8.00"` → `"8.00"`
- [ ] `listaMarek` odsiewa wartości z cyframi także ze słownika; `listaKategorii` bez zmian
- [ ] Testy odwrócone/dopisane w `katalog.formatowanie.test.tsx` i `katalog.filtrowanie.test.ts`,
      w tym asercja przeciw pozycji `[2]` z `contract/fixtures/GET_products.json`
- [ ] `contract/` i `rebuild/backend/` bez zmian w diffie gałęzi
- [ ] Bramki FE zielone: `lint`, `typecheck`, `build`, `test`
- [ ] Roadmapa: 13e oznaczone jako zrobione (data + ID), zakres FAKTYCZNY, nie planowany
- [ ] Backlog: #61 → zrobione z decyzjami D1–D3; #58 sprostowane; nowy wpis o regresji produkcji
- [ ] PR do `develop`
