# DEC.1 — runda decyzyjna: wpisy backlogu wiszące bez decyzji

> **Stan:** 🔨 ticket 141
> **Iteracja:** poza iteracjami (porządkowa) · **Wpisy backlogu:** #135.1 (zakładający), #5, #12, #43, #65, #88, #89, #94, #95, #98, #103, #108, #137.1, #137.2 · **Zależy od:** I15.4b (domknięta)
> **Ticket:** 141 (`141-DOCS-runda-decyzyjna-backlog`)

Karta założona przez ticket 141 — koordynator jej nie założył przed wydaniem promptu.
Typ: DOCS/decyzje. **ZERO zmian w `rebuild/` i w `contract/`.**

## Zakres
Przejść wpis po wpisie przez wszystko, co `tools/stan-backlogu.sh --do-decyzji` pokazuje jako
⬜ bez decyzji, ustalić **stan faktyczny w kodzie na `develop`** (nie z opisu wpisu), napisać
rekomendację z kosztem, zebrać decyzję użytkownika i zapisać ją w polach `Do nowej wersji?`
i `Status`. **Bez implementacji napraw** — z decyzji „naprawiamy" powstaje propozycja karty
w sekcji „Do koordynatora".

## Pliki (wyłączna własność)
- `docs/karty/DEC.1/karta.md`
- `docs/rebuild-backlog.md` — wyłącznie linie `Do nowej wersji?` / `Status` rozstrzyganych wpisów
- `docs/rebuild-backlog/wpis-135.md`, `docs/rebuild-backlog/wpis-137.md` — j.w.
- `docs/tickets/141-DOCS-runda-decyzyjna-backlog/**`

NIE: `rebuild/**`, `contract/**`, `docs/rebuild-roadmap.md`, karty innych kart.

## Lista rozstrzygana — korekta wobec promptu
Prompt mówił o **jedenastu** wpisach (za `#135.1`, stan na `ba4667d`). Na `develop` w chwili
startu karty (`ab30674`) narzędzie pokazuje **czternaście**: doszły `#137.1` i `#137.2`
(ticket 137, zmergowany po napisaniu promptu) oraz sam `#135.1`, który też ma ⬜ i domyka się
dopiero tą kartą. Lista wzięta z narzędzia, zgodnie z poleceniem.

## Stan faktyczny — ustalenia (dowody)

Wszystko zmierzone na `develop` @ `ab30674`, 2026-09-23. Pomiary bazodanowe na `db/snapshot.db`.
⚠ **Zastrzeżenie do wszystkich pomiarów:** `db/snapshot.db` ma mtime **2026-08-13**, więc jest
starszy niż zmiany produkcji z września (np. migracja Ani `ca8a694` z 17.09). Każdy pomiar
dotyczący zmian nowszych niż 13.08 wymaga tego zastrzeżenia.

### #5 — `frazy` · DO FORMALNEGO ZAMKNIĘCIA
`mirror/backend/frazy_migruj.cjs` — 64 linie, skrypt jednorazowy odpalany ręcznie, czyta
`/tmp/frazy_migracja.json` (plik spoza repo, dziś nie istnieje), woła `selly/client.cjs`.
**Nic go nie importuje** — zero `require('./frazy_migruj')`, brak wpisu w `package.json`.
`grep frazy mirror/backend/common.cjs` → 0 trafień. W `CHANGELOG.md` Ani zero wystąpień „frazy"
po 2026-08-24. W `rebuild/` wszystkie trafienia to polskie słowo „fraza" w wyszukiwarkach.
I8 zamknięta 2026-09-04 świadomie bez tego narzędzia.

### #12 — `__restoreZastosowanie()` · AKTUALNY
Nadal bez portu i **ortogonalny do I15.4x** — funkcja żyje w handlerze `POST /api/staging/accept`
w `mirror/backend/index.cjs` (`deminified/backend-index.cjs:44105` def, `:48546` wywołanie),
POZA `staging_policy.cjs`, więc `importer()`/`checkAcceptance` (tickety 130/129) jej nie dotknęły.
Pomiar: 7405 produktów, **625** z pustym/NULL `zastosowanie`; z nich **84** ma `kategoria` spoza
`selly_kategoria_norm_map` → `category_id: null` → `walidujPayload` (`src/selly/mapper.ts:284`)
→ produkt **pomijany w synchronizacji Selly**.
⭐ **Niuans, którego wpis nie miał:** te 84 to 69× `Rolnicze` i 15× `Ciężarowe` — czyli wypadają
przez **niezgodność wielkości liter** w `selly_kategoria_norm_map` (mapa ma 8 wierszy: `rolnicze`,
`przemyslowe`, `przemysłowe`, `Przemysłowe`, `ciezarowe`, `ciężarowe`, `leśne` — ale NIE
`Rolnicze` ani `Ciężarowe`). To druga, niezależna przyczyna obok pustego `zastosowanie`.
`mapujZastosowanieNaKategorie` — `src/selly/mapper.ts:95-142`, gałąź `fallback_kategoria` :101-107.
CSV `mirror/backend/zastosowania/zastosowania_master.csv` JEST w repo (6823 wiersze).

### #43 — kontrakt nie zna 403/404/409 · CZĘŚCIOWO NIEAKTUALNY
`contract/openapi.yaml`: 111 ścieżek / **130 operacji**. `"403"` → **0** (teza trzyma),
`"404"` → **6** (:19179, :19734, :20011, :20025, :20039, :20739), `"409"` → **3**
(:20607, :20636, :20676). Teza „w CAŁYM pliku zero" **już nieprawdziwa**.
⭐ **Obawa z promptu jest odwrotna:** ticket 129 lukę **ZWĘZIŁ**, nie pogłębił — wszystkie cztery
trasy polityki są w kontrakcie z kodami: `choose-absence-card` (:20573-20613, 409),
`close-absence-review` (:20614-20640, 409), `resolve` (:20641-20680, 409),
`review` (:20681-20745, **404**, nie 409).
⭐ **GATE nie jest ślepy — jest restrykcyjny.** `sprawdzOdpowiedz` (`test/gate/kontrakt.ts:68-87`)
sprawdza, czy status jest w `Object.keys(operacja.responses)`; niezadeklarowany → `naruszenia`
niepuste → `expect(naruszenia).toEqual([])` **PADA**. Dlatego GATE świadomie NIE jest wołany dla
tras, których kontrakt nie zna (udokumentowane w `test/atrybuty.gate.test.ts:1-17`).
Realna luka: ~**20-25 operacji ze 130** — 404 (~11: admin/supplier-config, dostawcy PATCH+upload,
markups, overrides, selly/sync-product, staging GET/PUT/DELETE) + cały `atrybuty.ts`
(18 operacji, wszystkie tylko 200/401/400, a kod zwraca 404 ×7, 409 ×3, 403 ×1).
Brak `components/responses` — odpowiedzi inline (świadoma konwencja,
`tools/generate-openapi-schemas.cjs:17-25`), więc mechanicznie się nie da.
**Druga, węższa luka (nowa):** `test/staging-polityka.trasy.test.ts` asertuje 404/409 wprost,
ale **nie woła `sprawdzZgodnoscZKontraktem` ani razu** — mimo że kontrakt te kody już zna.
To luka WIĄZANIA testu z GATE, nie luka kontraktu.
**Ryzyko runtime: ZERO** — `openapi.yaml` czytany wyłącznie przez testy
(`test/gate/kontrakt.ts`, `test/gate/repo.ts`); w `src/` zero odwołań.

### #65 — `manual_overrides` / `konstrukcja` · AKTUALNY
Pomiar potwierdza dosłownie: `field_name='konstrukcja', override_value='D'` → **3 wiersze**
(id 3738/3739/3740, MO8, kody `MO8_0207900`, `MO8_0198800`, `MO8_0198600`, `created_at` 22.07).
`field_name='kategoria'` → 6944, w tym 14 małą literą (stan SPRZED migracji Ani `ca8a694`).
Migracja `rebuild/schema/011_blokowane_formy_i_triggery.sql` odtwarza tylko stronę `kategoria`
— triggery `manual_overrides_kategoria_ai/_au` (:49-50 DROP, :89-101 CREATE), kopia
z `7d6cfc9:db/schema.sql`. **Zero triggera/backfillu dla `konstrukcja`** — luka 1:1.
Żywa ścieżka nakładania: `chron()` (`src/import/polityka/kontekst.ts:49-52`), bez normalizacji.

### #88 — `promocjaPasuje` · CZĘŚCIOWO NIEAKTUALNY (wpis mierzy węższy przypadek niż kod)
`src/repos/ceny.ts:127-136`:
`zasieg.includes(tekst(produkt.marka)) || zasieg.includes(tekst(produkt.kategoria))`
— **OR, nie AND** (zweryfikowane bezpośrednio w kodzie). Czyli pusta **sama `marka`** wystarczy.
Pomiar: oba puste → **0** (zgodnie z wpisem); sama `marka` pusta → **1** (id 100577, MO4,
`MO4_LLCR17523575MLLS0`, `kategoria='Ciężarowe'`); sama `kategoria` → 0.
⚠ Tabela `promotions` w snapshocie jest **PUSTA (0 wierszy)** — efekt obserwowalny dziś to zero,
ale **z innego powodu niż podaje wpis**: nie „brak pasujących produktów", tylko brak promocji.
Test `test/katalog.promocja.test.ts:125-129` utrwala WYŁĄCZNIE wariant „marka '' I kategoria ''"
— **nie pokrywa wariantu częściowego**, który wg kodu (OR) już wystarcza.
Trzecia osobliwość, udokumentowana w komentarzu `:123-125`: dopasowanie jest ODWRÓCONE —
`zasieg` musi zawierać markę, więc `zasieg: "BKT"` łapie też produkt marki „BK".

### #89 — pole „priorytet" · AKTUALNY, CZEKA NA ANIĘ
Pytanie nadal bez odpowiedzi: `docs/instrukcja-testow-I4-v2.md:546` („Czy brak pola «priorytet»
w formularzu reguły Ci przeszkadza?"), kratka :565 — obie kolumny puste. Odpowiedzi nie ma
nigdzie w `docs/` (sprawdzone `pytania-do-ani-2026-09-18.md`, `-2026-09-22.md`,
`selly-spec-od-ani-2026-09-22*`); `pytania-do-ani-2026-09-22.md:239` wprost odsyła temat do
instrukcji v2, więc pytania świadomie nie zadano drugi raz.
Kod bez zmian: `DialogReguly.tsx:141-143` (stan bez inputu), `repos/ceny.ts:160-166`
(`wybierzPromocje` sortuje po `priorytet` malejąco).
⭐ **Skala dziś = ZERO:** `markups` ma **1 wiersz** (`priorytet=50`, domyślny), `promotions`
ma **0 wierszy** — nie ma pary, która mogłaby wejść w remis. Scenariusz z opisu wpisu
(„dwie promocje na tę samą markę") pochodził z danych testowych karty 14m, nie z produkcji.

### #94 — Historia dostępności · AKTUALNY, liczby potwierdzone co do joty
Oba defekty nadal w kodzie: `src/repos/analityka.ts:1398,1404` (`dostepnoscProduktow`) — gołe
`h.ean` obok `GROUP BY h.dostawca, h.kod`, `COUNT(*)` na surowej historii.
`src/repos/analityka-eksport.ts:271-280` — `ean` jest w `GROUP BY`, więc nie jest losowe, ale
**mnoży wiersze** (para z 2 EAN-ami → 2 wiersze); `COUNT(*)` też surowy. Komentarz :262-268
**już dziś jawnie dokumentuje to jako świadome 1:1** z ticketu 90 — czyli #94 proponuje cofnąć
decyzję sprzed siebie, a nie załatać przeoczenie.
Wzorzec gotowy: CTE `HISTORIA_BEZ_DUPLIKATOW_KLUCZA` (`analityka.ts:1330-1333`,
`id IN (SELECT MAX(id) … GROUP BY dostawca, kod, zarejestrowano_at)`), używany przez
`tempoSchodzenia()` (:1458) i eksport `sell-through` (`analityka-eksport.ts:303`).
Pomiary potwierdzone: (a) par `(dostawca,kod)` z >1 różnym `ean` — **9** (MO2×3, MO5×5, MO9×1);
(b) grup `(dostawca,kod,zarejestrowano_at)` z >1 wierszem — **30 grup / 67 wierszy**.
⭐ **Fixture NIE blokuje naprawy.** Jedyny fixture to trasa karty
(`contract/fixtures/GET_analytics_availability_products.json`) i ma `body.rows: []`; eksport
fixture'a nie ma w ogóle. `contract/README.md:155-162` mówi wprost, że oba nagrania zostają
puste celowo jako dowód stanu produkcji i że `gate/ksztalt.ts` nie zagląda do elementów przy
pustej tablicy — więc rozjazd treści nie zapala testu i **przenagranie nie jest potrzebne**.

### #95 — „przypadek mieszany" przy zdublowanym kodzie · NIEAKTUALNY
`src/import/tk.ts` istnieje (78 linii), ale to już tylko cienki wrapper delegujący do
`polityka/fabryka.ts` (`tk.ts:77`: `polityka.importer(...)`) — I15.4b (ticket 130) zastąpił port
martwego `tk()` portem `importer()` ze `staging_policy.cjs`.
**Nowy silnik JAWNIE blokuje ten scenariusz zamiast go po cichu mieszać:** `fabryka.ts:513-559`
— dwie pozycje o tym samym `kod` różniące się `identity/ean/cenaZakupu/stan` → błąd „Kilka
różnych pozycji dostawcy wskazuje tę samą oponę. Wymaga sprawdzenia pliku." + `_duplicateSource`.
`fabryka.ts:703-706` — pozycja z `bledy` idzie do `doStagingu(pozycja,"blad")` i `continue`,
więc NIE dochodzi ani do patcha `products`, ani do `zapiszHistorieCen` (:755).
Duplikaty identyczne (przypadek MO7 z wpisu) — konfliktu nie ma. Test:
`test/polityka.charakteryzacja.test.ts`. Skali „MO7 14 zdublowanych" nie da się sprawdzić
w repo — brak plików cenników.

### #98 — resztki w danych po PR.5 · CZĘŚCIOWO NIEAKTUALNY
Pomiary potwierdzone: (1) śmieci w marce — **2 produkty** (`21x7.00-15`, `18x8.50-8`);
(2) pary case-only w `atrybuty_wartosci`/`bieznik` — **4 pary** (`FLOTATION T422`,
`LOGGER KING TRS-2`, `MAGLIFT LIP`, `MG121 PROWADZĄCA`), przy 1665 wartościach `bieznik`;
(3) `historia_cen.marka` — `Alliance` **953** i `ALLIANCE` **650**; zakresy dat nakładają się
w miesiącu „07".
Migracja `rebuild/schema/010_marka_caps.sql` obejmuje wyłącznie `products.marka` i słownik
`atrybuty_wartosci` rodzaju `marka`; komentarz :24-26 wprost wyłącza `historia_cen.marka`.
Widoczność dziś: marki-śmieci **NIE wyciekają** do filtra katalogu — `listaMarek()`
(`pages/katalog/filtrowanie.ts:152-163`) odrzuca wartości z cyfrą; pary `bieznik` **są widoczne**
w `/atrybuty` (`PanelWartosci.tsx` listuje słownik bez deduplikacji → 8 wierszy zamiast 4).
⭐ **PUNKT 3 WPISU JEST OBALONY.** Wpis odkłada sprawę, „bo grupowanie po marce w historii cen
dopiero dostanie UI" — a **UI istnieje od 2026-09-04**, czyli sprzed samego wpisu (22.09):
`sezonowoscMiesieczna()` (`analityka.ts:1507-1521`) robi `GROUP BY miesiac, marka` na surowym
`historia_cen.marka` bez normalizacji, a `pages/analityka/SekcjaSezonowosci.tsx:51` renderuje
kolumnę „Marka" (karta 4.4 „Sezonowy wzorzec cen"). Dla lipca Ania zobaczy DWA wiersze —
`Alliance` i `ALLIANCE` — z różną średnią ceną, jak dwie różne marki.

### #103 (Selly) — `runFullTodays` · ROZSTRZYGNIĘTY KODEM
Defekt produkcji potwierdzony na zamrożonym `88fa31c`: `mirror/backend/selly/routes_sync.cjs:14`
importuje `runFullTodays`; `scheduler_selly.cjs:148-153` eksportuje `installScheduler`,
`runDeltaAll`, `suppliersForFullToday`, `ACTIVE_SUPPLIERS`, `FULL_ROTATION` — bez `runFullTodays`.
Karta I15.8 ZAMKNIĘTA (`docs/karty/I15.8/karta.md`, `Stan: ✅ 2026-09-23`, ticket 121),
„Odstępstwa świadome" pkt 2: `sync-full-today`/`sync-full-force` → `runFullBatch` zamiast
nieistniejącego `runFullTodays` (decyzja 2026-09-23).
⭐ Ticket 121 znalazł przy okazji **drugi, niezależny błąd**: oryginał podaje `{forceSuppliers}`,
a `runFullBatch` czyta `opts.suppliers` — „force MO1,MO2" wykonałoby rotację z dziś zamiast
wskazanych dostawców. Też naprawione.
Odbudowa: `src/routes/selly-sync.ts:154` i `:168` wołają `runFullBatch`; testy
`test/selly.sync.gate.test.ts:235` i `:249` — HTTP 200, nie 500.

### #108 — kolizje `kod_importu` · OTWARTY, CZEKA NA ANIĘ
`grupyKolizyjne()` — `src/selly/rest/sync-delta.ts:138-172`, grupuje po PARZE
`(dostawca, kod_importu)` wśród `status='aktywny'`, z flagą `rozne_ceny_lub_stany`.
`stats.kolizje_kod_importu` (:52, :284) i lista `kolizje` (:66, :378) trafiają do wyniku
`syncDelta` i do `selly_sync_log.szczegoly_json` (:386, ucięte do 20).
Zawór pomijania **wycofany świadomie** — komentarz :117-125 cytuje wyjaśnienie Ani z 23.09
(wielomagazynowość). Testy: `test/selly.sync-delta.test.ts:421-489`.
Przyczyna przeportowana dosłownie: `src/import/polityka/kod-importu.ts:25` (`SZESC_CYFR`),
`:41-44` (zachowaj istniejący sześciocyfrowy kod).
**Po stronie odbudowy nie ma nic do zrobienia przed odpowiedzią Ani** — wykrywanie
i raportowanie gotowe i przetestowane, dane produkcyjne celowo nietknięte.

### #135.1 — wpis organizacyjny · DOMYKA GO TA KARTA
Zakładający rundę. Zamykany odsyłaczem do `docs/karty/DEC.1/karta.md`.

### #137.1 — `mirror/backend/index.cjs` starszy niż reszta mirrora · FAKT PRAWDZIWY, UZASADNIENIE NIEPEŁNE
Fakt potwierdzony: `develop:mirror/backend/index.cjs` nie ma linii
`tk=require("./staging_policy.cjs").install(...)`, a `origin/main` ją ma
(sha develop `fcb1f177…`, main `15635a01…`).
⭐ **Czego wpis nie mówi:** ten stan jest **skutkiem świadomej decyzji użytkownika z 2026-09-08**,
commit `6594525` „revert(mirror): cofnij snapshot produkcji na develop do 25.08 — bramki
wierności zielone". Z treści commita: merge `00097f8` wciągnął mirror do stanu 08.09 i zapalił
**12 czerwonych bramek wierności**; decyzja brzmiała — mirror na `develop` wraca do 25.08, stan
08.09 zostaje na `main` jako źródło prawdy, „każdy ticket I13 dociągnie swój wycinek `mirror/`
RAZEM z portem i bramką". Selektywny resync to zatem **polityka, nie zaniedbanie**.
⭐ **Koszt resyncu to nie kopia pliku:** dwie bramki przypinają sha256 wycinków z tego bundla —
`test/silnik.charakteryzacja.test.ts:276` (wzorzec `integralnosc.json`; komunikat błędu wprost
każe przenagrać: `BRIDGE_SNAPSHOT_DB=… node scripts/charakteryzacja-silnik-nagraj.mjs`) oraz
`test/produkty-bulk.charakteryzacja.test.ts:116`. Bramka integralności portu
(`charakteryzacja.test.ts:97-135`) porównuje `src/import/legacy/**` z `mirror/backend/**` plik
po pliku, ale `index.cjs` nie jest w porcie, więc sama nie zapali.

### #137.2 — poprawki Marty nakładane cicho · CZEKA NA ANIĘ, ale TANIEJ NIŻ WYGLĄDA
Żywa ścieżka: `chron()` (`src/import/polityka/kontekst.ts:49-53`) — trzy linijki, bez
`naruszono`/`_srcConflict`; wołana z `polityka/zgloszenia.ts:152`, `polityka/akceptacja.ts:48`,
`polityka/fabryka.ts:228`.
⭐ **Stary odpowiednik `Gq()` JEST w repo:** `src/import/silnik/overrides.ts` —
`poprawkiMarty()` (:45) liczy `naruszono` (:54) i `srcVals` → `snapshotJson._srcConflict` (:12).
**Ma ZERO wywołań** w `src/` i `test/` (grep) — to martwy kod po porcie martwego `tk()`.
Wniosek dla wyceny: wariant „przywróć sam meldunek" nie jest pisaniem od zera — obliczenie
konfliktu już istnieje, brakuje wpięcia i decyzji.

## Decyzje
<decyzje użytkownika z datą — wypełniane po rundzie>

## Dowiezione
<wypełnia karta przy zamknięciu>

## Do koordynatora
<propozycje kart z decyzji „naprawiamy" + fakty do przeniesienia do roadmapy>
