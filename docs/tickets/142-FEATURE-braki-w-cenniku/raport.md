# 142-FEATURE-braki-w-cenniku — raport z wdrożenia

## Podsumowanie

Karta I15.11 („panel «Braki w cenniku» i podgląd starej karty”) po rozłożeniu diffu produkcji
okazała się **zmianą czterech napisów**, a nie nową funkcją. Odtworzone 1:1 z żywego bundla
`88fa31c`; dołożony brakujący wpis odznaki `zniknal`. Punkt 2 karty („podgląd starej karty”) był
już w całości dowieziony przez ticket 140 — zamknięty bez zmian w kodzie, z dowodem dla koordynatora.

## Co ustaliło rozłożenie diffu

`git diff 7d6cfc9 88fa31c -- mirror/frontend/assets/index-PRICEFMT1783512500.js` = **26 bajtów**
w czterech literałach. Zero nowej logiki, zero nowego `fetch`, zero nowego komponentu:

| # | Przed | Po | Miejsce |
|---|---|---|---|
| 1 | `` `Wycofane: ${r.wycofane}` `` | `` `Braki w cenniku: ${r.wycofane}` `` | podsumowanie importu |
| 2 | `{v:"wycofana",l:"Wycofane"}` | `l:"Braki w cenniku"` | opcja filtra `YP` |
| 3 | `wycofana:{l:"Wycofana"}` | `l:"Brak w cenniku"` | odznaka `XP` |
| 4 | `zniknal:{l:"Wycofana"}` | `l:"Brak w cenniku"` | odznaka `XP` |

„Braki w cenniku” to **opcja wewnątrz** filtra `select-filter-type`, nie panel obok niego.
`index.html` zmienia wyłącznie cache-buster — nic do portowania.

**Przyczyna rozjazdu:** `dane.ts` był portowany ze STAREGO `deminified/frontend-index.js`
(bundel z 2026-08-13, sprzed czterech łatek), nie z żywego `88fa31c`. Pozostałe etykiety
(`all`, `nowa`, `nowy`, `zmiana_kluczowa`, `blad`) były już identyczne — rozjazd dotyczył
dokładnie tych pozycji, które ruszyła łatka #103. Podręcznikowy przypadek pułapki z CLAUDE.md.

## Zmiany

- `rebuild/frontend/src/pages/staging/dane.ts` — opcja filtra „Wycofane” → **„Braki w cenniku”**;
  odznaka `wycofana` „Wycofana” → **„Brak w cenniku”**; **dodany wpis `zniknal`** (oryginał ma go
  w `XP`, odbudowa nie miała go wcale). Komentarze odniesienia przepisane na żywy bundel `88fa31c`
  wraz z wyjaśnieniem, czemu `zniknal` nie jest martwym kodem do usunięcia.
- `rebuild/frontend/src/pages/konfiguracja/DialogWgrywania.tsx` — człon podsumowania importu
  „Wycofane: N” → **„Braki w cenniku: N”**. ⚠ Plik POZA przydziałem karty — patrz „Przekroczenie
  zakresu” niżej.
- `rebuild/frontend/src/pages/staging/OknoRozstrzygniecia.tsx` — **tylko komentarz.** Martwy
  `⭐ PUNKT WPIĘCIA DLA KARTY I15.11` zastąpiony zapisem, że punkt jest zamknięty bez zmian
  i że `absenceEvidence` celowo nie jest renderowane. Zero zmian w kodzie wykonywalnym.
- `rebuild/frontend/test/msw/staging.ts` — **tylko komentarz.** Odnotowane, że karta nie dołożyła
  żadnej trasy i że tak ma zostać.
- `rebuild/frontend/test/staging.test.tsx` — zaktualizowane dwie asercje na starych etykietach;
  **nowy blok** „«Braki w cenniku» — etykiety z żywego bundla 88fa31c” (4 testy).
- `rebuild/frontend/test/konfiguracja.test.tsx` — zaktualizowana asercja na napisie podsumowania.

## Odstępstwa od planu

Brak. Plan zrealizowany 1:1.

## Świadome odstępstwa od oryginału

Brak. Ticket jest czystym odtworzeniem 1:1.

## Przekroczenie zakresu (decyzja D-C użytkownika)

Karta dostała `pages/Staging.tsx` i `pages/staging/**`. Napis nr 1 (podsumowanie importu) siedzi
w `pages/konfiguracja/DialogWgrywania.tsx`, a asercja na nim w `test/konfiguracja.test.tsx`. Oba
ruszone **świadomie, na decyzję użytkownika** — bez tego odbudowa zostałaby z niespójnym
nazewnictwem (ekran Staging mówiłby „Braki w cenniku”, podsumowanie importu dalej „Wycofane”).
Zmiana to jeden literał + jedna asercja, bez dotykania logiki. Odnotowane w „Do koordynatora”.

## Czego NIE zmieniono (sprawdzone w bundlu — produkcja też tego nie ruszyła)

- `Staging.tsx:188` — podtytuł „…tylko nowe, **wycofane**, błędne i kluczowo zmienione pozycje”.
  W produkcji @`88fa31c` NIEZMIENIONY.
- `konfiguracja/Wgrywanie.tsx:133` — „· wycofane: {n} ·” w wyniku per plik. Brak odpowiednika
  w jakimkolwiek literale bundla.
- Renderowanie `absenceEvidence` (decyzja D-A) i trasa `close-absence-review` (decyzja D-B).

## Wyniki testów

- **Gate odbudowy (fixtures/kontrakt): N/D — ticket nie dotyka API.** Zmiany są wyłącznie
  w warstwie prezentacji. Żadne żądanie, żadna ścieżka `openapi.yaml`, żaden kształt odpowiedzi
  się nie zmienia; wartość `typZmiany="wycofana"` wysyłana w filtrze pozostaje bez zmian.
  Potwierdzone mechanicznie: `git diff origin/develop...HEAD -- rebuild/backend/ contract/` jest PUSTY.
- **Frontend:** ✓ lint · ✓ typecheck · ✓ build · ✓ `npm test` — **56 plików, 995 testów, 0 błędów**.
- **Backend (bez zmian, potwierdzenie):** ✓ `npm test` — **112 plików, 1837 przeszło, 7 pominiętych**.
- **Kontrola mutacyjna (bo fixtures tego nie złapią).** Fixtures stagingu pochodzą sprzed #103,
  więc GATE nie wykryłby powrotu starej etykiety. Cofnąłem wszystkie trzy zmiany w `dane.ts`
  i przebiegłem testy: **6 testów padło** (w tym 2 istniejące wcześniej), po przywróceniu
  wszystkie zielone. Asercje realnie bronią etykiet, nie przechodzą „po cichu”.

## Breaking changes

Brak. Zmiana wyłącznie etykiet widocznych dla użytkownika; klucze danych (`wycofana`, `zniknal`,
`sumy.wycofane`) i kontrakt API bez zmian.

## Follow-up

1. **Fixtures stagingu są nieaktualne względem #103.** `contract/fixtures/GET_staging.json`
   i `GET_staging_paged.json` pochodzą z sierpnia 2026 — nie zawierają przykładu wiersza `wycofana`
   z `_absenceEvidence` ani aktualnego `powod`. Nagranie świeżych wymaga trybu
   `reconcileOnly+verifyAbsence`, którego nic w odbudowie nie woła (backlog #103, decyzja D2).
2. **Lista `BLOKADY` w `test/staging.rozstrzygnij.test.tsx:540` jest niepełna.** Komentarz mówi
   „Wszystkie sześć komunikatów”, a `import/polityka/blokady.ts` ma **siedem** wywołań `odmow()`.
   Brakuje „Błędny EAN: popraw numer w edycji zgłoszenia przed akceptacją.”. Plik należy do
   ticketu 140 — nie ruszałem, zgłaszam.
3. **Komentarz w `SzczegolyPozycji.tsx:126`** („`snapshotJson` jest `null` dla `wycofana`") opisuje
   mechanizm sprzed #103; nowy zawsze ustawia `snapshotJson` z `_absenceEvidence`. Wymaga
   doprecyzowania „dotyczy wierszy sprzed #103”. Poza zakresem tego ticketa (D-A).
4. **Dwa wpisy `#103` w `docs/rebuild-backlog.md`** (linia 4613 — Selly/`sync-*`; linia 4638 —
   „Braki w cenniku”). Kolizja numeracji do rozstrzygnięcia przez koordynatora.

## Wynik code review

**0 BLOCKER · 3 SHOULD-FIX · 0 NICE-TO-HAVE** (`review.md`).

Reviewer zweryfikował **niezależnie** wszystkie cztery napisy przeciw żywemu bundlowi `88fa31c`
(treść, klasy CSS, para liczba pojedyncza/mnoga) — zgodne znak w znak. Potwierdził też oba świadomie
NIEzmienione miejsca (`Staging.tsx:188`, `Wgrywanie.tsx:133`), że zmiany w `OknoRozstrzygniecia.tsx`
i `test/msw/staging.ts` to wyłącznie komentarze, oraz że dorobek ticketu 140 jest nienaruszony.

Wszystkie trzy SHOULD-FIX dotyczyły **niewykonanej jeszcze fazy dokumentacji**, nie kodu
(`karta.md` w stanie ⬜, brak `docs/karty/I15.9/wejscie-142.md`, brak sekcji „Do koordynatora”).
Rozliczone poniżej — żadne nie wymagało zmiany w kodzie.

## Docs updates

- **`docs/karty/I15.11/karta.md`** — przepisana na STAN: `✅ 2026-09-24 · 142-FEATURE-braki-w-cenniku`,
  sekcja „Zakres” skorygowana (usunięte obalone założenia, zgodnie z CLAUDE.md obowiązek 4),
  „Dowiezione” z tabelą czterech napisów i wykazem tego, czego świadomie nie dowieziono,
  „Do koordynatora” — 7 punktów.
- **`docs/karty/I15.9/wejscie-142.md`** (NOWY) — delta dla Ani w formacie „co zmieniono → polecenie
  → rezultat”: nazwa panelu, gdzie jest, co pokazuje przy braku danych („Brak elementów do
  wyświetlenia”) **wraz z ostrzeżeniem, że pusta lista jest tu normalna**, a nie objawem awarii.
- **`docs/rebuild-backlog.md`** — zamknięte statusy **#103** (panel) i **#106**. Zmiana wyłącznie
  w linii `Status`, zgodnie z regułą „w miejscu wolno zmienić tylko `Do nowej wersji?` albo `Status`”.
- **`docs/rebuild-backlog/wpis-142.md`** (NOWY) — cztery znaleziska uboczne: `#142.1` niepełna lista
  `BLOKADY`, `#142.2` nieaktualny komentarz w `SzczegolyPozycji.tsx`, `#142.3` fixtures sprzed #103,
  `#142.4` ryzyko systemowe etykiet portowanych z nieaktualnego deminifikatu.
- **`docs/rebuild-roadmap.md`** — **NIE RUSZANY** (CLAUDE.md, reguła 0). Znaleziony w nim fałsz
  (linia 483: „`wycofana` → «Wycofana»/red-600” jako cytat z oryginału — to etykieta ze starego
  deminifikatu) zgłoszony w „Do koordynatora” pkt 5 własnej karty.
- **`docs/instrukcja-testow-I3.md`, `docs/instrukcja-testow-I3-v2.md`** — **NIE RUSZANE** celowo.
  Opisują stan, który Ania widziała w iteracji 3; instrukcji testów nie przepisujemy wstecz,
  delta idzie do I15.9.
- **`docs/spec-frontend.md`** — sprawdzony, nie zawiera tych etykiet; bez zmian.

## Do koordynatora (streszczenie — pełna treść w `docs/karty/I15.11/karta.md`)

1. **Zakres karty I15.11 był zawyżony** — „panel” to przemianowanie czterech napisów (26 bajtów).
2. **Przyczyna rozjazdu:** `dane.ts` portowany ze starego deminifikatu — **ryzyko systemowe**,
   inne pliki FE mogą mieć ten sam problem (`#142.4`).
3. **Przekroczenie własności plików** (`pages/konfiguracja/`) — świadome, decyzja użytkownika D-C.
4. **Punkt 2 karty dowieziony już w tickecie 140** — potwierdzenie ostrzeżenia z `wejscie-140.md`.
5. **`docs/rebuild-roadmap.md:483` zawiera teraz zdanie nieprawdziwe** — do poprawienia przez
   koordynatora (karta nie rusza roadmapy).
6. Wejście dla I15.9 zapisane.
7. Drobiazgi: niepełna lista `BLOKADY`, nieaktualny komentarz, nieaktualne fixtures, kolizja
   numeracji `#103` w backlogu.
