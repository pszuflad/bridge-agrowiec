# 59-CHORE-i14j — raport z pomiaru

## Podsumowanie

Karta pomiarowa, zamknięta **bez ani jednej zmiany w kodzie produkcyjnym** (`git diff` po
`rebuild/backend/src/` jest pusty).

**Zadanie A — wynik główny: 0 rozjazdów na 49 813 porównanych wpisach, 59/59 przypadków
zgodnych.** Trzy trasy historii oddają w odbudowie dokładnie to, co w oryginale — na komplecie
pól, na kolejności wierszy, na licznikach i na wszystkich filtrach. Drugi przebieg, z zasianą
gałęzią eksportu, dał **0 rozjazdów na 49 846 wpisach**. Ręczny test §9 instrukcji I5, którego
Ania nie wykonała, jest tym samym zastąpiony pomiarem i **zamrożony w bramkach** jako
`rebuild/backend/test/historia.wyrocznia.test.ts` (13 przypadków).

**Zadanie B — instrukcja I5 §3.3 jest nieaktualna i trzeba ją poprawić.** Edycja produktu
zostawia ślad po OBU stronach identycznie (2 wiersze `history` na 2 zmienione pola, ten sam
wpis w `/paged`). Założenie karty, że odbudowa może nie zapisywać eksportów, **okazało się
nieprawdziwe** — zapisuje, zmierzone.

**Znalezisko uboczne, defekt PRODUKCJI: `GET /api/export-shoper` bez `?dostawca=` (eksport
wszystkich do ZIP-a) jest w produkcji trwale zepsuty — zawsze HTTP 500.** Zgodnie z zakresem
karty **nie naprawiam**; propozycja osobnej karty niżej.

**Zadanie C — wpis backlogu `#87`** o `LIMIT_AUDYTU = 5000`, `Do nowej wersji?` = ⬜ do decyzji.

---

## Jak mierzyłem

Dwa żywe backendy na kopiach tej samej bazy, nigdy na oryginale pliku. Przepis wzięty
z `tools/record-write-fixtures.cjs`, nie wymyślany od nowa.

| Strona | Jak postawiona |
|---|---|
| Oryginał | Kopia całego `mirror/backend` do katalogu tymczasowego, `db/snapshot.db` jako `data.db` **obok** `index.cjs`, **`npm ci`**, `UPDATE suppliers SET czestotliwosc_minuty = NULL` **przed** startem, CWD = katalog piaskownicy, port efemeryczny. **Bez naszych migracji** — wyrocznia chodzi na surowym snapshocie |
| Odbudowa | Druga kopia `db/snapshot.db`, `DB_PATH` na nią, `npm run migrate:dev` (6 migracji), `tsx src/server.ts`, port efemeryczny, `IMPORT_SCHEDULER=false` |

Log startu oryginału potwierdził `[scheduler] zaplanowano 0 dostawców z URL polling` — **żaden
ruch nie wyszedł na zewnątrz**.

**Logowanie było symetryczne** — obie strony przez `POST /api/login` na konto
`marta.bieguniak@agrowiec.eu`, hasłem z własnego seeda oryginału, tym samym, którego używa
nagrywarka fixtures. Żadnych hashy nie podmieniałem i po żadne sekrety nie sięgałem.

### ⚠ Poprawka do przepisu: `npm ci`, a nie `npm install`

To nie jest kosmetyka i kosztowało jeden fałszywy wynik. `mirror/backend/package.json` deklaruje
**sześć** zależności, ale `package-lock.json` ma ich więcej — w tym `archiver@5.3.2`, którego
`package.json` nie zna, a z którego korzysta gałąź ZIP eksportu. Przy `npm install` archivera
w piaskownicy **nie ma**, więc trasa oddaje 500 z powodu piaskownicy. Pierwszy przebieg tak
właśnie zrobił i wyglądało to na defekt produkcji. Dopiero `npm ci` odtwarza `node_modules`
produkcji — i dopiero wtedy 500 znaczy cokolwiek (patrz „Znalezisko uboczne").

### Trzy pułapki z karty — rozbrojone pomiarem, nie rozumowaniem

**1. Auth nie jest symetryczne.** Potwierdzone: rdzeń rejestruje `/meta` i `/paged` bez
`requireAuth` (`:48335`, `:48352`), a `pagination_module.cjs:134-181` rejestruje je PONOWNIE
z auth — łącznie trzy rejestracje, wszystkie po rdzeniu, więc Express bierze wariant bez auth.
Odbudowa ma `requireAuth` (D1 z I1). Harness loguje się do obu stron i **różnicy w kodzie
odpowiedzi nie traktuje jako znaleziska** — wszystkie 59 przypadków to 200/200.

**2. Migracje.** Zweryfikowane, nie założone — i to **asercją startową, która przerywa pomiar**,
gdyby wyszło inaczej:

> `OK — history: 46916 wierszy, audit_log: 3873 wierszy, schematy identyczne`

Porównywane po obu stronach: liczba wierszy, `PRAGMA table_info` (nazwy + typy kolumn) oraz
min/max/suma `id`. Migracje 001–006 **nie dotykają** `history` ani `audit_log` — ani DDL, ani
DML; jedyne trafienia grepem to komentarze w 004/006 tłumaczące, że wierszy do `history`
świadomie nie dokładają. Porównanie jest więc uczciwe mimo asymetrii migracji.

**3. Projekcja Drizzle — pułapka tu NIE WYSTĘPUJE, i to jest zmierzone.**
`listHistory()` oryginału to **Drizzle**, nie raw `better-sqlite3`
(`X.select().from(Wa).orderBy(desc(Wa.data)).all()`, `:44962-44964`), więc oryginał sam oddaje
nazwy PÓL modelu. Zestaw kluczy porównany osobno, po obu stronach identyczny:

> `data, id, kodProduktu, kto, nazwa, nowaWartosc, pole, staraWartosc, wykonalUzytkownikId, zrodlo`

To **inny przypadek niż `GET /api/selly/log`**; `contract/README.md:36-40` wymienia trasy
raw-SQL (`uwagi-cena`, `hold-reasons`, `selly/log`) i historii tam nie ma. Zestaw kluczy jest
osobno zamrożony w trwałym teście — gdyby ktoś kiedyś przepisał tę trasę na surowy SQL,
wyszłyby `snake_case` i test to złapie.

---

## ZADANIE A — oracle diff trzech tras

### Przebieg 1 — dane produkcji (bez zasiewu)

> **59/59 przypadków ZGODNYCH · 0 rozjazdów · 49 813 wpisów porównanych.**

Materiał wejściowy: `history` **46 916** wierszy, `audit_log` **3 873** wiersze, z czego przez
słownik `typWpisu()` przechodzi **270** (`edycja_produktu` 178 + `upload_pliku` 92).
`GET /api/history/paged` pokazuje `total: 270`, `pages: 6`.

| Grupa | Przypadków | Zgodnych | Co obejmuje |
|---|---|---|---|
| `GET /api/history` | 1 | 1 | cała tabela — **46 916 wierszy porównanych wiersz po wierszu** |
| `GET /api/history/meta` | 1 | 1 | lista 8 dostawców, razem z kolejnością |
| `/paged` bez filtrów | 1 | 1 | domyślne `page=1&limit=50` |
| `/paged` filtr `typ` | 4 | 4 | `all`, `import` (92), `eksport` (0), `edycja` (178) |
| `/paged` filtr `dostawca` | 9 | 9 | `all` + każdy z 8 kodów z `/meta` |
| `/paged` filtr `search` | 12 | 12 | frazy trafiające w kod dostawcy, nazwę pola, „Plik:", nazwę typu, użytkownika, fragment nazwy pliku, fraza bez trafień i `search` pusty |
| `/paged` paginacja | 18 | 18 | `limit` ∈ {25, 50, 100} × `page` ∈ {1, 2, 3, 4, 11, 12}, łącznie ze stronami pustymi |
| `/paged` skrajne | 13 | 13 | `limit=0/1/201/abc`, `page=0/abc/-3/99999`, kombinacje filtrów, `typ` i `dostawca` bez trafień |

Porównanie było **głęboką równością całych ciał**, nie porównaniem liczników: różnica
pojedynczego pola w 46 916. wierszu albo zamiana dwóch wierszy miejscami wywróciłaby przypadek.

**Potwierdzone przy okazji trzy dziwactwa opisane Ani w §11 instrukcji I5** — po obu stronach
identycznie, czyli odtworzone wiernie:
- kolejność dostawców `MO1, MO10, MO2, MO3, MO6, MO7, MO8, MO9` (leksykograficzna, nie liczbowa);
- `search` przeszukuje cały wpis, nie tylko pola z podpowiedzi — `search=import` daje 92 trafienia
  po nazwie typu, `search=Plik:` też 92 po tekście składanym w `uwagi`;
- arytmetyka paginacji: `limit=0` → 50, `limit=201` → 200, `page=0`/`page=abc`/`page=-3` → 1.

### Przebieg 2 — z zasianą gałęzią eksportu (plan.md D3)

> **59/59 przypadków ZGODNYCH · 0 rozjazdów · 49 846 wpisów porównanych.**

⚠ **Ten przebieg opiera się na danych ZASIANYCH PRZEZE MNIE, nie na danych produkcji.**
W `db/snapshot.db` nie ma ani jednego wiersza `eksport_csv`, `eksport_shoper` ani
`import_cennika`, więc trzy z pięciu akcji słownika były na żywych danych **nieosiągalne** —
pole `format`, tekst `uwagi: "Format: …"` i filtr `typ=eksport` zostałyby bez pomiaru, mimo że
Ania ma na eksport checkbox w §8.2 instrukcji.

Doszyłem po **obu stronach identyczne** 5 wierszy (te same `id`, `kiedy`, `szczegoly_json`),
celowo dobrane pod gałęzie mapowania: eksport CSV z liczbą produktów, eksport Shoper z liczbą
dostawców, eksport **bez żadnej liczby** (łańcuch fallbacków do `null`), import z nazwą pliku
i import **bez** `szczegoly_json` (gałąź „Plik: ?" z §8.1).

Wynik: `typ=eksport` → 3 wpisy, `typ=import` → 94, `search=Format:` → 3, `search=eksport` → 3 —
**wszystkie identyczne po obu stronach**, wraz z polem `format` i tekstem `uwagi`.

### Lista rozjazdów zadania A

> **BRAK.** Zero rozjazdów w obu przebiegach, na 59 przypadkach każdy, na łącznie
> **49 813 + 49 846 porównanych wpisach**.

---

## ZADANIE B — czy nowe ścieżki zostawiają ślad

### Dobór produktu — dlaczego akurat ten

Produkt **`id=97794`, kod `MO9_336320`**. Migracje 003–006 zmieniają po stronie odbudowy
`szerokosc` (REAL→TEXT, praktycznie każdy wiersz), `kategoria`, `konstrukcja` i `nazwa`, więc
produkt identyczny CAŁYM wierszem po obu stronach **nie istnieje** — pierwsze podejście padło
dokładnie na tym założeniu. Porównywane są zatem wyłącznie pola, które **wchodzą do wiersza
`history`**: `kod` → `kod_produktu`, `nazwa` → `nazwa`, oraz oba pola edytowane → `stara_wartosc`.
Reszta wiersza produktu do dziennika nie trafia. Pola edytowane (`dot`, `labelSnow`) są celowo
spoza zasięgu migracji 003–006.

### B1 — edycja polami z allowlisty: PEŁNA PARZYSTOŚĆ

`PATCH /api/products/97794` z `{dot: "14J-DOT", labelSnow: "TAK"}`, identyczne ciało po obu
stronach. **200/200.**

| Co | Oryginał | Odbudowa |
|---|---|---|
| Nowych wierszy w `history` | **2** | **2** |
| `/api/history/paged?typ=edycja&search=MO9_336320` → `total` | 1 | 1 |
| Różnic w treści wierszy | — | **0** |
| Różnic w odpowiedzi `/paged` | — | **0** |

Wiersze wyszły co do znaku identyczne, łącznie z odtworzonym dziwactwem oryginału: przy polu,
które miało w bazie `NULL`, `staraWartosc` to **napis `"null"`**, a nie puste pole.

```
{ kodProduktu: "MO9_336320", nazwa: "620/70R42 BKT AGRIMAX FACTOR 166D/169A8 TL",
  pole: "dot", staraWartosc: "nie starsza niz 3 lata", nowaWartosc: "14J-DOT",
  zrodlo: "recznie", kto: "Marta Bieguniak", wykonalUzytkownikId: 1 }
{ …, pole: "labelSnow", staraWartosc: "null", nowaWartosc: "TAK", … }
```

**Wniosek: `docs/instrukcja-testow-I5.md` §3.3 („Typ »Edycje« — nowych wpisów nie przybędzie",
bo katalog jest tylko do odczytu) jest NIEAKTUALNA od 12a/12c.** Wpisów typu *edycja*
przybędzie i mają one wychodzić identycznie jak w starym Bridge. Instrukcja I5 leży na
niezmergowanej gałęzi `origin/docs/instrukcja-testow-i5`, więc poprawka to osobna decyzja —
patrz „Follow-up".

### B2 — sonda allowlisty (plan.md D4): odstępstwo #14/D1 ma teraz LICZBĘ

`PATCH` z polem **`hf`**, które jest kolumną tabeli, ale nie ma go w
`POLA_EDYTOWALNE_PRODUKTU` (`rebuild/backend/src/repos/products.ts:199-247`). **200/200.**

| Co | Oryginał | Odbudowa |
|---|---|---|
| Nowych wierszy w `history` | **1** | **0** |
| `zmienionePola` we wpisie `/paged` | `["hf"]` (1 pozycja) | `[]` (0 pozycji) |
| `total` w `/paged` | 2 | 2 |

Czyli: **oryginał zapisuje zmianę dowolnego pola z ciała żądania, odbudowa tylko pól z listy.**
To **zatwierdzone odstępstwo** (backlog #14, D1 ticketu 35), nie regresja — ale wychodzi też
rzecz, której backlog nie opisywał: **odbudowa i tak zapisuje wpis audytu `edycja_produktu`,
nawet gdy nie zmieniła ani jednego pola**, więc w Historii pojawia się wpis typu *edycja*
z **pustą** listą zmienionych pól. Oryginał w tej samej sytuacji pokazuje `["hf"]`. Praktyczny
skutek jest niewielki (trzeba wysłać pole spoza listy, a UI takiego nie wysyła), ale to
zachowanie warto znać — dopisane do follow-upu.

### B3 — ścieżka eksportu: odbudowa te akcje ZAPISUJE

Założenie karty („sprawdź, czy cokolwiek w odbudowie te akcje dziś zapisuje; jeśli nie, napisz
to wprost") **jest nieaktualne** — zapisuje, `rebuild/backend/src/routes/export-shoper.ts:108,133,171`.

| Trasa | Oryginał | Odbudowa | Akcja audytu |
|---|---|---|---|
| `GET /api/export-shoper?dostawca=MO1` (CSV) | **200** | **200** | `eksport_csv` po obu stronach |
| `GET /api/export/shoper` (CSV z konfiguracji) | **200** | **200** | `eksport_shoper` po obu stronach |
| `GET /api/export-shoper` (bez parametru → ZIP wszystkich) | **500** | **200** | oryginał **nic nie zapisuje**, odbudowa `eksport_csv` |

Dwie z trzech ścieżek są parzyste. Trzecia to defekt produkcji — niżej.

---

## Znalezisko uboczne — defekt PRODUKCJI, nie naprawiam (zakres karty)

**`GET /api/export-shoper` bez `?dostawca=` (eksport wszystkich dostawców do ZIP-a) oddaje
w produkcji HTTP 500 — zawsze, od zawsze i niezależnie od danych.**

Dowód, zmierzony na piaskownicy z zależnościami odtworzonymi z **lockfile'a produkcji**
(`npm ci`, kontrola w logu: `archiver w piaskownicy: JEST`) — czyli **nie** jest to artefakt
brakującego modułu:

```
zip pipeline failed TypeError: oh is not a constructor
    at rV (…/index.cjs:313:6525)
GET /api/export-shoper 500 in 49ms :: {"error":"oh is not a constructor"}
```

**Mechanizm.** `rV()` (`deminified/backend-index.cjs:48139`) robi
`let t = await import("archiver"); oh = t.ZipArchive ?? t.default?.ZipArchive`. To jest API
**archivera 8.x**, gdzie `ZipArchive` jest eksportem nazwanym. `mirror/backend/package-lock.json`
przypina **`archiver@5.3.2`**, którego eksporty to `create, registerFormat, isRegisteredFormat`
— **`ZipArchive` tam nie istnieje** (sprawdzone instalacją tej dokładnie wersji). `oh` wychodzi
`undefined`, `new oh(...)` rzuca, `.catch` zamienia to na 500.

Do tego `archiver` **w ogóle nie jest zadeklarowany** w `mirror/backend/package.json` — siedzi
wyłącznie w lockfile'u. Każde `npm install` na produkcji (zamiast `npm ci`) usunęłoby go
całkowicie i trasa padałaby na `ERR_MODULE_NOT_FOUND` zamiast na `oh is not a constructor`.

**Dlaczego odbudowa tego nie ma:** `rebuild/backend/package.json` deklaruje `archiver: ^8.0.0`,
a ósemka `ZipArchive` eksportuje — więc nasz port, przepisany z kodu oryginału **dosłownie**,
działa. To rzadki przypadek, w którym wierne przepisanie kodu dało zachowanie **inne** niż
produkcja, bo różnica siedzi w wersji zależności, a nie w kodzie.

**Skutki do rozważenia (nie rozstrzygam):**
1. W produkcji **nie powstaje ani jeden wpis `eksport_csv` z gałęzi ZIP**, bo audyt jest
   zapisywany dopiero po udanym złożeniu archiwum. Historia produkcji jest o te wpisy uboższa.
2. Odbudowa w tym miejscu **nie jest 1:1 z produkcją** — jest od niej sprawniejsza. To
   niezatwierdzone odstępstwo: nikt go nie zgłaszał ani nie zatwierdzał, wyszło dopiero tutaj.
3. Ania mogła tę funkcję uznać za „zepsuty przycisk pobierania" i przestać jej używać.

**Propozycja osobnej karty** (nie realizuję tutaj):
> **„Eksport wszystkich dostawców do ZIP — produkcja 500, odbudowa 200"** — zadanie: wpis do
> backlogu z decyzją ✅/❌, czy odbudowa ma **odtworzyć** defekt (1:1, wtedy `archiver` schodzi
> do 5.x albo dokładamy sztuczne 500), czy **zostać** przy działającej wersji jako świadome
> odstępstwo. Rekomendacja do dyskusji: **zostać przy działającej** i zgłosić defekt Ani —
> odtwarzanie zepsutego pobierania nie ma wartości dla użytkownika. Decyzja należy do
> użytkownika, dokładnie jak przy #84 („undefined nowych, undefined zmian").

---

## ZADANIE C — wpis do backlogu

**`docs/rebuild-backlog.md` #87** — „widok »Historia« czyta tylko 5000 najświeższych zdarzeń".
`Do nowej wersji?` = ⬜ **DO DECYZJI**, nie rozstrzygam.

Wpis zawiera zmierzoną liczbę, której wcześniej nie było: **`audit_log` ma dziś 3873 wiersze,
czyli 77% progu** — limit jest więc dziś niewidoczny (i dlatego nie wyszedł w żadnym teście),
ale próg jest blisko. Opisane oba skutki (najstarsze wpisy nieosiągalne + licznik przestaje być
liczbą wszystkich zdarzeń), powiązanie z **#21** (rozstrzygnięcie #21 na „tak" **przyspiesza**
problem, bo przez odsiew przechodziłoby wielokrotnie więcej wierszy) i trzy możliwe kierunki
z kosztami.

---

## ⭐ Co Ania ma obejrzeć NA OCZY — trzy wpisy

Reszta poszła automatem (49 813 wpisów, 0 różnic), ale obiecaliśmy kontrolę wzrokową. Te trzy
wystarczą i każdy sprawdza co innego. **Otwórz `/historia` w obu Bridge'ach obok siebie.**

**1. Najnowszy wpis na górze listy — sprawdza kolejność i kształt wpisu typu *edycja*.**
Bez żadnych filtrów, pierwszy wiersz od góry:
> `28.07.2026, 06:22` · typ **Edycja** · produkt **`MO2_1147700`** · pola: `kategoria`, `labelSnow`
> · użytkownik Marta Bieguniak · Pozycji: **1** · Dostawca: **pusty**

Ma się zgadzać co do minuty i co do listy pól. Pusty dostawca przy edycji **jest poprawny**
(§11 pkt 6). Licznik u góry ma pokazywać **270 wpisów** i **6 stron**.

**2. Wpis typu *import* — sprawdza kolumnę „Szczegóły" (rozdział 8, drugie puste pole).**
Filtr *Typ* = **Import**, albo *Dostawca* = **MO1**; pierwszy wiersz:
> `27.07.2026, 10:27` · typ **Import** · dostawca **MO1** · Pozycji: **612**
> · Szczegóły: **`Plik: BOH_PL_200015PL.csv`**

To jest test §8.1: prawdziwa nazwa pliku przy imporcie z przeglądarki. Filtr *Dostawca* = MO1
ma dać **40 wpisów** po obu stronach.

**3. Lista dostawców w filtrze — sprawdza §11 pkt 3 i pkt 5 naraz.**
Rozwiń *Dostawca*. Ma być **dokładnie osiem** kodów, w tej kolejności:
> **MO1, MO10, MO2, MO3, MO6, MO7, MO8, MO9**

„MO10" **ma** stać między „MO1" a „MO2" — to nie jest błąd, tylko sortowanie alfabetyczne.
Brak MO4 i MO5 też jest poprawny: pokazywani są tylko dostawcy występujący we wpisach, które
przeszły przez odsiew akcji.

Jeśli którakolwiek z tych trzech rzeczy różni się między Bridge'ami — to jest zgłoszenie
najwyższej wagi i trzeba napisać od razu.

---

## Changes

- **Nowy:** `docs/tickets/59-CHORE-i14j-oracle-diff-historii/oracle-diff-historii.cjs` — skrypt
  pomiarowy (stawia obie strony, porównuje siatkę przypadków, wykonuje zadanie B, nagrywa
  wyrocznię). Mieszka w folderze ticketa, bo wymaga żywego oryginału i nie jest uruchamialny
  w bramkach.
- **Nowy:** `docs/tickets/59-CHORE-i14j-oracle-diff-historii/wynik-oracle-diff.json`,
  `…-zasiew.json` — pełne wyniki obu przebiegów.
- **Nowy:** `rebuild/backend/test/historia.wyrocznia.test.ts` — 13 przypadków, trwały ślad
  pomiaru, chodzi w zwykłych bramkach bez oryginału.
- **Nowy:** `rebuild/backend/test/historia.wyrocznia.json` — wyrocznia nagrana z żywego
  oryginału: 270 wierszy `audit_log` + 20 wierszy `history` (wejście) + 8 pełnych odpowiedzi
  oryginału (wyjście).
- `docs/rebuild-backlog.md` — **tylko** nowy wpis #87.
- `docs/rebuild-roadmap.md` — **tylko** podblok „14j".
- **Zero zmian w `rebuild/backend/src/`.**

## Deviations from plan

Trzy, wszystkie wykryte w trakcie pomiaru i wszystkie opisane wyżej:

1. **`npm ci` zamiast `npm install`** w piaskownicy oryginału. Plan przepisywał recepturę z 14e
   dosłownie; okazała się niewystarczająca, bo `package.json` oryginału nie deklaruje wszystkich
   zależności, które ma jego lockfile. Bez tej zmiany jedno 500 było artefaktem piaskownicy.
2. **Dobór produktu w zadaniu B jest węższy, niż plan zakładał.** Plan mówił „produkt o
   identycznej wartości wyjściowej"; pierwsza implementacja wymagała identyczności CAŁEGO
   wiersza, co jest niemożliwe (migracja 003 rusza `szerokosc` praktycznie wszędzie).
   Porównywane są teraz dokładnie te pola, które wchodzą do wiersza `history`.
3. **Plik wyroczni ma 211 KB, nie ~100 KB** jak szacował plan (D1). Większość to 270 surowych
   wierszy `audit_log`, bez których test nie odtworzyłby wyniku oryginału.

## Test results

- **Gate odbudowy (fixtures/kontrakt):** ✓ **bez zmian** — karta nie rusza kodu produkcyjnego
  ani kontraktu. `test/historia.gate.test.ts` (ścieżki `GET /api/history`, `/api/history/meta`,
  `/api/history/paged`; fixtures `GET_history.json`, `GET_history_meta.json`,
  `GET_history_paged.json`) przechodzi tak jak przed kartą. Gate w wersji regresyjnej, zgodnie
  z planem.
- **Nowy test wyroczni:** ✓ `test/historia.wyrocznia.test.ts` — **13/13**.
- **Pomiar oracle-diff:** ✓ przebieg 1 — 59/59, 0 rozjazdów, 49 813 wpisów; przebieg 2 (zasiew)
  — 59/59, 0 rozjazdów, 49 846 wpisów.
- **Bramki backendu:** `npm run lint` ✓, `npm run typecheck` ✓, `npm run build` ✓,
  `npm test` ✓ — **82 pliki, 1262 testy, wszystkie przechodzą** (przed kartą 1249; +13 to
  dokładnie nowy plik wyroczni).
  **Po scaleniu `develop` (2026-09-18, merge #72 i #73): 83 pliki, 1271 testów, wszystkie
  przechodzą** — różnica to `test/akceptacja.odstepstwa.test.ts` z karty
  `58-FEATURE-i14i-ean-naukowy-pusty`, nie nasza. Konflikt scalania wystąpił wyłącznie
  w `docs/rebuild-roadmap.md` (dwa wiersze tabel: 14i domknięte przez 58, 14j dołożone przez nas)
  i został rozwiązany zachowaniem OBU informacji.

## Breaking changes

Brak. Zero zmian w kodzie produkcyjnym.

## Review fixes applied

Review (`review.md`) zgłosiło 1 BLOCKER, 2 SHOULD-FIX i 1 NICE-TO-HAVE. **Naprawione wszystkie
cztery.**

**BLOCKER — raport deklarował zmianę w roadmapie, której nie było.** Sekcja „Changes" wymieniała
podblok „14j" w `docs/rebuild-roadmap.md`, a `git diff` tego pliku był pusty: podbloku po prostu
jeszcze nie napisałem. Zarzut trafiony i to dokładnie scenariusz, przed którym ostrzega `CLAUDE.md`
(obowiązek 1 — roadmapa nie wiedziałaby, że karta się wydarzyła). **Podblok 14j jest teraz
napisany**: opisuje STAN, nie zamiar, z datą i ID ticketa, rozliczonym gate'em, faktycznie
dowiezionym zakresem, pięcioma faktami ustalonymi pomiarem i znaleziskiem o eksporcie ZIP.
Dodany też wiersz 14j do tabeli kart drugiej fali i do wiersza przeglądowego I14 w §5.

**SHOULD-FIX — skrypt zostawiał piaskownice przy wywrotce przed startem serwerów.** Sprzątanie
wisiało na `finally` wokół bloku z serwerami, więc błąd w `npm ci`, migracjach albo asercji
startowej zostawiał w `/tmp` kopię całego `mirror/backend` razem z `node_modules`. Katalogi są
teraz rejestrowane **w momencie utworzenia** (`PIASKOWNICE`), a `posprzatajPiaskownice()` wisi na
`finally` wokół całego `main()`. Zweryfikowane: po pełnym przebiegu `/tmp/bridge-14j-*` jest puste.

**SHOULD-FIX — niespójny separator w komunikacie diagnostycznym `roznice()`.** Zestawy kluczy
sklejane były `join("|")` do porównania, a raportowane `join(",")`. Kosmetyka, ale myląca przy
czytaniu różnicy. Ujednolicone na `,`.

**NICE-TO-HAVE, okazało się realne — remisy czasowe w wyroczni `GET /api/history`.** Pierwsze
nagranie miało **18 unikalnych `data` na 20 wierszy**, czyli dwa remisy. Trasa sortuje wyłącznie
`ORDER BY data DESC`, bez tiebreakera, więc przy remisie kolejność zależy od planu zapytania
SQLite — a ten może być inny na tabeli oryginału (46 916 wierszy) niż na 20-wierszowej tabeli
testowej. Test przechodził, ale był **uśpioną kruchością**: mógł kiedyś zaświecić bez żadnej
zmiany w kodzie. Naprawione **u źródła, nie tolerancją asercji**: nagrywarka bierze teraz
wyłącznie wiersze o parami różnych `data`, zapisuje flagę `dziennikBezRemisow`, a test ma osobną
asercję warunku ważności. Wyrocznia przenagrana — **20 wierszy, 20 unikalnych dat**. Nic nie
tracimy: kolejność przy remisie i tak nie jest kontraktem po żadnej ze stron.

Po poprawkach ponownie: pomiar 59/59 i 0 rozjazdów (bez zmian), test wyroczni **13/13**,
wszystkie bramki zielone.

## Follow-up

1. **Osobna karta: eksport ZIP — produkcja 500, odbudowa 200.** Opis i propozycja wyżej.
   Wymaga decyzji użytkownika (odtworzyć defekt czy zostawić działającą wersję) i wpisu
   w backlogu.
2. **`docs/instrukcja-testow-I5.md` §3.3 jest nieaktualna** — obiecuje Ani, że wpisów typu
   *edycja* nie przybędzie, a od 12a/12c przybywa. Dodatkowo §8.2 mówi „nowych eksportów nie
   wygenerujesz", a odbudowa eksporty ma i audytuje. **Uwaga: pliku nie ma na `develop`** —
   leży wyłącznie na niezmergowanej gałęzi `origin/docs/instrukcja-testow-i5` (commity
   `322a176`, `4ea3b92`). Do rozstrzygnięcia osobno: czy tę gałąź domknąć, czy treść przenieść
   do aktualnej instrukcji.
3. **Audyt `edycja_produktu` przy pustym zestawie zmian.** Odbudowa zapisuje wpis audytu nawet
   wtedy, gdy allowlista odsiała wszystkie pola — w Historii daje to wpis typu *edycja*
   z pustą listą pól. Nie jest to dziś osiągalne z UI; do rozważenia przy okazji #14.
4. **Karta 14k (#21)** dostaje od tej karty gotową siatkę: skrypt oracle-diff uruchamia się
   ponownie jednym poleceniem, a `historia.wyrocznia.test.ts` złapie regresję, jeśli
   rozszerzenie słownika `akcja → typ` ruszy coś poza zamierzonym zakresem.
