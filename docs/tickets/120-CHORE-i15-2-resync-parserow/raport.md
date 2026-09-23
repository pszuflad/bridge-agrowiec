# 120-CHORE-i15-2-resync-parserow — raport z implementacji

## Podsumowanie

Warstwa parserów zsynchronizowana z produkcją (`origin/main` @ `88fa31c`, 23.09 13:00): osiem plików
resyncowanych i cztery nowe moduły produkcji (`application_rules`, `payment_blocks`, `feed_safety`,
`staging_policy`), skopiowane **bajt w bajt** równolegle do `mirror/backend/` i `rebuild/backend/src/import/legacy/`.
Oba wzorce charakteryzacji przenagrane, a **test akceptacyjny na pełnych realnych cennikach dał ZERO różnic
w polach** na 4 843 rekordach. Przy okazji zamknięta regresja, którą resync wprowadzał: wyjątek z
`feed_safety` kończył się kodem 500 zamiast 400.

## Zmiany

**Warstwa parserów — kopia verbatim z `88fa31c`** (te same blob-y w obu miejscach):
- `mirror/backend/` + `rebuild/backend/src/import/legacy/` — `parsers/adapter.cjs`, `parsers/tyre_params.cjs`,
  `parsers/dispatcher.cjs`, `parsers/mo2_jmk.cjs`, `parsers/mo9_agrorami.cjs`, `parsers/mo9_agrorami_api.cjs`,
  `parsers/_agrorami_fetch_helper.cjs`, `common.cjs`
- **Nowe:** `application_rules.cjs`, `payment_blocks.cjs`, `feed_safety.cjs`, `staging_policy.cjs`

**Kod, który napisaliśmy sami (nie port):**
- `rebuild/backend/src/import/parsuj.ts` — tłumaczenie wyjątków z `feed_safety.attach()` na typy znane trasom:
  pusty cennik → istniejący `PustyImportBlad` (ten sam kod 400 i ten sam komunikat co dotąd), błędy parsera →
  nowy `BladCennika` (#103). Siedzi w `parsuj.ts`, bo to jedyna warstwa pisana przez nas i obejmuje
  **wszystkie trzy** wejścia (`routes/import.ts`, `routes/suppliers.ts`, `import/synchronizuj.ts`).
- `rebuild/backend/src/routes/import.ts` — `BladCennika`/`PustyImportBlad` z etapu parsowania mapowane na 400.
- `rebuild/backend/scripts/charakteryzacja-nagraj.mjs` — kopiuje do `.tmp/oryginal/` także cztery nowe moduły
  korzenia (bez nich `require` w kopii pada).

**Testy:**
- **Nowe:** `rebuild/backend/test/feed-safety.test.ts` — 10 testów ścieżek błędu #103.
- `rebuild/backend/test/charakteryzacja/MOx.expected.json` (10) — wzorzec parserów przenagrany.
- `rebuild/backend/test/charakteryzacja/silnik/MOx.expected.json` (10) — wzorzec silnika przenagrany.
- `rebuild/backend/test/import.test.ts`, `test/silnik.gate.test.ts`, `test/archiwum-importow.gate.test.ts`
  — 6 asercji przestawionych na nowe, zamierzone zachowanie (szczegóły niżej).

## Odstępstwa od planu

**Jedno, wykonawcze.** Plan zakładał naprawę D-6 w `routes/import.ts`. Przy implementacji okazało się, że
`parsujBufor()` ma **trzy** produkcyjne miejsca wywołania, nie jedno — `routes/import.ts:136`,
`routes/suppliers.ts:169` i `import/synchronizuj.ts:198` (auto-pull). Naprawa w samej trasie uploadu
zostawiłaby dwa pozostałe wejścia bez tłumaczenia wyjątku. Tłumaczenie trafiło więc **o warstwę niżej**,
do `parsuj.ts` — ten sam zakres decyzji D-6, mniejszy promień rażenia (jedno miejsce zamiast trzech
łatek), `routes/import.ts` dostało tylko mapowanie na kod 400.

Poza tym 1:1 z planem.

## Wyniki testów

### Gate odbudowy (fixtures/kontrakt): **N/D jako wymóg — ale i tak potwierdzony**
Warstwa parserów kończy się na `adapter.recordsToSurowe()`, przed zapisem do bazy i przed jakąkolwiek trasą.
Kształt odpowiedzi API nie zmienia się. Zamiast gate'u fixtures obowiązuje **mocniejszy** gate właściwy dla
tej warstwy — charakteryzacja wobec ORYGINALNYCH parserów produkcji (niżej).

**Potwierdzenie mimo to:** `archiwum-importow.gate.test.ts` porównuje `GET /api/import-archive`
z `contract/fixtures/GET_import-archive.json` i ze schematem z `contract/openapi.yaml` — i przechodzi
**22/22 bez zmian w fixture**, mimo że scenariusz tego gate'u zawiera upload zepsutego cennika.
Czyli: kształt i wartości odpowiedzi API nie drgnęły. Zmienił się wyłącznie KOD odpowiedzi przy
zepsutym pliku (500 → 400), którego fixture nie obejmuje.

### Test akceptacyjny karty — **✓ ZERO różnic w polach**
`porownaj-parsery.cjs`, strona PROD = drzewo `88fa31c:mirror/backend/` zmaterializowane w katalogu
tymczasowym, strona PORT = `src/import/legacy/`. Wejście: **pełne, realne cenniki** odzyskane z historii
(`72957d7^:mirror/backend/import_archive/2026-08/`), nie próbki:

| Dostawca | Rekordów | tylkoProd | tylkoPort | rekordów z różnicą | pola z różnicą |
|---|---|---|---|---|---|
| MO1 | 681 | 0 | 0 | 0 | — |
| MO2 | 1 597 | 0 | 0 | 0 | — |
| MO3 | 589 | 0 | 0 | 0 | — |
| MO4 | 337 | 0 | 0 | 0 | — |
| MO5 | 1 639 | 0 | 0 | 0 | — |

**Razem 4 843 rekordy, zero różnic.** Żaden plik cennika ani fragment danych nie trafił do repo.

**Pokrycie nowych ścieżek na pełnych danych** (czego próbki 200-wierszowe nie pokazywały):
W2 Handlopeksa **15×** (MO4 1, MO5 14 — w próbkach tylko 2), `ean: null` **124×**, kody JMK **8×**,
`blokowaneFormyPlatnosci` na **wszystkich 4 843**, `zastosowanie` na 589 (MO3).

**MO9 — przetestowany, wbrew założeniu promptu.** Nie plikiem (parser ignoruje ścieżkę i idzie do API
GraphQL), ale ścieżką offline `test/charakteryzacja/mo9-offline.mjs` + nagranym `MO9.items.json`: 12 rekordów,
port == oryginał. Bez haseł do Agrorami.

### Charakteryzacja parserów — **✓ 68/68**
Wzorzec przenagrany oryginalnymi parserami z `88fa31c`. **Liczba rekordów bez zmian u wszystkich 10
dostawców.** Zmiany są wyłącznie polowe i każda ma przypisany zatwierdzony wpis backlogu:

| Pole | Zmian | Źródło |
|---|---|---|
| `eanRaw`, `_eanLossy`, `_supplierEanOriginal` | 1 838 | nowe pola D4/#99 |
| `zastosowanie` | 1 838 | `application_rules` (#75/#79/#80/#82) |
| `blokowaneFormyPlatnosci` | 1 838 | `payment_blocks` (#73) |
| `szerokosc` `"10.0"` → `"10"` | 172 | **#83** |
| `kod` `MO2_<ean>` → `MO2_JMK_<id>` | 6 | JMK bez łączenia po EAN (#103) |
| `ean` `"…W2"` → `"…"` | 4 | Handlopex rocznik (#105) |
| `_kodSynthetic` | 2 | `staging_policy.syntheticCode` |

Zero zmian nieprzypisanych do zatwierdzonego wpisu.

### Charakteryzacja silnika — **✓ 49/49**
Wzorzec przenagrany (bierze rekordy wprost z wzorca parserów, więc resync zmienił mu wejście —
znana zależność, precedens 13a→13b). `scenariusze.expected.json` **bez zmian**, czyli czysta logika silnika
nietknięta. Statystyki zmieniły się u czterech dostawców i każda zmiana jest wyjaśniona:

| Dostawca | Zmiana | Przyczyna |
|---|---|---|
| MO2 | `doStagingu` 45 → 47 | JMK nie łączy już wierszy po EAN (#103) |
| MO4 | `zmienione` 27 → 26 | W2 trafia teraz w katalog (#105) |
| MO8 | `zmienione` 30 → 27 | `szerokosc "10.0"→"10"` zgadza się z katalogiem (#83) |
| MO10 | `zmienione` 2 → 0, `autoZatwierdzone` 15 → 17 | j.w. |

MO8 i MO10 to zmiana **na lepsze**: #83 likwiduje fałszywe „zmiany kluczowe" brane wyłącznie z zapisu szerokości.

### Weryfikacja stanu przejściowego D4 — **✓ import się nie psuje**
Zmierzone na pełnych cennikach, stary port vs nowy, to samo wejście:

| | stary port | nowy port | delta |
|---|---|---|---|
| MO3 `ean: null` | 87 | 87 | 0 |
| MO4 `ean: null` | 5 | 5 | 0 |
| MO5 `ean: null` | 26 | **32** | **+6** |

Cała nowa ekspozycja D4 to **+6 rekordów z 4 843 (0,12 %)**, wyłącznie MO5 — i są to rekordy, które
**wcześniej niosły bezsensowny EAN** `…W2`, niepasujący do niczego w katalogu. Liczba rekordów po obu
stronach identyczna, nic nie ginie.

Mechanizm potwierdzony na pojedynczym rekordzie (`silnik.gate.test.ts`): zapis naukowy `"8,05997E+12"` daje
teraz `ean: null`, `eanRaw: "8,05997E+12"`, `_eanLossy: true`, a pozycja **wchodzi pod własnym kodem
dostawcy** (`MO1_GATE-NORMEAN`) zamiast dopasować się do katalogowego `MO1_INNY-KOD-2`. Docelowo (I15.4)
ma to być blokada akceptacji; w oknie przejściowym jest zwykłą nową pozycją. Nie ma wyjątku ani utraty danych.

### Bramki
- **lint ✓ · typecheck ✓ · build ✓** (build kopiuje teraz 23 pliki do `dist/import/legacy/`, było 19)
- **`npm test` ✓** — 1 649 testów, 101 plików.

⚠ Jeden test (`alerty-katalogu.gate.test.ts`, „paczka równa limitowi 20 000 id") zaświecił raz na
czerwono w przebiegu zbiorczym, **w izolacji przechodzi (37/37)**. To najcięższy test w suite, a przebieg
zbiorczy jechał równolegle z porównaniem na pełnych cennikach i z sesją review — flak od obciążenia,
nie regresja. Nie zmieniałem go.

### Testy przestawione na nowe zachowanie (6)
Żadna asercja nie została osłabiona — kod **400** i „zero zapisu do stagingu" zostają wszędzie:

1. `import.test.ts` MO2 — `staging == doStagingu` zamiast `- 2`. #103 zniósł dwa powtórzone kody EAN-owe;
   zmierzone: próbka MO2 ma teraz **200 kodów, wszystkie unikalne**, a stare `MO2_13760840000`
   i `MO2_13763530000` nie istnieją.
2. `import.test.ts` archiwum — `rekordy` to `null`, nie `0`. `attach()` przerywa przed `oznaczWArchiwum`.
   **Produkcja robi tak samo** (archiwizuje przed parsowaniem), więc to zgodność, nie odstępstwo.
3. `import.test.ts` + 4. `silnik.gate.test.ts` — śmieciowa treść daje **błąd parsera**, nie pusty wynik,
   więc komunikat pochodzi z `feed_safety`. Kod 400 bez zmian.
5. `silnik.gate.test.ts` — test EAN-u w notacji naukowej przepisany na stan przejściowy D4, z notą, że
   I15.4 ma go przestawić na oczekiwaną blokadę.
6. `archiwum-importow.gate.test.ts` — zepsuty cennik (`ZEPSUTY_MO7`: CSV z niedomkniętym cudzysłowem)
   daje **400 zamiast 500**. To asercja z `beforeAll`, nie przedmiot tego gate'u — i jest to dokładnie
   ta poprawka, o którą chodziło w D-6. **Reszta suite przechodzi bez zmian (22/22)**: upload mimo błędu
   nadal trafia do archiwum ze statusem `blad`, a `GET /api/import-archive` nadal zgadza się z fixture
   i z kontraktem. To mocny dowód, że kontrakt HTTP nie ucierpiał.

## Breaking changes

**Dla API — żadnych** (kształt odpowiedzi bez zmian).

**Dla zachowania importu — trzy, wszystkie zatwierdzone jako zakres tej karty:**
1. Pusty cennik i **błędy parsera zatrzymują import** (#103). Wcześniej błędy przechodziły w polu `bledy`,
   a import leciał na niekompletnych danych. Kod odpowiedzi 400 bez zmian; komunikat przy błędach parsera
   jest nowy.
2. **JMK nie łączy wierszy po EAN** — kody pozycji MO2 to teraz `MO2_JMK_<id>`. Skutek: w stagingu pojawi się
   tyle pozycji, ile wierszy w cenniku (u nas +2 na próbce).
3. **D4** — błędny EAN daje `ean: null` + `eanRaw`. Do czasu I15.4 takie pozycje wchodzą jako nowe zamiast
   blokować akceptację (zmierzone: +6 rekordów na 4 843).

## Follow-up

- **I15.4** — konsumpcja `_bridgeFeedMeta` i flag D4; przestawienie testu EAN-u naukowego na blokadę;
  rozstrzygnięcie dublowania `PustyImportBlad` (odstępstwo D7) z bezpiecznikiem `feed_safety`.
- **I15.8 / I15.10** — hunki z `extensions.cjs` (szczegóły w `wejscie-120.md` obu kart).
- **I15.9** — #83 łamie obietnicę z `docs/instrukcja-testow-I3.md` §11 pkt 10 („10.00 zostaje"); zmierzone
  172 zmiany szerokości.
- **Koordynator** — `#103` jest w backlogu **zduplikowany** (dwa niepowiązane wpisy pod jednym numerem);
  `docs/karty/I15.2/karta.md` wymienia węższy zakres plików niż własne `wejscie-110.md`.
- **Nie naprawiane świadomie** — spłaszczanie `a ; b` przez trigger 011. Zmierzone: adapter **nie produkuje
  ani jednej** wartości wielokrotnej, ani na próbkach, ani na pełnych cennikach (`zastosowanie` jest
  `null` albo `Uniwersalne/pozostałe`). Ryzyko jest teoretyczne i leży poza warstwą parserów.
