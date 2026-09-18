# 61-FEATURE-promocja-kolumna-katalog — Code review

> Reviewed: 2026-09-18
> Branch: feature/61-promocja-kolumna-katalog
> Diff: 9 plików, 3 commity (origin/develop...HEAD)

## BLOCKER

- [ ] `docs/rebuild-roadmap.md` (§I14, karta 14h) i `docs/rebuild-backlog.md` (#22) nie zostały
      zaktualizowane — roadmapa dalej opisuje 14h jako **otwarte** (`"otwarte 14f/14h"`,
      `rebuild-roadmap.md:191,2158,2498`), mimo że ta karta jest zaimplementowana i zamerdżowana
      do zamknięcia. To dokładnie ten dryf, przed którym ostrzega `CLAUDE.md` („roadmapa opisuje
      STAN, nie zamiar", „statusy wpisów aktualizuje ta sesja, która je realizuje, nie
      następna") — a sesja 58-FEATURE-i14i (`git show ad26a01`) zrobiła ten sync docs w ramach
      własnej gałęzi, przed mergem, więc to nie jest nowy standard, tylko pominięty krok.
  - Reason: plan.md ma to jako Implementation plan Krok 6 i jako pozycję Definition of done
    („Roadmapa 14h i backlog #22 opisują STAN, nie zamiar"). Diff nie rusza żadnego z tych
    plików (`git diff origin/develop...HEAD --name-only` — brak `rebuild-roadmap.md`,
    `rebuild-backlog.md`, `spec-frontend.md`). Kolejna sesja czytająca roadmapę dostanie
    fałszywy stan.
  - Suggestion: dopisać commit synchronizujący `rebuild-roadmap.md` (14h → ✅ + data + ID
    ticketa) i `rebuild-backlog.md` (#22 → Status zamknięty), wzorem `ad26a01`.

- [ ] `docs/spec-frontend.md:235-236` dalej twierdzi „**Kolumna „Promocja" w `/katalog` zostaje
      MARTWA** (…) to port 1:1, nie brakujące dane do dociągnięcia" — zdanie jest teraz
      nieprawdziwe i sprzeczne ze stanem kodu wprowadzonym tym samym ticketem.
  - Reason: to ten sam dokument, do którego plan.md (Krok 6) i raport.md (follow-up #3) odsyłają
    jako do zadania „do zrobienia w fazie docs" — ale ta karta jest właśnie tą fazą; zostawienie
    kłamstwa w spec przez kolejne tygodnie/tickety to realne ryzyko, że ktoś zaufa dokumentowi
    zamiast kodowi (dokładnie wzorzec z `CLAUDE.md` o dryfie dokumentacyjnym).
  - Suggestion: zaktualizować akapit razem z synchronizacją roadmapy/backlogu z punktu wyżej.

## SHOULD-FIX

- [ ] `rebuild/frontend/test/katalog.formatowanie.test.tsx:187-188` — brak testu na ŚCIEŻKĘ
      POZYTYWNĄ renderera (`_reguly.promocja` obecne → odznaka `-N%` + nazwa). Istniejący test
      pokrywa wyłącznie przypadek „brak `_reguly`" (kreska).
  - Reason: plan.md „Testing strategy" twierdzi „zachowania renderera FE... istniejące testy
    `katalog.formatowanie.test.tsx` pokrywają je od 4b" — to nieprecyzyjne: pokrywają tylko
    gałąź negatywną. Skoro ten ticket po raz pierwszy sprawia, że backend realnie wysyła
    `_reguly.promocja` do przeglądarki, brak testu na renderowanie wypełnionej odznaki (kształt
    `{wartosc, nazwa}` → `-{wartosc}%` + `nazwa`) zostawia dokładnie tę ścieżkę, którą użytkownik
    zobaczy jako pierwszą, bez pokrycia.
  - Suggestion: dodać przypadek `tekstKomorki`/renderowanie z `produkt._reguly = {promocja:
    {wartosc: 10, nazwa: "X"}}` sprawdzający treść odznaki.

## NICE-TO-HAVE

- [ ] `rebuild/backend/test/katalog.gate.test.ts:362-370` — komentarz „odpowiedź z `_reguly`
      nadal waliduje się względem `contract/openapi.yaml`" brzmi jak walidacja kształtu/schematu,
      a `sprawdzZgodnoscZKontraktem` (`test/gate/kontrakt.ts:8-12`) sprawdza wyłącznie
      ścieżkę/metodę/`security`/kody statusu i content-type, nie treść ciała. Formuła jest
      identyczna do istniejących testów w tym samym pliku (nie wprowadzona przez tę kartę), więc
      nie blokuje — ale warto mieć świadomość zakresu przy czytaniu.

## Plan compliance

### Done ✓
- Krok 1 (BE): `dolaczReguly`, `PromocjaProduktu`, `ProduktZRegulami` w `repos/products.ts`,
  delegacja do `wybierzPromocje` z `repos/ceny.ts` (READ-ONLY, plik nietknięty — potwierdzone
  `git diff --name-only`), szybka ścieżka dla pustej listy promocji (D6).
- Krok 2 (BE): `listaPromocji(db)` wołane RAZ przed rozgałęzieniem w `routes/products.ts`,
  `dolaczReguly` wpięte w OBA warianty odpowiedzi (D3).
- Krok 3 (kontrakt, D4): komentarz nad `/api/products` w `contract/openapi.yaml`. Zweryfikowane
  niezależnie: `node tools/generate-openapi-schemas.cjs --sprawdz` zielony, pełny bieg generatora
  nie zmienia pliku (`diff` po regeneracji pusty), granice bloku generowanego (`:18`–`:18716`)
  potwierdzone `grep`em — komentarz faktycznie leży poza nim.
- Krok 4 (FE, D8): dwa komentarze w `kolumny.ts`/`formatowanie.tsx` zaktualizowane — potwierdzone
  diffem, że to WYŁĄCZNIE treść komentarzy, zero zmian w JSX/typach/zachowaniu.
- Krok 5 (testy): trzy istniejące asercje „72 klucze" w `katalog.gate.test.ts` NIETKNIĘTE
  (potwierdzone diffem — nowy kod dopisany jako osobny `describe` na końcu pliku, stary blok
  bez zmian). Nowy strażnik (8 przypadków `it.each`) i 8 testów jednostkowych w
  `katalog.promocja.test.ts` — sprawdzone eksperymentalnie (patrz niżej), realnie łapią zepsutą
  implementację.
- `contract/fixtures/` niezmienione (potwierdzone `git diff --name-only`).
- `test/gate/ksztalt.ts`, `test/gate/asercje.ts`, `test/gate/dane.ts` (w tym
  `zasiejPromocjeTestowa`/`PROMOCJA_TESTOWA`, wykorzystane, ale wcześniej istniejące) —
  nietknięte.
- Bramki backendu i frontendu zielone: lint/typecheck/build/test uruchomione lokalnie —
  backend 83 pliki/1274 testy, frontend 49 plików/795 testów — zgodnie z raport.md.
- Weryfikacja mutacyjna `dolaczReguly` (eksperyment code review, plik przywrócony po teście):
  „zawsze dokładaj `_reguly` niezależnie od dopasowania" → 8 testów gate + 5 testów
  jednostkowych czerwone; „`wartosc` z `priorytet` zamiast `rabatPct`" → 5 testów czerwonych.
  Strażnik realnie coś dowodzi, nie tylko wygląda na test.

### Missing or deviating ✗
- Krok 6 (docs): `docs/rebuild-roadmap.md`, `docs/rebuild-backlog.md` i `docs/spec-frontend.md`
  nie zostały zsynchronizowane — patrz BLOCKER wyżej.
- Testy renderera FE dla ścieżki pozytywnej `_reguly.promocja` — brak, mimo że plan zakładał
  istniejące pokrycie — patrz SHOULD-FIX wyżej.

### Definition of done
- [x] `GET /api/products` bez parametrów dokłada `_reguly.promocja` przy dopasowaniu
- [x] To samo w wariancie kopertowym (D3)
- [x] Produkt bez pasującej promocji nie ma `_reguly`, dokładnie 72 klucze (D2)
- [x] Dopasowanie idzie przez `wybierzPromocje`/`promocjaPasuje`; `repos/ceny.ts` niezmieniony
- [x] Lista promocji wczytywana raz na żądanie (D6)
- [x] `contract/fixtures/` niezmienione
- [x] `contract/openapi.yaml` — komentarz, `--sprawdz` i pełna regeneracja zielone
- [x] Dwa komentarze FE poprawione, zero zmian w zachowaniu (D8)
- [x] Raport mówi wprost, że kolumna zaświeci dopiero po założeniu promocji (D9) — treść bazy
      (`products=7405`, `promotions=0`) nie została przeze mnie zweryfikowana bezpośrednio,
      `db/snapshot.db` jest w tym worktree wygenerowane lokalnie/gitignored i nie znalazłem go
      pod oczekiwaną ścieżką; opieram się na deklaracji raportu
- [x] Trzy istniejące asercje 72 kluczy nietknięte i zielone
- [x] Nowy strażnik odstępstwa zielony, z komentarzem — i realnie dowodzi (zweryfikowane mutacyjnie)
- [x] Frontend bez zmian w kodzie produkcyjnym (D7) — tylko komentarze
- [x] Bramki backendu zielone: lint, typecheck, build, test
- [x] Raport mówi wprost, że to nowa funkcja, nie powrót do stanu sprzed backupu
- [ ] Roadmapa 14h i backlog #22 opisują STAN, nie zamiar — NIE spełnione, patrz BLOCKER

## Parallel-test concerns

None — all tests parallelizable. Nowe środowisko testowe w `katalog.gate.test.ts` (drugi
`describe`) tworzy własną, świeżą, tymczasową bazę przez `stworzSrodowiskoTestowe()`
(`test/gate/aplikacja.ts:45`), bez `listen()` na porcie (supertest) i bez współdzielonych
katalogów — ten sam wzorzec co reszta bramek w repo.

## Overall assessment

Implementacja jest solidna i dobrze udokumentowana: odstępstwo jest rzeczywiście wąskie
(warunkowe, jeden klucz, delegacja do istniejącego silnika cen, zero zmian w `repos/ceny.ts`
i w fixtures), a nowy strażnik w bramce katalogu nie jest testem-atrapą — zweryfikowałem to
eksperymentalnie, psując `dolaczReguly` na dwa różne sposoby i obserwując, że zarówno strażnik,
jak i istniejące asercje 72 kluczy, faktycznie się zapalają, po czym przywróciłem plik do stanu
wyjściowego (`git status --porcelain` czyste). D4 (komentarz zamiast schematu w kontrakcie) jest
dobrze uzasadnione i empirycznie zweryfikowane (przeżywa `--sprawdz` i pełną regenerację).
Główny problem to nie kod, tylko proces zamknięcia karty: roadmapa, backlog #22 i
`spec-frontend.md` zostały pominięte, mimo że sam plan.md wymienia je w Implementation planie
i w Definition of done, a precedens z sąsiedniej karty (58-FEATURE-i14i) pokazuje, że ten sync
ma się odbyć w tej samej gałęzi, przed mergem. Drugorzędny brak to test FE na pozytywne
renderowanie odznaki promocji — funkcja, którą ten ticket ma pokazać użytkownikowi, nie ma
żadnego automatycznego dowodu, że faktycznie się wyświetli poprawnie.
