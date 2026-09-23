## Ticket
130-FEATURE-importer-staging-bezpieczenstwo — I15.4b: rdzeń importu na `importer()` ze `staging_policy`

## Summary
Rdzeń importu został **zastąpiony** portem `importer()` zwracanego przez `staging_policy.install()`
(`88fa31c`). Dowieziono bezpieczeństwo źródła (#103), auto-wstrzymania z ochroną wstrzymań ręcznych
(#104), dopasowanie po EAN z ochroną DOT/DEMO (#103/#105), nadpisania Staging v2 (#99) i konsumpcję
`_bridgeFeedMeta`. Wierność udowodniona **dwoma gate'ami przeciw ŻYWEMU oryginałowi**.

## Problem / Motivation
W `mirror/backend/index.cjs` @ `88fa31c` silnik `tk` **nie jest już funkcją bundla**:

```js
tk = require("./staging_policy.cjs").install({U, db:Qi, normalize:Hq, classify:Zc,
                                              badName:Kq, ext:__BRIDGE_EXT});
```

Stary `tk()` (`deminified/backend-index.cjs:47584`) jest **martwy** — nadpisany tą linią. Nasz
dotychczasowy port odtwarzał więc silnik, którego produkcja nie uruchamia, a cała charakteryzacja
mierzyła nieaktualny wzorzec. Stąd wymiana rdzenia, a nie jego rozszerzenie.

## Solution
- **Nowy** `src/import/polityka/fabryka.ts` — port `importer()` (`staging_policy.cjs:332-616`)
  odtwarzający domknięcie `install()`.
- **Nowy** `src/import/polityka/bledy.ts` — cztery blokady źródła + `jestBlokadaZrodla()`.
- `src/import/polityka/podstawy.ts` — prymitywy, których akceptacja nie wołała, a oryginał nie
  eksportuje: `LABEL`, `OPTIONAL`, `separateDotBatch`, `sourceKey`, `codeKey`.
- `src/import/tk.ts` — z 640 linii portu starego silnika do cienkiej warstwy zgodności; domyślnie
  wpina `zadajOdswiezenie` z modułu dostępności I15.10.
- `src/import/{typy,parsuj}.ts` — `MetaCennika` i zdjęcie `_bridgeFeedMeta` (własność
  `enumerable: false`, gubiona przez spread).
- `src/routes/{import,suppliers,staging-mutacje}.ts`, `src/import/synchronizuj.ts` — przekazanie
  `meta`, mapowanie blokad źródła na 400.
- `src/routes/products.ts` — ręczna zmiana `status` kasuje znacznik automatu (D-130.3).
- **Nowy** `test/silnik.polityka-zrodla.test.ts` (17 przypadków) i **nowy** harness
  `test/charakteryzacja/silnik/polityka.mjs`; wzorce MO1–MO10 przenagrane z `install()` @ `88fa31c`.

## Design decisions
- **D-130.1** — #104 (auto-wstrzymania) nanoszone w pełnym zakresie; status wpisu podniesiony na ✅.
- **D-130.2** — `install()` rozcięte jako fabryka + wspólne helpery. ⚠ **Premisa odwrócona w trakcie:**
  karta I15.4c (ticket 129) weszła pierwsza i dowiozła tę warstwę, więc po decyzji użytkownika ta karta
  **adaptowała się do 129 i skasowała duplikaty** — w repo jest jedna definicja `norm()`, `hash()`,
  `suspend()` i `protect()`.
- **D-130.3** — nadpisanie `U.updateProduct` naniesione w `src/routes/products.ts` (poza plikami karty,
  świadomie). Bez tego ochrona ręcznych wstrzymań nie działa end-to-end.
- **D-130.4** — wszystkie blokady źródła dają **400** (kontynuacja odstępstwa D7); `PustyImportBlad`
  zachowuje historyczną treść komunikatu.
- **D-130.5** — punkt wpięcia dostępności; po merge'u ticketu 119 **realnie wpięty**
  (`zadajOdswiezenie`, bez instancji no-op — jak bramka oryginału na produkcyjną bazę).
- **D-130.6** — wzorce charakteryzacji przenagrane z `install()` @ `88fa31c`.

## Tests
- **Gate odbudowy (fixtures/kontrakt):** ✓ zgodne — import nie zmienia KSZTAŁTU odpowiedzi
  czytających. Jedna zmiana na trasach NIEZAMROŻONYCH: `POST /api/import/parse-file`
  i `POST /api/dostawcy/:kod/upload` oddają dodatkowy klucz `pominieteWycofania`, tak samo jak
  produkcja (`...tkResult`).
- **Charakteryzacja:** ✓ 49/49 — port zgadza się z `install()` @ `88fa31c` na MO1–MO10
  i na 21 scenariuszach, pole po polu.
- **Gate polityki źródła (port vs ŻYWY oryginał):** ✓ 17/17 — bez nagranych oczekiwań, więc nie da
  się ich po cichu dopasować do portu.
- **Pełna bramka:** `lint` ✓, `typecheck` ✓, `build` ✓, `test` ✓ — **111 plików, 1835 przechodzi,
  7 pominiętych.** Gałąź zawiera całe `origin/develop`.

## Breaking changes
1. `POST /api/import/parse-file` i `POST /api/dostawcy/:kod/upload` zwracają nowy klucz
   `pominieteWycofania` (trasy niezamrożone w kontrakcie).
2. **Import nie kasuje już kart z katalogu** — `staging_policy` nie ma żadnego `deleteProduct`,
   a znany kod chroni wiersz przed odrzuceniem jako „nie opona".
3. **Brak w kompletnej ofercie wstrzymuje produkt NATYCHMIAST** (`wstrzymany` + stan 0), zamiast
   podbijać licznik przez trzy przebiegi.
4. **Konflikt pliku z poprawką Marty nie jest już nigdzie zgłaszany** i nie blokuje
   auto-zatwierdzenia — `protect()` nakłada poprawkę cicho. **Do decyzji Ani.**
5. **Różnica case-only w polu kluczowym przestała być zmianą** — nie tworzy zgłoszenia.

## Follow-up
- **Ciche nakładanie poprawek Marty** — do rozstrzygnięcia przez Anię.
- **Montaż instancji dostępności** (`ustawDomyslnaSynchronizacjeDostepnosci`) — zakres I15.8.
- **`mirror/backend/index.cjs` na `develop` stoi na `86d9090`**, a `staging_policy.cjs`
  i `bridge_ext.cjs` są na `88fa31c`. Blok helperów jest między tymi commitami bajtowo identyczny,
  więc nie blokował ticketa — plik warto dosynchronizować.
- **Wydajność (#107/#129.1)** — `compatibility()` w pętli nieobecnych porównuje każdą kartę
  z każdym rekordem cennika. Sam `importer()` nie woła `assignKodImportu`, więc koszty się nie sumują.
- **#108 pozostaje otwarty** — gałąź „zachowaj istniejący sześciocyfrowy `kod_importu`" przeniesiona
  dosłownie, rozstrzygnięcie należy do Ani.

## Review
0 BLOCKER · 1 SHOULD-FIX (naprawiony) · 2 NICE-TO-HAVE (w follow-upie).

<details>
<summary>Code review</summary>

Pełna treść: `docs/tickets/130-FEATURE-importer-staging-bezpieczenstwo/review.md`

Reviewer przeszedł `fabryka.ts` linia po linii przeciw `staging_policy.cjs:332-616` i potwierdził
zgodność kolejności łańcucha dopasowania, progów bezpieczeństwa źródła, reguły „pewny powrót",
zapisu `historia_cen`, dowodów ze `slice(-3)` i pętli po produktach nieobecnych — co do warunków,
kolejności efektów ubocznych i literałów komunikatów.

**SHOULD-FIX (naprawiony):** podpunkt D4 z Kroku 12 planu nie został zrealizowany, a raport
twierdził „brak odstępstw". Test `silnik.gate.test.ts` sprawdza teraz blokadę na poziomie silnika
(`typZmiany='blad'`, komunikat walidacji, zachowany `eanRaw`), a raport wprost nazywa przesunięcie
twardej blokady akceptacji (`checkAcceptance()`) do karty I15.4c.

</details>

---
Ticket docs: `docs/tickets/130-FEATURE-importer-staging-bezpieczenstwo/`
