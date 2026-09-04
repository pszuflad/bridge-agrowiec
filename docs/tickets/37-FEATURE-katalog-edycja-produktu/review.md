# 37-FEATURE-katalog-edycja-produktu — Code review

> Reviewed: 2026-09-05 (runda 2)
> Branch: `feature/37-katalog-edycja-produktu`
> Diff: 14 plików, 3 commity (`16deca5`, `8b4c612`, `8956edf`)

## Runda 2 — status poprawek z rundy 1

| # | Ustalenie z rundy 1 | Status |
|---|---|---|
| SHOULD-FIX | Nagłówek kolumny „Podgląd" zamiast „Akcje" (`TabelaProduktow.tsx:140-142`) | **Naprawione** (`8956edf`) |
| NICE-TO-HAVE | `kodDostawcy ?? ""` zamiast `\|\|` w tytule dialogu (`DialogEdycjiProduktu.tsx:291`) | **Naprawione** (`8956edf`) |
| NICE-TO-HAVE | Brak blokady podwójnego kliknięcia toggle'a statusu | **Świadomie nienaniesione** — słusznie: to zastana wada oryginału (`:23791-23799`), a nie regres tego ticketa; naprawa byłaby niezatwierdzonym odstępstwem. Zostawione jako obserwacja w `raport.md`, nie jako dług — akceptuję. |

### Weryfikacja poprawki 1 (nagłówek „Akcje")

`rebuild/frontend/src/pages/katalog/TabelaProduktow.tsx:138-144` — tekst zmieniony na „Akcje",
dodany `data-testid="header-akcje"`, komentarz nad kodem przestał kłamać (już nie twierdzi
fałszywie, że „kolumna wróciła do oryginału", tylko opisuje historię zmiany etykiety). Zgodne
z oryginałem `deminified/frontend-index.js:23693-23695` (`children: "Akcje"`).

Nowy test (`test/katalog.edycja.test.tsx:140-149`):
```ts
expect(screen.getByTestId("header-akcje")).toHaveTextContent("Akcje");
expect(screen.queryByText("Podgląd")).not.toBeInTheDocument();
```
Nie jest trywialny: pierwsza asercja idzie po `data-testid` dodanym w tej samej poprawce i
sprawdza KONKRETNĄ treść — bez cofnięcia zmiany w `TabelaProduktow.tsx` ten test realnie by nie
przeszedł (sprawdzone uruchomieniem całego pliku, 12/12 zielone). Druga asercja
(`queryByText("Podgląd")`) jest defensywna wobec regresu do starej etykiety gdziekolwiek w
drzewie, nie tylko w tym jednym `<th>` — rozsądne dopełnienie, nie zastępuje pierwszej, którą
uważam za właściwy dowód. Żadna z dwóch nie może przejść fałszywie zielono z powodu tekstu
pojawiającego się „gdzie indziej”: `data-testid="header-akcje"` jest unikatowy, a fraza
„Podgląd” nie występuje już nigdzie w widoku `/katalog` po usunięciu `PodgladProduktu.tsx` (12c).

### Weryfikacja poprawki 2 (`kodDostawcy`)

`rebuild/frontend/src/pages/katalog/DialogEdycjiProduktu.tsx:288-292` —
`String(produkt.kodDostawcy || produkt.kod)`, dokładnie `e.kodDostawcy || e.kod` z `:24037`.
`kodDostawcy` ma typ `unknown` (indeks `[pole: string]: unknown` w `Produkt`), `tsc` przepuszcza
`||` na `unknown` bez zawężenia — potwierdzone `npm run typecheck` (czysto). Nie wprowadza
regresu: dla typowych wartości (string niepusty/pusty, `null`, `undefined`) zachowanie identyczne
z poprzednim `?? ""`; różni się tylko dla teoretycznej liczby `0`, o co dokładnie chodziło.

### Nic nowego nie znalazłem w zmienionych plikach

Diff `8956edf` jest chirurgicznie mały (2 linijki produkcyjnego kodu + komentarze + jeden nowy
test) i nie dotyka niczego poza tym, co było przedmiotem poprawki. Sprawdzone dodatkowo:
- `git diff --stat` całej gałęzi nadal pokazuje wyłącznie pliki z pierwotnego zakresu ticketa —
  backend (`rebuild/backend/`) w dalszym ciągu nietknięty (`git diff origin/develop...HEAD --stat -- rebuild/backend/` puste).
- `lint` / `typecheck` / `build` — czyste.
- Pełna suita: **683 testy / 45 plików, zielone** (potwierdzone lokalnie, zgadza się z raportem).
- Korekta własnej metodologii z rundy 1: plik `test/katalog.gate.test.ts`, o którym mówi
  plan/raport, jest testem **backendowym** (`rebuild/backend/test/katalog.gate.test.ts`), nie
  frontendowym — w rundzie 1 sprawdziłem niewłaściwą (nieistniejącą) ścieżkę we frontendzie,
  co dało pusty, ale niediagnostyczny wynik. Wniosek się nie zmienia (GATE nietknięty, bo
  backend w ogóle nie jest częścią diffu), ale odnotowuję to jako sprostowanie do protokołu,
  nie jako nowy problem w kodzie.

## BLOCKER

Brak.

## SHOULD-FIX

Brak — jedyna pozycja z rundy 1 naprawiona i zweryfikowana.

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/katalog/MenuAkcji.tsx:85-89` — nadal brak blokady podwójnego
  kliknięcia „Wstrzymaj/Aktywuj” w trakcie trwania mutacji. Świadomie nienaniesione (patrz wyżej)
  — zostawiam jako otwartą, nieblokującą obserwację, tak jak w rundzie 1.

## Plan compliance

### Done ✓
Bez zmian względem rundy 1 — wszystkie kroki Implementation planu zrealizowane, teraz łącznie
z poprawnym nagłówkiem kolumny „Akcje” i wiernym fallbackiem `kodDostawcy`.

### Missing or deviating ✗
Brak. Jedyna rozbieżność z rundy 1 (nagłówek kolumny) usunięta.

### Definition of done
- [x] Dialog edycji zastępuje podgląd read-only; `PodgladProduktu.tsx` usunięty, D4 zniesione.
- [x] 42 pola w kolejności oryginału, dosłowne etykiety, `dostawca` disabled, „Bieznik/model"
      pisze `model`+`bieznik`, cztery pola warunkowe działają jako select przy niepustym słowniku.
- [x] `PATCH` wysyła wyłącznie dotknięte pola i wyłącznie klucze z `POLA_EDYTOWALNE_PRODUKTU`.
- [x] Menu „Akcje” w kolejności 1:1, toggle jako jedna pozycja — **teraz łącznie z poprawnym
      nagłówkiem kolumny „Akcje”** (naprawione w tej rundzie).
- [x] Usuwanie woła `DELETE` po potwierdzeniu w `DialogPotwierdzenia` z tekstem `Usunąć {kod}?`;
      anulowanie nie wysyła żądania.
- [x] Override'y widoczne i kasowalne przez `DELETE /api/overrides/{id}`, invalidacja
      `["/api/overrides", dostawca, kod]`.
- [x] Invalidacje `["/api/products"]` + `["/api/history"]`, bez `["/api/alerts"]`/`["/api/analytics"]`.
- [x] Toasty z dosłownymi tekstami oryginału.
- [x] `lint`/`typecheck`/`build`/`test` czyste (683/683 zweryfikowane lokalnie po poprawkach).

## Parallel-test concerns

None — bez zmian względem rundy 1.

## Overall assessment

Obie poprawki trafne, minimalne i poprawnie zweryfikowane testem, który realnie coś dowodzi
(nietrywialna asercja na `data-testid` dodanym w tej samej poprawce). Świadoma decyzja o
nienaprawianiu trzeciej, najmniej istotnej uwagi (brak blokady dwukliku) jest właściwa — to
zastane zachowanie oryginału, a nie coś wniesionego przez ten ticket, więc naprawa bez decyzji
użytkownika byłaby nieautoryzowanym odstępstwem. Zakres diffu poza poprawkami się nie ruszył,
bramki czyste, backend nietknięty. **Gotowe do merge'a.**
