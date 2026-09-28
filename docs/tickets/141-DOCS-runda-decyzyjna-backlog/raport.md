# 141-DOCS-runda-decyzyjna-backlog — raport wykonania

## Podsumowanie
Runda decyzyjna karty **DEC.1** przeprowadzona w całości: **14 wpisów backlogu** przejrzanych,
stan faktyczny każdego zmierzony w kodzie na `develop` @ `ab30674` (odnośnik plik:linia albo
pomiar na `db/snapshot.db`), decyzje użytkownika zapisane w polach `Do nowej wersji?` i `Status`.
Po rundzie `tools/stan-backlogu.sh --do-decyzji` pokazuje **3 pozycje** zamiast 14 — wszystkie
faktycznie czekające na Anię. **Zero zmian w `rebuild/`, `contract/` i roadmapie.**

## Korekta zakresu wobec promptu
Prompt mówił o **jedenastu** wpisach (stan `ba4667d`). Na `develop` w chwili startu (`ab30674`)
narzędzie pokazywało **czternaście** — doszły `#137.1` i `#137.2` (ticket 137, zmergowany po
napisaniu promptu) oraz `#135.1`, który sam miał ⬜. Lista wzięta z narzędzia, zgodnie
z poleceniem („aktualną listę bierz zawsze z narzędzia, nie z opisu").

Druga korekta: **katalog `docs/karty/DEC.1/` nie istniał** — koordynator go nie założył przed
wydaniem promptu. Karta założona tym ticketem (nowy plik = zero konfliktu).

## Decyzja użytkownika (2026-09-23) — reguła nadrzędna
> Wszystko, co da się zrobić po cutoverze — robimy po cutoverze. Teraz doprowadzamy stos do
> stanu pozwalającego na wdrożenie produkcyjne w najbliższym czasie.

Konsekwencja: **żaden wpis nie jest blokerem cutoveru**, żaden nie dostał zakresu „przed
cutoverem". Rekomendacje merytoryczne (#94, #43, #98 pkt 3) zostają w mocy — przesunięty jest
wyłącznie termin.

## Zmiany
- `docs/karty/DEC.1/karta.md` — **nowy.** Pełna karta: zakres, stan faktyczny 14 wpisów
  z dowodami, decyzje, dowiezione, „Do koordynatora".
- `docs/karty/TEST.1/wejscie-141.md` — **nowy.** Trzy rzeczy, które Ania może zgłosić jako błąd
  podczas pełnego testu (wszystkie znane i odłożone), plus pytanie `#89` do zebrania przy okazji.
- `docs/rebuild-backlog.md` — 22 linie (11 wpisów × `Do nowej wersji?` + `Status`). Wyłącznie
  te dwie linie na wpis, zgodnie z regułą własności.
- `docs/rebuild-backlog/wpis-135.md` — 2 linie (`#135.1` zamknięty).
- `docs/rebuild-backlog/wpis-137.md` — 4 linie (`#137.1`, `#137.2`).
- `docs/tickets/141-DOCS-runda-decyzyjna-backlog/` — `plan.md`, `raport.md`, `review.md`,
  `pr-body.md`.

## Wynik rundy

| Decyzja | Wpisy |
|---|---|
| ❌ / ✅ **zamknięte** | `#5` (NIE), `#95` (nieaktualny), `#103` Selly (dowiezione I15.8), `#135.1` |
| 🕒 **po cutoverze** | `#12`, `#43`, `#65`, `#88`, `#94`, `#98`, `#137.1` |
| ⬜ **czeka na Anię** | `#89`, `#108`, `#137.2` |

## Ustalenia, które obaliły treść wpisów
Najcenniejsza część rundy — siedem miejsc, w których opis wpisu rozjechał się ze stanem kodu:

1. **`#43`** — teza „w całym `openapi.yaml` zero 403/404/409" **nieprawdziwa**: 404 → 6, 409 → 3.
   Ticket 129 lukę **zwęził**, nie pogłębił (wbrew założeniu promptu). GATE nie jest ślepy —
   **pada** na niezadeklarowany kod, dlatego świadomie nie jest wołany tam, gdzie kontrakt milczy.
2. **`#88`** — wpis i test mierzą **węższy przypadek niż kod**: operator to **OR**, więc pusta
   *sama* `marka` wystarczy. Skala 1 produkt, nie 0; efekt zerowy bierze się z pustej tabeli
   `promotions`, nie z braku pasujących produktów.
3. **`#95`** — **nieaktualny**: opisuje silnik, którego już nie ma (I15.4b).
4. **`#98` pkt 3** — uzasadnienie odłożenia („brak UI") **obalone**: UI istnieje od 2026-09-04,
   sprzed samego wpisu.
5. **`#137.1`** — wpis przedstawia stan jako zaniedbanie; to **skutek świadomej decyzji
   użytkownika z 2026-09-08** (`6594525`, mirror cofnięty bo 12 czerwonych bramek).
6. **`#12`** — przyczyna inna, niż zakładał wpis: 84 produkty wypadają przez **wielkość liter**
   w `selly_kategoria_norm_map`, co otwiera drogę naprawy tańszą niż port CSV.
7. **`#137.2`** — wariant „przywróć meldunek" to **wpięcie istniejącego martwego kodu**
   (`poprawkiMarty`, zero wywołań), nie pisanie od zera.

## Odstępstwa od planu
Dwa, oba wymuszone stanem repo i opisane wyżej: lista okazała się 14-pozycyjna zamiast
11-pozycyjnej, a karta DEC.1 musiała zostać założona przez ten ticket.

## Wyniki testów
- **Gate odbudowy (fixtures/kontrakt): N/D — ticket nie dotyka API.** Zadeklarowane i zweryfikowane
  ZERO zmian w `rebuild/**` i `contract/**` (`git diff --name-only`). Gate nie obowiązuje.
- **Weryfikacja właściwa dla tego ticketu:**
  - `tools/stan-backlogu.sh --do-decyzji` → dokładnie 3 wpisy (`#89`, `#108`, `#137.2`) ✓
  - `tools/stan-backlogu.sh` → 115 wierszy, parsuje się bez błędu ✓
  - 3 wpisy z nieparsowalnym polem (`#11`, `#67`, `#68`) **istniały przed ticketem** — 3 przed,
    3 po; używają `⚠`, którego parser nie zna. Nie ruszane ✓
  - `git diff --name-only` → zero zmian w `rebuild/`, `contract/`, `docs/rebuild-roadmap.md` ✓
- Unit / integracja / E2E: **N/D** — ticket nie zmienia kodu.

## Review fixes applied
Review: **0 BLOCKER**, 3 SHOULD-FIX, 2 NICE-TO-HAVE. Wszystkie trzy SHOULD-FIX naprawione:
- odnośnik `010_marka_caps.sql:24-26` → **`:31-33`** (zweryfikowane: treść wyjątku „NIE RUSZAMY
  `historia_cen.marka`" jest na 31-33) — poprawione w `karta.md`, `wejscie-141.md`
  i `docs/rebuild-backlog.md`;
- odnośniki `selly-sync.ts:154`/`:168` → **`:156`/`:179`** (zweryfikowane grepem wywołań
  `runFullBatch`) — poprawione w `karta.md` i `docs/rebuild-backlog.md`;
- dopisany `raport.md` i odhaczony Definition of done w `plan.md`.

Reviewer potwierdził niezależnie 11 twierdzeń plik:linia z sekcji „Stan faktyczny", zgodność
tabeli decyzji z faktycznym stanem backlogu dla wszystkich 14 wpisów oraz że diff dotyka
wyłącznie linii `Do nowej wersji?`/`Status` w cudzych wpisach.

## Breaking changes
Brak — ticket nie zmienia kodu ani kontraktu.

## Follow-up
Wszystkie propozycje kart są w `docs/karty/DEC.1/karta.md` → „Do koordynatora" pkt 5
(7 kart, ~3-4 dni łącznie, wszystkie PO CUTOVERZE). Poza tym cztery sprawy dla koordynatora:

1. **`#137.1` wymaga decyzji użytkownika, nie karty** — rekomendacja wpisu („dosynchronizować
   mirror") kłóci się z polityką z 2026-09-08. Dodatkowo po cutoverze `mirror/` przestaje być
   wzorcem, więc wpis może stać się bezprzedmiotowy.
2. **Zduplikowany numer `#103`** — dwa różne wpisy o tym numerze w `docs/rebuild-backlog.md`.
   DEC.1 zamknęła pierwszy (Selly); drugi („Braki w cenniku") żyje dalej. Przenumerowanie
   należy do koordynatora.
3. **`docs/karty/DEC.1/` nie było założone** przed promptem — wbrew „Przepływowi fali"
   z `docs/karty/README.md`.
4. **`docs/karty/I15.10b/karta.md` ma `Stan: ⬜ do wstawienia w kolejkę`**, choć PR #149
   (ticket 136) jest zmergowany — do odświeżenia.

Do zgłoszenia Ani jako fakt (nie pytanie): **`#12` — 84 opony nie docierają dziś do Selly**,
tak samo w produkcji. To jej decyzja handlowa, czy priorytetyzować.
