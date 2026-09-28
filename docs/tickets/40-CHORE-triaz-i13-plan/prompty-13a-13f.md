# Prompty startowe — Iteracja 13 (karty 13a–13f)

Jak używać: każda karta = osobna sesja `/feature`. Skopiuj blok promptu do nowej sesji. Numer ticketa
rezerwuj **atomowo** (`mkdir docs/tickets/<n>-...`), uwzględniając też numery zajęte przez BRANCHE, nie
tylko katalogi (pułapka z pamięci — kolizja 39). Pełny plan: `docs/rebuild-roadmap.md` blok I13; mapowanie
zmian→kart i szczegóły: `docs/rebuild-backlog.md` sekcja „Delty produkcji Ani 26.08–08.09".

## Wspólny kontekst (dotyczy wszystkich kart)

- **Źródło prawdy = `mirror/backend/**` na gałęzi `main`** (stan produkcji 08.09, commit `6872aea`).
  Na `develop` `mirror/` jest ŚWIADOMIE cofnięty do 25.08 (commit `6594525`), żeby bramki wierności
  były zielone. **Każda karta dociąga swój wycinek `mirror/` z main RAZEM z portem i przenagraniem
  bramek** — nie merge'uj całego main w develop (to właśnie wywaliło 12 bramek 08.09).
  Wycinek bierzesz np. `git checkout main -- mirror/backend/parsers/tyre_params.cjs`.
- **Środowisko:** `export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"`; bramki w `rebuild/backend/`:
  `npm run lint && npm run typecheck && npm run build && npm test`.
- **Definicja ukończenia:** wszystkie bramki zielone, `develop` zielony, PR do `develop`, docs zsynchronizowane.

---

## 13f — Backfille: DECYZJA (podejmij PRZED 13a i 13c; to nie kod)

To nie jest ticket `/feature`, tylko rozstrzygnięcie do zaklepania z użytkownikiem. Backlog **#62**.

Pytanie: odbudowa buduje bazę importem od zera, więc jednorazowe backfille historycznych rekordów Ani
(`tl_tt` 628 rek., szerokości ułamkowe 10 rek., JMK marka/model 14 rek. + 27 overrides) są w większości
nieistotne — POZA regułami **tl_tt B/C** (Ciężarowe+Radialna+śr≥17.5→TL; BKT MAGLIFT+Diagonalna+śr≤12→TT),
które są LOGIKĄ KLASYFIKACJI. Do decyzji:
1. Czy reguły tl_tt B/C mają obowiązywać na PRZYSZŁYCH importach? Jeśli tak → wchodzą do parsera/mapowania
   (część 13a lub 13c), nie jako UPDATE.
2. Czy JMK marka/model + szerokości (dane sprzed poprawek parsera) w ogóle dotyczą odbudowy, skoro
   parser jest już poprawny i przy imporcie od zera rekordy powstaną poprawnie?

Wynik zapisz w backlog #62 (`Do nowej wersji?`/`Status`) i wepnij w zakres 13a/13c.

---

## 13a — Parsery: re-sync warstwy `legacy` (kopia bajtowa) [FUNDAMENT]

```
/feature 13a — Iteracja 13: re-sync warstwy parserów z produkcji 08.09.

Zadanie: zaktualizować bajt-w-bajt kopie parserów w rebuild/backend/src/import/legacy/ do stanu
produkcji z 08.09 (gałąź main, mirror/backend/), odświeżyć charakteryzację i sprawdzić, co się
przesuwa downstream. To FUNDAMENT I13 — 13b/13c zależą od niego.

Skopiuj z `main` (git checkout main -- mirror/backend/<plik>) do src/import/legacy/ odpowiedniki:
common.cjs oraz parsers/{adapter, tyre_params, mo1_bohnenkamp, mo2_jmk, mo6_agrowiec, mo7_nokian,
mo8_trelleborg, mo9_agrorami_api}.cjs. Kopia wnosi ATOMOWO (backlog #53/#54/#55/#57/#58/#63/#64 +
domknięcia #8/#9/#10): b4 (WxSxD), b10 (Handlopex sufiksy model), p2_4 (parseSize L-series+ułamki),
mo9expand, odswinch (NIEZALOGOWANA w CHANGELOG — rozłóż diffem tyre_params.cjs i opisz w raporcie),
bug1 (filtr dętki/akcesoria case-insensitive mo1/mo9), bug2 (NRO/CHO→Tak/null tyre_params+adapter),
bug4 (MO8 detekcja CSV/XLSX isZipBuffer), katunify (kategorie Wielka litera), konstr (kody→słowa).

Musisz też dociągnąć wycinek mirror/backend/parsers/* (oracle charakteryzacji) do 08.09 dla TYCH
plików, żeby test byte-for-byte i field-char porównywał kopię z aktualnym oryginałem.

GATE: test/charakteryzacja.test.ts — byte-for-byte (9 plików) + field-char MO1–MO10 zielone;
przenagraj fixtures MO*.expected.json z żywego oryginału. Sprawdź, czy katalog.gate / akceptacja
się nie przesuwają (jeśli tak — odnotuj, część pójdzie w 13b/13c, NIE wyłączaj bramek).

Kontekst: docs/rebuild-roadmap.md blok I13 (13a), docs/rebuild-backlog.md (mapowanie + #53–#64).
develop ma mirror cofnięty do 25.08 — dociągasz TYLKO swój wycinek. Utrzymaj develop zielony.
```

---

## 13b — Silnik `tk()`/`acceptStaging`: P3 + CAPS/Xq [zależy od 13a]

```
/feature 13b — Iteracja 13: silnik tk()/acceptStaging — P3 (fallback marki) + CAPS/Xq.

Zadanie: odtworzyć w reimplementacji TS silnika dwie zmiany produkcji z index.cjs (NIE ma ich w
warstwie legacy — to silnik, nie parser):
- P3 (backlog #56): fallback marki w tk() wpisuje "UNKNOWN" gdy dostawca ma puste pole Producent
  (zamiast degenerowanego nazwa.split(" ")[0]).
- CAPS/Xq (backlog #59, część silnikowa): helper równości Xq porównuje case-insensitive
  (A.toUpperCase()===B.toUpperCase()), żeby "Kleber GRIPKER" vs "KLEBER GRIPKER" nie generowało
  staging_items zmiana_kluczowa.

⚠ Cieniowanie (CLAUDE.md §5): P3 i Xq są w index.cjs, który ma duplikaty definicji — policz
`function tk(` / wystąpienia Xq w mirror/backend/index.cjs i weź ŻYWĄ (późniejszą) definicję,
nie numer linii z deminifikatu.

GATE: dociągnij wycinek mirror/backend/index.cjs do 08.09 (oracle), przenagraj kotwicę sha
„wycięty fragment index.cjs" w test/silnik.charakteryzacja.test.ts; silnik.charakteryzacja i
akceptacja.charakteryzacja zielone (marka "UNKNOWN" zamiast "Opona").

Zależy od 13a (silnik konsumuje wyjście parserów). Kontekst: roadmapa blok I13 (13b).
```

---

## 13c — Migracje danych + fixtures konwencji [zależy od 13a, 13b]

```
/feature 13c — Iteracja 13: migracje konwencji (CAPS nazwa, konstrukcja) + przenagranie fixtures.

Zadanie: migracje istniejących rekordów w bazie odbudowy (wzór: migracje 002/003, backlog #2/#3):
- konstrukcja (backlog #58): kody R/D/L/B → pełne słowa; R→Radialna, D/L/B→Diagonalna.
- CAPS (backlog #59): products.nazwa → UPPER; manual_overrides pole nazwa → UPPER; sprzątanie
  staging CASE_ONLY jak w produkcji.
- katunify (backlog #57): sprawdź, czy historyczne products.kategoria wymagają migracji do Wielkiej
  litery (parser już daje Wielką od 13a, ale stare rekordy?).
- Wepnij decyzję 13f (tl_tt), jeśli wypadła „reguły do mapowania".

GATE/fixtures: przenagraj katalog.gate, produkty.*, analityka.* — odpowiedzi pokażą Wielką literę
kategorii, słowa konstrukcji, WIELKIE nazwy. Wszystkie bramki zielone.

Zależy od 13a (wyjście parserów) i 13b (Xq). Kontekst: roadmapa blok I13 (13c).
```

---

## 13d — Selly REST sync (NOWY podsystem) [zależy od I8; BLOKADA: Tor 2 u Ani]

```
/feature 13d — Iteracja 13: Selly REST sync — nowy podsystem wariantowy.

⚠ ZANIM zaczniesz: potwierdź z użytkownikiem, że Ania domknęła u siebie Tor 2 (sync_full) — na 08.09
był NIEDOMKNIĘTY („refactor sync_full w następnej sesji"). Bez tego portujesz ruchomy cel.

Zadanie: odtworzyć w rebuild (reimplementacja TS w src/selly/) podsystem synchronizacji Bridge→Selly
przez REST API (backlog #60), który wykracza poza I8 (I8 = eksport CSV + panel). Model wariantowy:
cena/stan PER WARIANT (PUT /api/products/{pid}/variants/{vid} {quantity,price}), bo bulk-endpoint
zwracał HTTP 400 dla produktów z wariantami (19%).

Pliki oryginału (mirror/backend/selly/ na main): discovery.cjs (lazy discovery po EAN, ensureMapping,
apiWithRetry z retry 429/Retry-After), sync_delta.cjs (Tor 1), rate_limiter.cjs (token bucket 250/60s),
scheduler_selly.cjs (HH:55 + fallback), routes_sync.cjs (7 endpointów /api/selly/sync-*),
mapper_v2.cjs (21 features, provider_code=kod_importu), sync_full.cjs (Tor 2).
Schemat: przeprojektowana selly_products — klucz (kod_importu, dostawca) → (selly_product_id,
selly_variant_id) + feature_id_magazyn; stara tabela → selly_products_old. Migracja + drizzle schema.

Podział (proponowany): 13d-1 discovery + sync_delta (Tor 1, aktywny), 13d-2 sync_full (Tor 2, gdy
Ania domknie), 13d-3 przyciski sync w panelu FE /selly. GATE: nowe testy sync za atrapą Selly
(NIGDY nie wołać prawdziwego Selly — patrz CLAUDE.md, test/gate/selly-atrapa.ts).

Niezależne od 13a–13c (inny podsystem) — może iść równolegle po 13a. Kontekst: roadmapa blok I13 (13d).
```

---

## 13e — Frontend: Bridge ONE + drobne [zależy od 13c dla `konstr`]

```
/feature 13e — Iteracja 13: frontend — rebrand Bridge ONE + tr_fix/ackalerts/szer_marka/PRICEFMT/konstr.

Zadanie: odtworzyć zmiany FE z produkcji 08.09 (backlog #61). Bundle są ZMINIFIKOWANE
(mirror/frontend/assets/index-BRIDGEONE….js, index-PRICEFMT….js) — nazwa kopii .bak daje tylko
ETYKIETĘ, nie treść, więc NAJPIERW rozłóż diff bundla (kopie .bak_tr_fix / .bak_ackalerts /
.bak_szer_marka + finalny bundle) i opisz realny zakres każdej etykiety.

Zakres:
- rebrand „Bridge ONE" (title „Bridge ONE — konsolidacja cenników opon"). ⚠ DECYZJA użytkownika:
  czy odbudowa też nazywa się „Bridge ONE", czy zostaje dotychczasowa nazwa.
- tr_fix, ackalerts (potwierdzanie alertów), szer_marka (kolumna szerokość/marka), PRICEFMT
  (formatowanie ceny).
- konstr (FE strona unifikacji konstrukcji — sparowane z backendem 13c: kolumna i eksport pokazują
  „Radialna"/„Diagonalna").

Zależy od 13c dla części konstr; rebrand + drobne mogą iść częściowo równolegle. Kontekst: roadmapa I13 (13e).
```
