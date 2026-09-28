# Wejście dla I15.4b od ticketu 129 (karta I15.4c — akceptacja) · 2026-09-23

Ścieżka ODCZYTU I DECYZJI jest zmergowana. Poniżej to, co z niej wynika dla importera.

## 1. ⚠ NAJWAŻNIEJSZE — `_policyVersion` jest teraz WYMAGANE, a ustawia je TWÓJ kod

`checkAcceptance` (`staging_policy.cjs:194`) odrzuca każdą pozycję bez `_policyVersion`
komunikatem „To zgłoszenie pochodzi ze starego importu. Odśwież cennik przed akceptacją.".
Ta blokada jest **już na `develop`** i wpięta w `POST /api/staging/accept`.

`_policyVersion: 2` ustawia **wyłącznie `importer()`** — `staging_policy.cjs:428` (główna ścieżka)
oraz `:571`, `:588`, `:606` (sprawy starych kart i wycofania). To Twój zakres.

**Skutek dziś:** dopóki Twoja karta nie wejdzie, akceptacja odrzuca wszystko, co produkuje obecny
`tk.ts`. Decyzja użytkownika (D129.8, 23.09) brzmiała „wepnij mimo to, obie karty idą tą samą falą".
**Im szybciej Twój PR wejdzie, tym krócej trwa to okno.** To nie jest defekt do naprawienia po
Twojej stronie — po prostu drugi koniec tego samego mostu.

Razem z `_policyVersion` importer musi ustawiać `_catalogVersion` (odcisk `version(current)`),
bo blokada 7/7 (`:198`) porównuje go z bieżącym stanem produktu. Pozycja dla kodu, którego nie ma
w katalogu, ma tam `null` — `version(undefined) === null`.

## 2. Czego możesz używać BEZ przepisywania

`src/import/polityka/helpery.ts` to gotowy most ESM→CJS do niezminifikowanego `staging_policy.cjs`:
`validateEan`, `rawEan`, `syntheticCode`, `compatibility`, `identity`, `norm`, `version` — bierzemy
je **wprost z oryginału**, nie z kopii w TS. Do tego `hash`, `KEYS` (nieeksportowane przez moduł,
odtworzone dosłownie) oraz `BladPolityki`/`odmow` — odpowiednik `fail()`, zawsze 409.

`src/import/polityka/kontekst.ts` daje `produktPoKodzie`, `pozycjaStagingu`, `usunZgloszeniaPary`,
`chron` (`protect`, `:158-162`) i `wstrzymajAutomatycznie` (`suspend`, `:120-130`).
**`suspend()` jest wspólny** — woła go `chooseAbsenceCard` (moje) i `importer()` (Twoje).
Nie przepisuj go drugi raz; zwróć uwagę, że znacznik w `product_auto_suspensions` powstaje tylko
dla produktu `aktywny` albo już oznaczonego (ręczne wstrzymanie Ani nie jest przejmowane),
a `UPDATE` leci wyłącznie, gdy stan faktycznie się różni.

## 3. Pułapka, która kosztowała mnie BLOCKER w review

**Sprawdzaj, czy oryginał woła wersję NADPISANĄ, czy bazową.** `install()` robi
`const original={add:U.addStaging.bind(U), accept:…, edit:…}` PRZED podmianą, więc `original.add`
to wersja sprzed patcha, a `U.addStaging` — po. Różnica niesie zachowanie:
`U.addStaging` (`:163-167`) czyści parę `(dostawca, kod)` przed wstawieniem, `original.add` nie.

U mnie `resolveStaging` wołało bazową zamiast nadpisanej i `action: "link"` na kod, pod którym
wisiało już inne zgłoszenie, wywracał się o indeks unikalny `staging_one_current_product` surowym
500 z treścią SQL-a. **`importer()` woła `U.addStaging` w wielu miejscach — przy każdym sprawdź,
o którą wersję chodzi.**

## 4. `assignKodImportu` — NIE podmieniaj globalnie

`zatwierdzPozycjeStagingu` (`src/import/akceptacja.ts`) dostało parametr
`nadajKod: NadawanieKoduImportu` z domyślną wartością = STARA wersja z `legacy/bridge_ext.cjs`.
Politykową wersję (`src/import/polityka/kod-importu.ts`, port `:141-157`) podaje warstwa akceptacji.

Powód jest konkretny: harness `test/charakteryzacja/akceptacja/oryginal.mjs` tnie oryginał **bez**
`install()`, więc musi dalej widzieć stare grupowanie. Gdyby podmienić `silnik/bridge-ext.ts`
globalnie, padłyby scenariusze charakteryzacyjne bazowej akceptacji i bulku.
**Jeśli importer potrzebuje nowego grupowania, wstrzyknij je tak samo — nie ruszaj `bridge-ext.ts`.**

## 5. Rozstrzygnięcie, które zostawiam Tobie: `PustyImportBlad` vs `feed_safety`

`wejscie-120.md` pkt 3 (ten sam plik dostałeś) pyta, czy nasz starszy `PustyImportBlad`
(odstępstwo D7) ma zostać, czy ustąpić komunikatowi produkcji. **To `parsuj.ts` i `tk.ts`, czyli
Twoje pliki** — w moim zakresie nie ma tej ścieżki. Nie ruszałem.

## 6. Pomiar, który Cię dotyczy

Zatwierdzanie zbiorcze: **386 ms na pozycję** po Staging v2 wobec 6,7 ms przed (58×). 95 % kosztu
to nadpisane `assignKodImportu` — `U.listProducts()` dla KAŻDEJ pozycji plus `compatibility()`
po całym katalogu (zmierzone: 251,7 + 116,4 ms przy 7405 produktach). **To kod produkcji i świadomie
go nie optymalizowałem.** Jeśli importer też zacznie wołać nowe grupowanie masowo, koszt się zsumuje
— warto to zmierzyć po Twojej stronie, zanim ktoś zobaczy to u Ani. Narzędzie gotowe:
`rebuild/backend/scripts/pomiar-107.ts` (argumenty: ścieżka do bazy, liczba pozycji, wariant).

## 7. Test, który należy do Ciebie

`test/silnik.gate.test.ts:222-246` („EAN w notacji naukowej — D4 daje ean=null…") opisuje okno
przejściowe i sam zapowiada przepisanie „przy porcie SILNIKA w I15.4". Silnik to Twoja karta.
Asercje są nadal prawdziwe (nie dotykam `tk.ts`), ale komentarz o „docelowo blokadą akceptacji"
jest już nieaktualny — blokada istnieje i jest pokryta w `test/akceptacja.odstepstwa.test.ts`.
