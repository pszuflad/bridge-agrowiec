## Ticket
142-FEATURE-braki-w-cenniku — panel „Braki w cenniku” (karta I15.11)

## Summary
Karta I15.11 po rozłożeniu diffu produkcji okazała się **zmianą czterech napisów**, a nie nową
funkcją. Odtworzone 1:1 z żywego bundla `88fa31c`; dołożony brakujący wpis odznaki `zniknal`.
Punkt 2 karty („podgląd starej karty”) był już w całości dowieziony przez ticket 140 — zamknięty
bez zmian w kodzie, z dowodem dla koordynatora.

## Problem / Motivation
Wpis backlogu #103 zapowiadał „Panel: Braki w cenniku, podgląd starej karty”, a karta I15.11 —
„widok/filtr pozycji wraz z DOWODAMI kompletności” wpięty „obok filtra «Typ sprawy»”.

Rozłożenie diffu żywego bundla (CLAUDE.md: „nazwa `.bak` daje ETYKIETĘ, nie treść”) pokazało co
innego. `git diff 7d6cfc9 88fa31c -- mirror/frontend/assets/index-PRICEFMT1783512500.js` to
**26 bajtów** w czterech literałach — zero nowej logiki, zero nowego `fetch`, zero nowego
komponentu. „Braki w cenniku” **JEST OPCJĄ WEWNĄTRZ** filtra `select-filter-type`, nie panelem
obok niego.

| # | Przed | Po | Miejsce |
|---|---|---|---|
| 1 | `` `Wycofane: ${r.wycofane}` `` | `` `Braki w cenniku: ${r.wycofane}` `` | podsumowanie importu |
| 2 | `{v:"wycofana",l:"Wycofane"}` | `l:"Braki w cenniku"` | opcja filtra `YP` |
| 3 | `wycofana:{l:"Wycofana"}` | `l:"Brak w cenniku"` | odznaka `XP` |
| 4 | `zniknal:{l:"Wycofana"}` | `l:"Brak w cenniku"` | odznaka `XP` |

**Przyczyna rozjazdu:** `dane.ts` był portowany ze STAREGO `deminified/frontend-index.js` (bundel
z 2026-08-13, sprzed czterech łatek), nie z żywego `88fa31c`. Pozostałe etykiety były już
identyczne, więc rozjazd dotyczył wyłącznie pozycji ruszonych łatką #103 i nie rzucał się w oczy.

## Solution
- `pages/staging/dane.ts` — opcja filtra → **„Braki w cenniku”**; odznaka `wycofana` →
  **„Brak w cenniku”**; **dodany wpis `zniknal`** (oryginał ma go w `XP`, odbudowa nie miała go
  wcale — odznaka spadała na fallback i pokazywała surowe „zniknal”). Komentarze odniesienia
  przepisane na żywy bundel.
- `pages/konfiguracja/DialogWgrywania.tsx` — człon podsumowania importu → **„Braki w cenniku: N”**.
- `pages/staging/OknoRozstrzygniecia.tsx` i `test/msw/staging.ts` — **wyłącznie komentarze**:
  martwe punkty wpięcia zastąpione zapisem, dlaczego są zamknięte. Zero zmian w kodzie wykonywalnym.
- Testy: nowy blok „«Braki w cenniku» — etykiety z żywego bundla 88fa31c” (4 testy) + trzy
  zaktualizowane asercje.

## Design decisions
- **D-A — tylko etykiety, bez dowodów kompletności.** Przeszukanie całego żywego bundla
  i `staging-policy-injection.js` @ `88fa31c`: produkcja **nigdzie** nie renderuje dowodów
  (trzy oferty, 24 h). Żyją wyłącznie w backendzie, jako blokada akceptacji. `polityka.ts:70`
  typuje `absenceEvidence`, ale żaden JSX go nie używa — i tak zostaje. Pokazanie ich byłoby
  wymyślaniem nowego zachowania, nie odtwarzaniem.
- **D-B — punkt 2 karty zamknięty przez ticket 140.** Cały diff `staging-policy-injection.js`
  (gałąź `absenceReview`, „Stara karta w katalogu”, `choose-absence-card`, przycisk „Sprawdź
  kartę”) jest już sportowany. Potwierdza to ostrzeżenie z `docs/karty/I15.11/wejscie-140.md`.
- **D-C — świadome przekroczenie własności plików.** Napis nr 1 leży w `pages/konfiguracja/`,
  poza przydziałem karty. Ruszony, bo inaczej odbudowa zostałaby z niespójnym nazewnictwem.
  Jeden literał + jedna asercja, zero logiki. Odnotowane w karcie.
- **D-D — dodanie `zniknal`.** Wartość zaszła, której silnik nie produkuje, ale oryginał trzyma
  dla niej osobny wpis — ta sama sytuacja co zachowana opcja filtra „Nowe produkty (stare)”.

**Czego NIE zmieniono** (sprawdzone w bundlu — produkcja też ich nie ruszyła):
`Staging.tsx:188` (podtytuł z małym „wycofane”) i `konfiguracja/Wgrywanie.tsx:133`.

## Tests
- **Gate odbudowy: N/D — ticket nie dotyka API.** Potwierdzone mechanicznie:
  `git diff origin/develop...HEAD -- rebuild/backend/ contract/` jest PUSTY.
- **Frontend:** lint ✓ · typecheck ✓ · build ✓ · `npm test` **56 plików, 995 testów, 0 błędów**.
- **Backend (bez zmian, potwierdzenie):** `npm test` **112 plików, 1837 przeszło, 7 pominiętych**.
- **Kontrola mutacyjna.** Fixtures stagingu pochodzą sprzed #103, więc GATE nie wykryłby powrotu
  starej etykiety. Cofnąłem wszystkie trzy zmiany w `dane.ts` i przebiegłem testy: **6 testów
  padło**, po przywróceniu wszystkie zielone. Asercje realnie bronią etykiet.
- **Code review: 0 BLOCKER / 3 SHOULD-FIX / 0 NICE-TO-HAVE.** Wszystkie trzy dotyczyły
  niewykonanej wówczas fazy dokumentacji — rozliczone, żadne nie wymagało zmiany w kodzie.

## Breaking changes
Brak. Zmiana wyłącznie etykiet widocznych dla użytkownika; klucze danych (`wycofana`, `zniknal`,
`sumy.wycofane`) i kontrakt API bez zmian.

## Follow-up
Cztery znaleziska uboczne w `docs/rebuild-backlog/wpis-142.md`:
- `#142.1` — lista `BLOKADY` w `test/staging.rozstrzygnij.test.tsx:540` ma sześć z siedmiu
  komunikatów (brak „Błędny EAN…”); plik ticketu 140, nie ruszany.
- `#142.2` — komentarz w `SzczegolyPozycji.tsx:126` opisuje mechanizm sprzed #103.
- `#142.3` — fixtures stagingu sprzed #103; GATE nie chroni tego obszaru.
- `#142.4` — **ryzyko systemowe:** etykiety FE portowane z nieaktualnego deminifikatu mogą być
  przestarzałe także w innych plikach; proponowany jednorazowy przegląd.

**Dla koordynatora** (`docs/karty/I15.11/karta.md`, „Do koordynatora”): `docs/rebuild-roadmap.md:483`
zawiera teraz zdanie nieprawdziwe — cytuje „`wycofana` → «Wycofana»/red-600” jako etykietę wziętą
z oryginału DOSŁOWNIE, a to etykieta ze starego deminifikatu. Karta nie rusza roadmapy (reguła 0).

## Review
<details>
<summary>Code review</summary>

# 142-FEATURE-braki-w-cenniku — Code review

> Reviewed: 2026-09-24
> Branch: `feature/142-braki-w-cenniku`
> Diff: 7 plików, 1 commit (`017d947`)

## BLOCKER

Brak. Zweryfikowałem niezależnie wszystkie cztery napisy przeciw żywemu bundlowi
`git show 88fa31c:mirror/frontend/assets/index-PRICEFMT1783512500.js` — treść, klasy CSS
i para liczba pojedyncza/mnoga zgadzają się znak w znak (patrz „Plan compliance" niżej).

## SHOULD-FIX

- [ ] `docs/karty/I15.11/karta.md` — karta nadal ma `Stan: ⬜`, `Dowiezione: —`,
  `Do koordynatora: —`, mimo że `plan.md` (decyzja D-B, DoD pkt 3–4) i CLAUDE.md (obowiązek 1)
  wymagają, żeby zamknięta karta opisywała STAN, a nie zamiar, i żeby dowód zawężenia zakresu
  (punkt 2 karty zamknięty już przez ticket 140) trafił do „Do koordynatora".
  - Uwaga: w ticketach 140 ta aktualizacja szła osobnym commitem „sync docs" PO code review
    (por. `46355af`), więc może to być zaplanowany kolejny krok, a nie przeoczenie — ale skoro
    plan.md wymienia to w DoD, warto potwierdzić przed PR, że ten krok faktycznie się odbędzie.
- [ ] `docs/karty/I15.9/wejscie-142.md` — brak. Plan (DoD pkt 4) wprost wymaga wpisu „wejście dla
  I15.9 (delta dla Ani)" — I15.9 to ostatnia karta bloku I15, zbierająca deltę instrukcji dla Ani
  z całego I15 (`docs/rebuild-roadmap.md:3472`). Bez tego wpisu treść tej zmiany (nowe etykiety
  „Braki w cenniku"/„Brak w cenniku" w UI) nie dotrze do materiału dla Ani, chyba że powstanie
  w tym samym „sync docs" kroku co punkt wyżej.
- [ ] `raport.md` — sekcja „Do koordynatora" wymagana przez `plan.md` (DoD pkt 4: zawężenie
  zakresu, przekroczenie własności plików, wejście dla I15.9) nie istnieje pod tą nazwą; treść
  częściowo pokrywa ją sekcja „Przekroczenie zakresu", ale nie ma w niej dowodu dot. zamknięcia
  punktu 2 karty przez ticket 140 ani odniesienia do I15.9. Do uzupełnienia przy commitowaniu
  `raport.md` (obecnie plik jest `??` w `git status`, jeszcze nie zacommitowany).

## NICE-TO-HAVE

Brak dodatkowych uwag kosmetycznych — zmiana jest bardzo mała i komentarze w kodzie są
nietypowo starannie udokumentowane (odniesienia do konkretnych fragmentów bundla).

## Plan compliance

Zweryfikowane samodzielnie w `/tmp/b.js` (żywy bundel `88fa31c`):

```
r.wycofane>0&&a.push(`Braki w cenniku: ${r.wycofane}`)                         // #1 podsumowanie importu
{v:"wycofana",l:"Braki w cenniku"}                                              // #2 opcja filtra YP
wycofana:{l:"Brak w cenniku",cls:"bg-red-600 hover:bg-red-600 text-white",...}  // #3 odznaka
zniknal:{l:"Brak w cenniku",cls:"bg-red-600 hover:bg-red-600 text-white",...}   // #4 odznaka
```

Liczba mnoga „Brak**i** w cenniku" faktycznie tylko w filtrze i podsumowaniu; liczba pojedyncza
„Brak w cenniku" tylko w obu odznakach — dokładnie tak, jak twierdzi `plan.md`, i dokładnie tak
jest zaimplementowane w `dane.ts` i `DialogWgrywania.tsx`. Klasa CSS odznaki `zniknal` zgadza się
1:1 z `wycofana` (`bg-red-600 hover:bg-red-600 text-white`), tak jak w oryginale (`icon:py` dla
obu — bez znaczenia dla naszej mapy, bo nie niesiemy ikon w `WYGLAD_TYPU`).

Sprawdzone też oba świadomie NIEzmienione miejsca:
- `Staging.tsx:188` (podtytuł „…tylko nowe, wycofane, błędne…") — w bundlu **identyczny**
  literał `"Do decyzji Marty trafiają tylko nowe, wycofane, błędne i kluczowo zmienione
  pozycje..."`, zero zmian. Zgodne z planem.
- `konfiguracja/Wgrywanie.tsx:133` („· wycofane: {n} ·") — w bundlu nie ma żadnego tekstu
  „Wczytano" ani odpowiadającego wzorca „nowe: … zmienione: … wycofane: …" w formie renderowanej
  (jedyne trafienie na `nowe:` to nazwa pola akumulatora w kodzie, nie tekst UI). Potwierdzone:
  brak odpowiednika, zostaje bez zmian.
- Przeszukanie całego bundla pod kątem pozostałych „Wycofan[ae]" poza czterema opisanymi
  miejscami — zero dodatkowych trafień. Żaden napis produkcji nie został pominięty.
- Przeszukanie `rebuild/frontend/src/` pod kątem „Wycofan" po zmianie — zostały tylko
  komentarze i identyfikator `typZmiany === "wycofana"` (wartość danych, nie etykieta UI).
  Żaden zapomniany literał UI.

`OknoRozstrzygniecia.tsx` i `test/msw/staging.ts` — zweryfikowane diffem: wyłącznie zmiany
w komentarzach, zero zmian w kodzie wykonywalnym. Nic z dorobku ticketu 140 (prop
`otworzRozstrzygniecie`, kształt mutacji `akcja`, delegacja `zamockujApi()` do
`handleryStagingu()`) nie zostało naruszone — diff tych plików to tylko blok komentarza.

Wpis `zniknal` w `WYGLAD_TYPU` — uzasadniony i zgodny z oryginałem: `XP` w bundlu ma osobny wpis
`zniknal` o identycznej treści/klasie co `wycofana`; uzasadnienie w komentarzu (wartość zaszła,
analogiczna do zachowanej opcji `nowy`) jest spójne z pozostałą konwencją pliku. To nie jest
martwy kod — bez wpisu wiersz `zniknal` spadłby na fallback odznaki i pokazał surową wartość
(test `it.each` to sprawdza).

### Done ✓
- Cztery napisy z tabeli planu odtworzone znak w znak (`dane.ts`, `DialogWgrywania.tsx`).
- `zniknal` dodany do `WYGLAD_TYPU`.
- Komentarze w `OknoRozstrzygniecia.tsx` i `test/msw/staging.ts` zaktualizowane (punkt wpięcia
  zamknięty bez zmian w kodzie).
- Testy charakteryzacyjne na wszystkie cztery napisy + odznakę `zniknal`
  (`test/staging.test.tsx`, `test/konfiguracja.test.tsx`).
- GATE odbudowy: zasadnie pominięty — `git diff origin/develop...HEAD -- rebuild/backend/
  contract/` jest pusty, ticket faktycznie nie dotyka API/kontraktu.

### Missing or deviating ✗
- `docs/karty/I15.11/karta.md` nie zaktualizowana (patrz SHOULD-FIX) — stan wciąż „⬜", mimo że
  kod jest gotowy i przetestowany.
- `docs/karty/I15.9/wejscie-142.md` nie utworzony (patrz SHOULD-FIX).
- `raport.md` nie ma osobnej sekcji „Do koordynatora" wymaganej przez DoD pkt 4 (patrz
  SHOULD-FIX) — treść częściowo jest, ale rozproszona i niekompletna względem wymogu planu.

### Definition of done
- [x] Cztery napisy produkcji odtworzone znak w znak; `zniknal` dodany do mapy odznak
- [x] Testy charakteryzacyjne na wszystkie cztery napisy + odznakę `zniknal`
- [ ] `karta.md` opisuje STAN, nie zamiar — nadal opisuje zamiar sprzed rozłożenia diffu
- [ ] „Do koordynatora": zawężenie zakresu, przekroczenie własności plików, wejście dla I15.9 —
      niekompletne/rozproszone, patrz SHOULD-FIX
- [x] Bramki FE zielone (lint/typecheck/build/test — potwierdzone ponownym uruchomieniem
      `test/staging.test.tsx` i `test/konfiguracja.test.tsx`, 56/56 zielone); testy backendu
      potwierdzone jako niezmienione i przechodzące (raport)
- [ ] Gałąź zsynchronizowana z `origin/develop`, PR `MERGEABLE` — poza zakresem tej sesji
      (code review), do zweryfikowania przed pushem

## Parallel-test concerns

None — all tests parallelizable. Testy FE korzystają ze wspólnego `queryClient`/`server` MSW,
ale `beforeEach` czyści `queryClient`, `sessionStorage`, `localStorage` i resetuje handlery
(`zamockujApi()`), a baza/porty nie są w ogóle używane (czysty render przeciwko MSW). Brak
tymczasowych plików z zahardkodowaną ścieżką, brak stałych portów.

## Overall assessment

Sam kod jest bardzo dobrej jakości: cztery literały zgadzają się znak w znak z żywym bundlem
(zweryfikowane niezależnie, nie tylko na podstawie raportu), zakres diffu nie wykracza poza
etykiety, a dwa świadomie pominięte miejsca (`Staging.tsx:188`, `Wgrywanie.tsx:133`) są
rzeczywiście bez odpowiednika w produkcji. Zmiany w `OknoRozstrzygniecia.tsx` i
`test/msw/staging.ts` to faktycznie tylko komentarze — dorobek ticketu 140 nienaruszony. Testy
charakteryzacyjne są konkretne i bronią realnie (raport dokumentuje kontrolę mutacyjną — 6 testów
padło po cofnięciu zmian). Jedyny minus to niedokończony krok dokumentacyjny (karta.md, wejście
dla I15.9, sekcja „Do koordynatora" w raporcie) — prawdopodobnie zaplanowany jako osobny commit
„sync docs" (wzorem ticketu 140), ale warto to potwierdzić przed PR, żeby DoD z `plan.md` było
faktycznie w całości spełnione.

</details>

---
Ticket docs: `docs/tickets/142-FEATURE-braki-w-cenniku/`
Zsynchronizowane z `develop` (`7ff55d4`); bramki przebiegnięte po synchronizacji.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
