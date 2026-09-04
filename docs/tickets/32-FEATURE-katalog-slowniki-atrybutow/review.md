# 32-FEATURE-katalog-slowniki-atrybutow — Code review (sesja 7c)

> Reviewed: 2026-09-04
> Branch: feature/32-katalog-slowniki-atrybutow
> Diff: 4 pliki zmienione (157 dodanych / 21 usuniętych), 1 commit (`3fc72f8`)

**Uwaga proceduralna:** w worktree nie ma `plan.md`/`raport.md` dla tego ticketa — nie zostały
jeszcze utworzone (branch jest przed „sync docs”). Jako źródło zamiaru użyto opisu sesji 7c
w `docs/rebuild-roadmap.md` (sekcja „Iteracja 7 — Atrybuty”, punkt „7c · `/katalog` — listy
filtrów ze słownika”), który jest szczegółowy i zawiera dokładne odwołania do linii oryginału.

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `rebuild/frontend/test/katalog.eksport-przycisk.test.tsx` — plik renderuje `<App/>` na
  `/katalog` (funkcja `otworzKatalog`), ale nie mockuje `GET /api/atrybuty`, dodanego w tym
  commicie jako nowe żądanie tego widoku.
  - Reason: w praktyce nie psuje testów (React Query łapie błąd zapytania wewnętrznie, `wartosciSlownika` spada do `[]` — zachowanie „sprzed 7c”), ale to realna, nieudana próba połączenia sieciowego na każdy test w tym pliku (potwierdzone: bez jawnego handlera `fetch` idzie do `http://localhost:5173/api/atrybuty`, gdzie nic nie nasłuchuje) i rozjazd z konwencją, którą sam ten commit ustanawia w `katalog.test.tsx` („widok pobiera KOMPLET swoich tras przy każdym wejściu”). Dodatkowo plik nie testuje interakcji eksportu ze słownikiem (np. czy dane słownikowe mogłyby wpłynąć na listę kolumn/eksport), więc realna regresja w tym miejscu przeszłaby niezauważona.
  - Suggestion: dołożyć `http.get("*/api/atrybuty", () => HttpResponse.json({ ok: true, rodzaje: [], wartosci: [] }))` do `zamockujApi()` w tym pliku, analogicznie do `katalog.test.tsx`.

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/Katalog.tsx:97-105` — komentarz przy `useQuery` dobrze
  tłumaczy współdzielenie klucza z `/atrybuty` i dialogiem reguł, ale nie odnotowuje wprost
  (tak jak `Atrybuty.tsx`/`DialogReguly.tsx` robią to u siebie), że `pobierzSlownik` RZUCA na
  401 zamiast oddać `null` jak domyślny `queryFn` — dla czytelnika, który zna tylko ten plik,
  różnica wobec reszty zapytań w `Katalog.tsx` (np. `/api/products`, `/api/config`) nie jest
  oczywista. Nieszkodliwe (wzorzec jest już ustalony i spójny w 7b), ale warto dopisać zdanie.

## Plan compliance

### Done ✓
- `listaMarek`/`listaKategorii` przyjmują drugi argument `wartosciSlownika` (domyślnie `[]`,
  kompatybilność wsteczna) i sumują go z danymi z produktów — zgodnie z `:23287-23295`.
- Filtr „bez cyfr" pozostaje WYŁĄCZNIE na gałęzi produktowej marek (`listaMarek`) — zweryfikowane
  w kodzie i pokryte testem `marki: filtr „bez cyfr” dotyczy WYŁĄCZNIE marek z produktów`.
- Kategorie nie mają filtra cyfr i sortują się zwykłym `.sort()` — asymetria zachowana,
  zweryfikowana testem `kategorie: zwykły sort() i brak filtra cyfr`.
- Kategorie w `/katalog` to SUMA słownika i produktów — INNA reguła niż w `DialogReguly.tsx`
  (7b, kategorie wyłącznie ze słownika); `DialogReguly.tsx` nie został tym commitem dotknięty
  (`git diff` puste), więc reguła 7b nie ucierpiała, a 7c nie skopiowała jej sobie.
  Zweryfikowane wprost testem `kategorie: SUMA słownika i katalogu — inaczej niż w dialogu reguł`.
  z komentarzem ostrzegawczym.
- `Katalog.tsx` woła natywną ścieżkę `useQuery(["/api/atrybuty"], { queryFn: pobierzSlownik })`
  — klucz zgodny z backendem 7a, spójny z `Atrybuty.tsx` i `DialogReguly.tsx` (ten sam wzorzec,
  ta sama funkcja `pobierzSlownik`, więc jeden `invalidateQueries` odświeża wszystkie trzy miejsca).
- Nowy typ `WartoscSlownika` jest lokalny i strukturalny (bez importu z `pages/atrybuty/api.ts`)
  — `filtrowanie.ts` zostaje czystą logiką bez zależności, zgodnie z notą w diffie.
- Memoizacja: `wartosciSlownika = useMemo(() => slownik?.wartosci ?? [], [slownik])` — stabilna
  referencja między renderami, nie psuje memoizacji `marki_`/`kategorie_` niżej ani nie tworzy
  nieaktualnych list (zależność `[slownik]` odświeża się przy każdej zmianie danych zapytania).
- Rebase po 8b nie zgubił nic: przycisk eksportu CSV, mock `/api/config`, `useToast`,
  `shoper.kolumny`/`shoper.separator` — wszystko obecne i przechodzi testy.
- Testy jednostkowe (`katalog.filtrowanie.test.ts`, +7 przypadków) faktycznie łapałyby
  odwrócenie reguł: rozciągnięcie filtra cyfr na słownik, przełączenie kategorii na
  wyłącznie-słownik, zamianę `.sort()` na `localeCompare` dla kategorii — sprawdzone czytaniem
  asercji, nie tylko nazw testów.

### Missing or deviating ✗
- Czwarty konsument słownika (`LT()` — dialog edycji produktu w `deminified/frontend-index.js:23909-23980`)
  pozostaje nieprzeportowany. Zgodnie z notą w roadmapie to OTWARTE PYTANIE o przypisanie
  zakresu (decyzja użytkownika), nie zadanie sesji 7c — nie liczę tego jako odstępstwo od
  planu tej sesji.
- `katalog.eksport-przycisk.test.tsx` (z 8b) nie został zaktualizowany o mock nowej trasy —
  patrz SHOULD-FIX wyżej. To nie jest "missing" względem zakresu planu 7c (ten plik należy do
  8b), ale jest to efekt uboczny tej zmiany, który 7c powinna była zauważyć.

### Definition of done
- [x] Listy filtrów marek/kategorii w `/katalog` to suma słownika atrybutów i danych produktów
  (domknięcie degradacji D3 z Iteracji 2).
- [x] Asymetrie oryginału (filtr cyfr tylko dla marek-z-produktów, brak `localeCompare` dla
  kategorii) zachowane 1:1.
- [x] Reguła kategorii w `/katalog` (suma) odróżniona od reguły w `DialogReguly.tsx` (wyłącznie
  słownik) — obie sprawdzone testami, żadna nie została przypadkiem ujednolicona.
- [x] Testy nowe i istniejące zielone (640/640), lint/typecheck/build czyste (zweryfikowane
  ponownie w tej sesji review).
- [ ] Higiena testów integracyjnych `/katalog` po dodaniu nowej trasy — nie w pełni domknięta
  (`katalog.eksport-przycisk.test.tsx` bez mocka `/api/atrybuty`, patrz SHOULD-FIX).

## Parallel-test concerns

Brak nowych problemów z równoległością — nowe testy w `katalog.filtrowanie.test.ts` są czystymi
funkcjami bez stanu współdzielonego, mock w `katalog.test.tsx` używa lokalnego `server.use`
(MSW resetowany w `afterEach`). Jedyna uwaga (opisana w SHOULD-FIX) dotyczy realnej, nieudanej
próby żądania sieciowego w `katalog.eksport-przycisk.test.tsx` — to nie jest kolizja zasobów
między agentami, ale nieszkodliwy „szum" sieciowy przy każdym uruchomieniu tego pliku.

## Overall assessment

Port jest wierny i dokładnie zweryfikowany względem oryginału (`:23285-23295`) — obie asymetrie
(filtr cyfr tylko dla marek-z-produktów, `.sort()` bez `localeCompare` dla kategorii) oraz
kluczowa różnica wobec reguły z `DialogReguly.tsx` (kategorie: suma vs. wyłącznie słownik) są
odtworzone poprawnie i pokryte celowanymi testami, które faktycznie złapałyby odwrócenie reguł.
Rebase po 8b nie wprowadził regresji. Jedyna realna uwaga to brakujący mock nowej trasy w teście
z 8b (`katalog.eksport-przycisk.test.tsx`) — kosmetyczny, bo funkcjonalnie nieszkodliwy dzięki
fallbackowi, ale warto domknąć dla higieny i spójności z własną konwencją tego commitu.
