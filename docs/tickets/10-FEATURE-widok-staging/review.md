# 10-FEATURE-widok-staging — code review

> **Uwaga proceduralna:** review wykonany przez Mastera w sesji głównej, nie przez subagenta
> `reviewer` — ta sesja ma zakaz używania narzędzia Agent.

Diff: cztery nowe pliki w `src/`, dwa pliki testów, drobne zmiany w `App.tsx`,
`placeholdery.ts` i `test/msw/kontrakt.ts`.
Bramki: `lint` / `typecheck` / `test` (126) / `build` — zielone. Integracyjne: 12 zielonych.

---

## BLOCKER

Brak.

---

## SHOULD-FIX

### 1. ✅ NAPRAWIONE W TRAKCIE — brak symetrii w testach akcji masowych
Testowanie mutacyjne pokazało, że sprawdzałem ciało `allFiltered` tylko dla ODRZUCANIA.
Mutacja zamieniająca `allFiltered` na puste `ids` w akceptacji przechodziła na zielono.
Dołożony symetryczny test — z filtrem ustawionym na „Wycofane", żeby przy okazji sprawdzić,
że bieżący filtr trafia do ciała żądania, a nie tylko do adresu listy.

### 2. Zaznaczenia czyszczone przy każdej zmianie adresu — świadome
`useEffect` na `adres` zeruje `zaznaczone`. Skutek: przejście na inną stronę gubi zaznaczenie.
**Zostaje**, bo akcja „zaznaczone" ma dotyczyć tego, co użytkownik naprawdę widzi — inaczej
łatwo zaakceptować coś, czego się nie oglądało. Oryginał trzyma zaznaczenia w stanie
komponentu i też ich nie przenosi między stronami.

### 3. `confirm()` przy akcjach „wszystkie" — odstępstwo w stronę ostrożności
Oryginał w tym miejscu nie pyta. Dołożyliśmy potwierdzenie, bo `allFiltered` nie ogląda się
na paginację i jednym kliknięciem potrafi wyczyścić cały staging (na realnych danych to
tysiące pozycji). **To jedyne odstępstwo behawioralne w tym tickecie** — świadome, opisane
w kodzie, i objęte testem (odmowa nie wysyła żądania). Do zgłoszenia Ani przy weryfikacji:
jeśli uzna to za zbędne tarcie, usunięcie jest jednolinijkowe.

---

## NICE-TO-HAVE

### 4. Brak wirtualizacji tabeli — uzasadnione
Katalog (I2) wirtualizuje, bo pobiera cały zbiór jednym żądaniem. Staging jest stronicowany
po stronie serwera (domyślnie 25 wierszy), więc nie ma czego wirtualizować.

### 5. `dane.ts` trzyma i typy, i stałe UI, i mutacje
Trzy rodzaje rzeczy w jednym pliku. Przy tej wielkości (≈170 linii) rozbijanie na trzy pliki
byłoby ceremonią bez zysku; jeśli widok urośnie, naturalny szew to wydzielenie mutacji.

---

## Ustalenia z przeglądu, które NIE są usterkami

- **Dwa różne typy pozycji (`PozycjaStagingu` / `PozycjaStaginguSzczegol`) są celowe.**
  `/paged` oddaje 20 pól bez `snapshotJson`, `/{id}` — 24 pola. Gdyby był jeden typ, TypeScript
  pozwoliłby sięgnąć po `snapshotJson` na liście i podgląd różnic byłby pusty bez ostrzeżenia.
  Test integracyjny pilnuje tego po stronie backendu.
- **`wycofana` ma osobną gałąź w podglądzie** — `snapshotJson` jest tam `null`. To 149 wierszy
  na realnych cennikach, więc gałąź nie jest teoretyczna; ma własny test i mutację.
- **Etykieta „Nowe produkty (stare)" nic dziś nie znajdzie** — wartość `nowy` nie jest
  produkowana przez nasz silnik. Odtworzona świadomie, bo jest w oryginale i może siedzieć
  w starych danych. Opisane w `dane.ts`.
- **`odswiez()` unieważnia `staging` i `products`, a oryginał także `history` i `alerts`.**
  Tamte widoki jeszcze nie istnieją (I5/I6) — zapisane jako follow-up, nie pominięte po cichu.

---

## Werdykt

**Gotowe do merge.** Zakres z planu dowieziony w całości, jedyne odstępstwo behawioralne
(potwierdzenie przy akcjach masowych) jest świadome i opisane. Mutacje wyłapały jedną realną
lukę w testach, zanim wyłapał ją ktoś inny. Gate 3e domknięty w części, która zależy od tej
sesji — reszta zapisana w I11 jako fakt, nie jako cicha zmiana zakresu.
