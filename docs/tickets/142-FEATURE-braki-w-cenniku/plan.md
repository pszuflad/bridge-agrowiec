# 142-FEATURE-braki-w-cenniku — panel „Braki w cenniku” (karta I15.11)

> Status: Draft
> Branch: `feature/142-braki-w-cenniku`
> Worktree: `.worktrees/142-FEATURE-braki-w-cenniku`

## Opis ticketa

Karta I15.11 — „panel «Braki w cenniku» i podgląd starej karty (frontend, ostatnia karta z kodem
w I15)”. Wejście biznesowe: backlog #103 i #106. Źródło prawdy: `origin/main` @ `88fa31c`.

## Kontekst

**Zakres karty nie przetrwał zderzenia z diffem produkcji.** Rozłożenie żywego bundla — tak jak
nakazuje CLAUDE.md („nazwa `.bak` daje ETYKIETĘ, nie treść”) — pokazało coś innego niż opis karty.

### Ustalenie 1 — „Braki w cenniku” to ZMIANA CZTERECH NAPISÓW, nie nowy panel

`git diff 7d6cfc9 88fa31c -- mirror/frontend/assets/index-PRICEFMT1783512500.js` to **26 bajtów**
w czterech literałach. Zero nowej logiki, zero nowego `fetch`, zero nowego komponentu:

| # | Przed | Po | Miejsce w bundlu |
|---|---|---|---|
| 1 | `` `Wycofane: ${r.wycofane}` `` | `` `Braki w cenniku: ${r.wycofane}` `` | podsumowanie importu (@375085) |
| 2 | `{v:"wycofana",l:"Wycofane"}` | `l:"Braki w cenniku"` | lista opcji filtra `YP` (@403344) |
| 3 | `wycofana:{l:"Wycofana"}` | `l:"Brak w cenniku"` | odznaka typu `XP` (@403861) |
| 4 | `zniknal:{l:"Wycofana"}` | `l:"Brak w cenniku"` | odznaka typu `XP` (@403937) |

„Braki w cenniku” nie jest panelem **obok** filtra „Typ sprawy” — jest **opcją wewnątrz** tego
filtra (`select-filter-type`). Prompt karty i `wejscie-140.md` pkt 1 opisują wpięcie, którego
w produkcji nie ma.

`mirror/frontend/index.html` zmienia wyłącznie cache-buster (`?v=20260922absences`,
`?v=20260923dotchoice`) — nic do portowania.

### Ustalenie 2 — „dowody kompletności” nie istnieją w UI produkcji

Przeszukanie całego żywego bundla i `staging-policy-injection.js` @ `88fa31c`: produkcja **nigdzie**
nie renderuje dowodów (`fingerprint`, `checkedAt`, „trzy oferty”, „24 h”). Żyją wyłącznie w backendzie:
`import/polityka/fabryka.ts` buduje `_absenceEvidence` (max 3), a `import/polityka/blokady.ts:53`
odmawia akceptacji komunikatem „Brak trzech wiarygodnych potwierdzeń nieobecności. Wczytaj aktualny
cennik.”. `polityka.ts:70` typuje `absenceEvidence: unknown[]`, ale żaden JSX go nie używa.

Pokazanie dowodów byłoby **wymyślaniem nowego zachowania**, nie odtwarzaniem. Decyzja D-A.

### Ustalenie 3 — punkt 2 karty jest już dowieziony przez ticket 140

Cały diff `staging-policy-injection.js` @ `88fa31c` (gałąź `absenceReview`, sekcja „Stara karta
w katalogu”, `KartaPorownania`, `choose-absence-card`, przycisk „Sprawdź kartę”, karty konfliktu
`duplicateSource`) jest sportowany na `develop` w `pages/staging/OknoRozstrzygniecia.tsx`.
Potwierdza to `docs/karty/I15.11/wejscie-140.md`, sekcja „Ostrzeżenie o zakresie”.

### Ustalenie 4 — skąd wziął się rozjazd

`dane.ts` niesie etykiety ze STAREGO `deminified/frontend-index.js` (bundel z 2026-08-13, sprzed
czterech łatek), nie z żywego `88fa31c`. Pozostałe wpisy (`all`, `nowa`, `nowy`, `zmiana_kluczowa`,
`blad`) są już identyczne — rozjazd dotyczy dokładnie tych pozycji, które łatka ruszyła. To
podręcznikowy przypadek pułapki opisanej w CLAUDE.md.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Ticket nie dotyka kontraktu API.** Zmiany są wyłącznie w warstwie prezentacji frontendu (etykiety
tekstowe). Żadne żądanie, żadna ścieżka `openapi.yaml`, żaden kształt odpowiedzi się nie zmienia;
wartość `typZmiany="wycofana"` wysyłana w filtrze pozostaje bez zmian. GATE odbudowy **nie obowiązuje**.

Odnotowany rozjazd (bez wpływu na ten ticket): `contract/fixtures/GET_staging.json`
i `GET_staging_paged.json` pochodzą z sierpnia 2026, sprzed #103 — nie zawierają przykładu wiersza
`wycofana` z `_absenceEvidence` ani aktualnego `powod`. Nagranie świeżych wymagałoby trybu
`reconcileOnly+verifyAbsence`, którego nic w odbudowie nie woła (backlog #103, decyzja D2
„nie odtwarzamy”). Do „Follow-up”.

## Decyzje

- **D-A (użytkownik): tylko etykiety 1:1.** Odtwarzamy cztery napisy produkcji. Dowodów
  kompletności NIE pokazujemy — produkcja tego nie robi, a domyślną regułą jest odtwarzanie.
- **D-B (użytkownik): punkt 2 karty zamknięty przez ticket 140.** I15.11 zawęża się do panelu
  „Braki w cenniku”. Obalone założenie usuwam z `docs/karty/I15.11/karta.md` (CLAUDE.md, obowiązek 4),
  dowód zapisuję w „Do koordynatora”.
- **D-C (użytkownik): napis nr 1 robię mimo że leży poza przydziałem plików.** Podsumowanie importu
  siedzi w `pages/konfiguracja/DialogWgrywania.tsx`, a karta dostała `pages/Staging.tsx` i
  `pages/staging/**`. Bez tego odbudowa zostałaby z niespójnym nazewnictwem. Przekroczenie zakresu
  odnotowuję w raporcie i w „Do koordynatora”.
- **D-D (moja, w granicach 1:1): dokładam wpis `zniknal` do `WYGLAD_TYPU`.** Oryginał ma go w `XP`,
  odbudowa nie ma go wcale. `zniknal` jest wartością zaszłą — silnik odbudowy jej nie produkuje
  (`grep` po `rebuild/backend/src`: zero trafień poza dosłownym portem zapytania analityki
  `analityka-eksport.ts:176`), ale to ta sama sytuacja co zachowana opcja `nowy` („Nowe produkty
  (stare)”) i te same dane zaszłe mogą siedzieć w bazie.

### Świadome odstępstwa od oryginału

Brak. Ticket jest czystym odtworzeniem 1:1.

## Czego NIE zmieniam (sprawdzone w bundlu, produkcja tego nie ruszyła)

- `Staging.tsx:188` — podtytuł „…tylko nowe, **wycofane**, błędne i kluczowo zmienione pozycje”.
  W produkcji @88fa31c ten napis jest NIEZMIENIONY (potwierdzone w bundlu). Zostaje.
- `konfiguracja/Wgrywanie.tsx:133` — „· wycofane: {n} ·” w wyniku per plik. Nie ma odpowiednika
  w żadnym literale bundla; produkcja nie zmieniła tu nic. Zostaje.
- `OknoRozstrzygniecia.tsx` — poza usunięciem zdezaktualizowanego komentarza o punkcie wpięcia.
- `test/msw/staging.ts` — **nie wymaga zmian**. Prompt zakładał nowe trasy do domockowania;
  żadna nowa trasa nie powstaje, a `bladAkceptacji` w `OpcjeHandlerowStagingu` już istnieje.

## Plan implementacji

1. **`rebuild/frontend/src/pages/staging/dane.ts`**
   - `OPCJE_FILTRA_TYPU`: `{ wartosc: "wycofana", etykieta: "Wycofane" }` → `etykieta: "Braki w cenniku"`.
   - `WYGLAD_TYPU.wycofana.etykieta`: `"Wycofana"` → `"Brak w cenniku"`.
   - `WYGLAD_TYPU`: dodać `zniknal: { etykieta: "Brak w cenniku", klasa: "bg-red-600 hover:bg-red-600 text-white" }`.
   - Zaktualizować komentarze odniesienia: wskazać żywy bundel `88fa31c`, nie `frontend-index.js`.
2. **`rebuild/frontend/src/pages/konfiguracja/DialogWgrywania.tsx:217`** — `` `Wycofane: ${sumy.wycofane}` ``
   → `` `Braki w cenniku: ${sumy.wycofane}` ``.
3. **`rebuild/frontend/src/pages/staging/OknoRozstrzygniecia.tsx`** — usunąć z nagłówka komentarz
   `⭐ PUNKT WPIĘCIA DLA KARTY I15.11` (obalony: dowodów nie pokazujemy, punkt 2 zamknięty w 140).
4. **`rebuild/frontend/test/msw/staging.ts`** — zaktualizować komentarz `⭐ PUNKT WEJŚCIA DLA KARTY I15.11`
   (nowych tras nie ma).
5. **Testy** — `test/staging.test.tsx` (opcja filtra „Wycofane” :226, odznaka „Wycofana” :323),
   `test/konfiguracja.test.tsx:356` (napis podsumowania). Dołożyć test odznaki `zniknal`.

## Strategia testów

- **GATE odbudowy: N/D** — ticket nie dotyka API ani kontraktu (uzasadnienie wyżej).
- Testy charakteryzacyjne na DOSŁOWNE napisy — to jedyna siatka bezpieczeństwa, bo fixtures są
  nieaktualne i nie złapią regresji etykiety. Sprawdzamy: opcję filtra, obie odznaki (`wycofana`,
  `zniknal`), napis podsumowania importu.
- Blokada 409 „Brak trzech wiarygodnych potwierdzeń nieobecności…” jest **już** pokryta listą
  `BLOKADY` w `test/staging.rozstrzygnij.test.tsx:543` (ticket 140) — nic nie dokładam.
- Bramki: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` w `rebuild/frontend/`.
  Backend bez zmian — potwierdzam, że jego testy przechodzą.

## Poza zakresem

- Renderowanie `_absenceEvidence` w UI (D-A — produkcja tego nie ma).
- Odmrożenie trasy `close-absence-review` (D-B — decyzja D1 ticketu 140 zostaje).
- Nagrywanie świeżych fixtures stagingu (wymaga trybu, którego nic nie woła).
- Backend, `import/polityka/**`, okno „Rozstrzygnij” poza usunięciem martwego komentarza.

## Definition of done

- [ ] Cztery napisy produkcji odtworzone znak w znak; `zniknal` dodany do mapy odznak
- [ ] Testy charakteryzacyjne na wszystkie cztery napisy + odznakę `zniknal`
- [ ] `karta.md` opisuje STAN (zakres faktycznie dowieziony, zawężenie z dowodem), nie zamiar
- [ ] „Do koordynatora”: zawężenie zakresu, przekroczenie własności plików, wejście dla I15.9 (delta dla Ani)
- [ ] Bramki FE zielone; testy backendu potwierdzone jako przechodzące
- [ ] Gałąź zsynchronizowana z `origin/develop`, bramki zielone PO synchronizacji, PR `MERGEABLE`
