# I15.11 — panel „Braki w cenniku” (frontend)

> **Stan:** ✅ 2026-09-24 · `142-FEATURE-braki-w-cenniku`
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #103 (panel), #106 · **Zależy od:** I15.4b, I15.4c (dane i trasy), I15.5 (ten sam widok Staging)
> **Ticket:** 142

Przepisana z karty-rezerwy przez koordynatora (ticket 110, triaż 22.09 wieczór).
Źródło prawdy: `origin/main` @ `88fa31c` (produkcja zamrożona 23.09).

## Zakres (SKORYGOWANY w tickecie 142 — pierwotny opis był obalony)

Port etykiet panelu „**Braki w cenniku**” z żywego bundla produkcji.

⚠ **Pierwotny opis karty mówił o „widoku/filtrze pozycji wraz z dowodami kompletności” i o „podglądzie
starej karty”. Oba założenia obalone rozłożeniem diffu** — patrz „Dowiezione” i „Do koordynatora”.
Usunięte stąd zgodnie z CLAUDE.md, obowiązek 4 („usuń z WŁASNEGO `karta.md` to, co ticket obalił”).

## Pliki (wyłączna własność)
`rebuild/frontend/src/pages/staging/**` (część „Braki w cenniku”), testy FE.
NIE: okno „Rozstrzygnij” (I15.5), backend (I15.4).

## Decyzje
Decyzje D1–D9 z bloku I15 obowiązują. Decyzje własne ticketu 142: D-A, D-B, D-C
(`docs/tickets/142-FEATURE-braki-w-cenniku/plan.md`).

## Dowiezione

**„Braki w cenniku” to przemianowanie CZTERECH NAPISÓW, nie nowy panel.**
`git diff 7d6cfc9 88fa31c -- mirror/frontend/assets/index-PRICEFMT1783512500.js` = **26 bajtów**
w czterech literałach, zero nowej logiki, zero nowego `fetch`, zero nowego komponentu:

| # | Przed | Po | Miejsce | Gdzie w odbudowie |
|---|---|---|---|---|
| 1 | `` `Wycofane: ${r.wycofane}` `` | `` `Braki w cenniku: ${r.wycofane}` `` | podsumowanie importu | `pages/konfiguracja/DialogWgrywania.tsx` |
| 2 | `{v:"wycofana",l:"Wycofane"}` | `l:"Braki w cenniku"` | opcja filtra `YP` | `pages/staging/dane.ts` (`OPCJE_FILTRA_TYPU`) |
| 3 | `wycofana:{l:"Wycofana"}` | `l:"Brak w cenniku"` | odznaka `XP` | `pages/staging/dane.ts` (`WYGLAD_TYPU`) |
| 4 | `zniknal:{l:"Wycofana"}` | `l:"Brak w cenniku"` | odznaka `XP` | `pages/staging/dane.ts` (`WYGLAD_TYPU`) |

Dowiezione wszystkie cztery + **dodany brakujący wpis odznaki `zniknal`** (oryginał ma go w `XP`,
odbudowa nie miała go wcale — odznaka spadała na fallback i pokazywała surowe „zniknal”).

**Czego NIE dowieziono, świadomie:**
- **Dowody kompletności (trzy oferty, 24 h) NIE są renderowane.** Przeszukanie całego żywego bundla
  i `staging-policy-injection.js` @ `88fa31c`: produkcja **nigdzie** ich nie pokazuje. Żyją wyłącznie
  w backendzie — `fabryka.ts` buduje `_absenceEvidence` (max 3), `blokady.ts:53` odmawia akceptacji
  komunikatem „Brak trzech wiarygodnych potwierdzeń nieobecności. Wczytaj aktualny cennik.”.
  `polityka.ts:70` typuje `absenceEvidence`, ale żaden JSX go nie używa — i tak ma zostać.
  Pokazanie ich byłoby wymyślaniem nowego zachowania (decyzja użytkownika D-A).
- **Podgląd starej karty — zamknięty przez ticket 140, bez zmian w kodzie** (decyzja użytkownika D-B).

**Nie ruszone, bo produkcja też ich nie ruszyła** (sprawdzone w bundlu, potwierdzone w code review):
`Staging.tsx:188` (podtytuł z małym „wycofane”) i `konfiguracja/Wgrywanie.tsx:133`.

**Bramki:** FE lint/typecheck/build/test ✓ (995 testów). Backend nietknięty, testy ✓ (1837/7 pominiętych).
Kontrola mutacyjna: cofnięcie zmian w `dane.ts` wywala 6 testów — asercje realnie bronią etykiet.

## Do koordynatora

**1. ZAKRES KARTY BYŁ ZAWYŻONY — dowód, nie przypuszczenie.**
Karta (i prompt do niej) opisywały „widok/filtr pozycji wraz z DOWODAMI kompletności” oraz wpięcie
panelu „obok filtra «Typ sprawy» (`select-filter-type`)”. W rzeczywistości „Braki w cenniku” **JEST
OPCJĄ WEWNĄTRZ** tego filtra, a całość zmiany to cztery literały (tabela wyżej). Dowód:
`git diff 7d6cfc9 88fa31c -- mirror/frontend/assets/index-PRICEFMT1783512500.js` — 26 bajtów.
To jest dokładnie pułapka z CLAUDE.md („nazwa `.bak` daje ETYKIETĘ, nie treść”): etykieta wpisu
backlogu #103 brzmi „Panel: Braki w cenniku, podgląd starej karty”, a treść to przemianowanie.

**2. PRZYCZYNA ROZJAZDU — do sprawdzenia w innych kartach FE.**
`dane.ts` był portowany ze **STAREGO** `deminified/frontend-index.js` (bundel z 2026-08-13, sprzed
czterech łatek), nie z żywego `88fa31c`. Pozostałe etykiety (`all`, `nowa`, `nowy`, `zmiana_kluczowa`,
`blad`) były już identyczne, więc rozjazd dotyczył wyłącznie pozycji ruszonych łatką #103 i nie
rzucał się w oczy. **Warto przejrzeć inne pliki FE portowane z deminifikatu pod tym kątem** —
ten sam mechanizm mógł zostawić stare etykiety gdzie indziej.

**3. PRZEKROCZENIE WŁASNOŚCI PLIKÓW — świadome, na decyzję użytkownika (D-C).**
Napis nr 1 (podsumowanie importu) leży w `pages/konfiguracja/DialogWgrywania.tsx`, a asercja na nim
w `test/konfiguracja.test.tsx` — czyli **poza** przydziałem karty (`pages/Staging.tsx`, `pages/staging/**`).
Ruszone, bo inaczej odbudowa zostałaby z niespójnym nazewnictwem (ekran Staging mówiłby „Braki
w cenniku”, podsumowanie importu dalej „Wycofane”). Zmiana: jeden literał + jedna asercja, zero logiki.

**4. PUNKT 2 KARTY BYŁ JUŻ DOWIEZIONY przez ticket 140** — potwierdzenie ostrzeżenia z `wejscie-140.md`.
CAŁY diff `staging-policy-injection.js` @ `88fa31c` (gałąź `absenceReview`, sekcja „Stara karta
w katalogu”, `KartaPorownania`, `choose-absence-card`, przycisk „Sprawdź kartę”, karty konfliktu
`duplicateSource`) jest sportowany w `pages/staging/OknoRozstrzygniecia.tsx`. I15.11 nie dokładała tam nic.

**5. ROADMAPA MA TERAZ ZDANIE NIEPRAWDZIWE — nie poprawiam sam (reguła 0), zgłaszam.**
`docs/rebuild-roadmap.md:483` wymienia wśród „trzech rzeczy wziętych z oryginału DOSŁOWNIE”:
„`wycofana` → «Wycofana»/red-600”, z odsyłaczem do `fe.js:597593`. To jest etykieta ze STAREGO
deminifikatu. Żywy bundel @ `88fa31c` ma w tym miejscu **„Brak w cenniku”**, a lista opcji filtra
(`fe.js:597086`, też cytowana w tej linii) ma **„Braki w cenniku”** zamiast „Wycofane”.
Ta sama linia poprawnie opisuje resztę (kolory, `nowy` → „Nowe produkty (stare)”, komplet
`data-testid`) — do zmiany jest wyłącznie etykieta wycofań i warto dopisać, że źródłem jest żywy
bundel, nie `deminified/frontend-index.js`. **To jest FAKT (diff), nie zmiana przypisania zakresu.**

**6. Wejście dla I15.9 zapisane** jako `docs/karty/I15.9/wejscie-142.md` (delta dla Ani).

**7. Drobiazgi do rozdysponowania** (nie ruszałem — cudze pliki / poza zakresem):
- `test/staging.rozstrzygnij.test.tsx:540` — lista `BLOKADY` mówi „Wszystkie sześć komunikatów”,
  a `import/polityka/blokady.ts` ma **siedem** wywołań `odmow()`; brakuje „Błędny EAN: popraw numer
  w edycji zgłoszenia przed akceptacją.”. Plik ticketu 140.
- `pages/staging/SzczegolyPozycji.tsx:126` — komentarz „`snapshotJson` jest `null` dla `wycofana`”
  opisuje mechanizm sprzed #103; nowy zawsze ustawia `snapshotJson` z `_absenceEvidence`.
- `contract/fixtures/GET_staging.json` i `GET_staging_paged.json` — z sierpnia 2026, sprzed #103.
  GATE na fixtures NIE złapie regresji etykiety ani formatu `powod`; nagranie świeżych wymaga trybu
  `reconcileOnly+verifyAbsence`, którego nic w odbudowie nie woła.
- **Dwa wpisy `#103` w `docs/rebuild-backlog.md`** (linia 4613 Selly/`sync-*`; linia 4638 „Braki
  w cenniku”) — kolizja numeracji nadal nieprzenumerowana.
