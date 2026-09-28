# Backlog — wpisy ticketu 142 (`142-FEATURE-braki-w-cenniku`) · 2026-09-24

Nie triaż — to znaleziska uboczne z realizacji karty I15.11. Żadne nie było w zakresie ticketu;
wszystkie dotyczą cudzych plików albo decyzji koordynatora.

### #142.1 · 2026-09-24 · [ODBUDOWA][TESTY] · lista `BLOKADY` w teście FE ma sześć z siedmiu komunikatów

| Pole | Wartość |
|---|---|
| **Data** | znalezione 2026-09-24 (kod z ticketu 140) |
| **Kategoria** | ODBUDOWA + TESTY (nie dotyczy produkcji) |
| **Pliki** | `rebuild/frontend/test/staging.rozstrzygnij.test.tsx:540`, `rebuild/backend/src/import/polityka/blokady.ts` |
| **Commit** | — (stan odbudowy, nie zmiana Ani) |
| **Do nowej wersji?** | ⬜ **do decyzji** |
| **Status** | — |

**Opis.** Komentarz nad listą mówi „Wszystkie sześć komunikatów `checkAcceptance`”, a `blokady.ts`
ma **siedem** wywołań `odmow()` (linie 36, 43, 53, 58, 63, 70, 75). Brakuje:
„Błędny EAN: popraw numer w edycji zgłoszenia przed akceptacją.”

**Szczegół techniczny.** `it.each(BLOKADY)` sprawdza, że komunikat 409 trafia DOSŁOWNIE do okna
„Nie zapisano zmian”. Brakujący komunikat to jedyny, którego nikt nie pilnuje — zmiana jego treści
w backendzie przeszłaby bez czerwonego testu. Dopisanie to jedna linia w tablicy. Plik należy do
ticketu 140, dlatego nie ruszany.

### #142.2 · 2026-09-24 · [ODBUDOWA][DOKUMENTACJA] · komentarz w `SzczegolyPozycji.tsx` opisuje mechanizm sprzed #103

| Pole | Wartość |
|---|---|
| **Data** | znalezione 2026-09-24 |
| **Kategoria** | ODBUDOWA (komentarz, nie zachowanie) |
| **Pliki** | `rebuild/frontend/src/pages/staging/SzczegolyPozycji.tsx:126` |
| **Commit** | — |
| **Do nowej wersji?** | ⬜ **do decyzji** |
| **Status** | — |

**Opis.** Komentarz twierdzi, że dla wiersza `wycofana` `snapshotJson` jest `null`. Było to prawdą
przed wpisem #103; nowa ścieżka (`import/polityka/fabryka.ts`) **zawsze** ustawia `snapshotJson`
z `_withdrawal: true` i `_absenceEvidence`. Kod obsługuje oba warianty poprawnie — nieaktualny jest
sam komentarz, ale to on wprowadza w błąd następną sesję. Wymaga doprecyzowania
„dotyczy wierszy sprzed #103”.

### #142.3 · 2026-09-24 · [KONTRAKT] · fixtures stagingu są sprzed #103 i nie chronią przed regresją

| Pole | Wartość |
|---|---|
| **Data** | znalezione 2026-09-24 |
| **Kategoria** | KONTRAKT |
| **Pliki** | `contract/fixtures/GET_staging.json`, `contract/fixtures/GET_staging_paged.json` |
| **Commit** | — |
| **Do nowej wersji?** | ⬜ **do decyzji** |
| **Status** | — |

**Opis.** Oba pliki pochodzą z sierpnia 2026 (daty `2026-08-17`), czyli sprzed wpisu #103. Nie mają
ani jednego przykładu wiersza `wycofana` z `_absenceEvidence`, ani aktualnego formatu `powod`
(„Brak w trzech różnych, kompletnych cennikach — sprawdź przed wstrzymaniem”), tylko generyczne
„Brak w cenniku — pozycja wycofana”.

**Szczegół techniczny.** Konsekwencja praktyczna: **GATE na fixtures nie wykryje regresji w tym
obszarze** — w tickecie 142 trzeba było oprzeć się na testach charakteryzacyjnych na dosłowny tekst
i na ręcznej kontroli mutacyjnej. Nagranie świeżych fixtures wymaga uruchomienia importera w trybie
`reconcileOnly` + `verifyAbsence`, którego **nic w `rebuild/backend/src/**` nie woła** (była to
jednorazowa operacja `withdrawals_reconcile_20260922.cjs`, wg #103 nieodtwarzana). Czyli: albo
fixtures zostają nieaktualne i mówimy to wprost, albo ktoś musi świadomie zbudować dla nich wejście.

### #142.4 · 2026-09-24 · [DOKUMENTACJA] · etykiety FE portowane z nieaktualnego deminifikatu

| Pole | Wartość |
|---|---|
| **Data** | znalezione 2026-09-24 |
| **Kategoria** | ODBUDOWA (ryzyko systemowe, nie pojedynczy błąd) |
| **Pliki** | `rebuild/frontend/src/pages/staging/dane.ts` (naprawione), potencjalnie inne pliki FE |
| **Commit** | — |
| **Do nowej wersji?** | ⬜ **do decyzji** |
| **Status** | 🔨 `dane.ts` naprawione ticketem 142; reszta FE nieprzejrzana |

**Opis.** `dane.ts` niósł etykiety ze STAREGO `deminified/frontend-index.js` (bundel z 2026-08-13,
sprzed czterech łatek), nie z żywego `index-PRICEFMT1783512500.js` @ `88fa31c`. Dlatego filtr mówił
„Wycofane”, a produkcja od łatki #103 mówi „Braki w cenniku”.

**Szczegół techniczny.** Rozjazd był **niewidoczny przy przeglądzie**, bo wszystkie pozostałe
etykiety w obu bundlach są identyczne — różniły się wyłącznie te, które ruszyła łatka. To znaczy,
że ten sam mechanizm mógł zostawić stare etykiety w **innych** plikach FE portowanych z deminifikatu,
i nikt tego nie zauważy bez celowego porównania z żywym bundlem. **Propozycja:** jednorazowy przegląd
— wyciągnąć z żywego bundla wszystkie literały etykiet i porównać z `rebuild/frontend/src/`.
`deminified/README.md` już ostrzega przed wiekiem deminifikatu; to znalezisko pokazuje, że
ostrzeżenie jest realne i kosztowne.
