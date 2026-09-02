# 16-FEATURE-widok-narzuty-promocje — Code review

> Reviewed: 2026-09-02
> Branch: feature/16-widok-narzuty-promocje
> Diff: 20 plików, 4 commity (origin/develop...HEAD)

## BLOCKER

- [ ] `rebuild/frontend/src/pages/narzuty/DialogReguly.tsx:159` i `:189` — edycja istniejącej reguły/promocji **zawsze wysyła `priorytet: 50`**, niezależnie od aktualnej wartości w bazie.
  - Reason: Oryginał (`:24221`) trzyma `priorytet` w stanie `C`, inicjalizowanym z `t?.priorytet ?? n?.priorytet ?? 50` — mimo że formularz nie ma pola do jego edycji, przy zapisie EDYCJI odsyła wartość istniejącą, nie zawsze 50. Port hardkoduje `priorytet: 50` w obu ciałach (`cialo` dla narzutu i promocji) — także przy `PATCH` na edycji. Efekt: edycja dowolnej reguły/promocji, której `priorytet` w bazie różni się od 50 (np. dane seed, import, ręczny zapis przez API), **cicho nadpisuje ten priorytet na 50** przy najbliższym zapisie w UI, mimo że użytkownik nic z priorytetem nie robił. `wybierzNarzut`/`wybierzPromocje` sortują po `priorytet` i to on rozstrzyga remisy między regułami tego samego typu — cicha zmiana tej wartości zmienia, która reguła wygrywa dla produktów, bez śladu w UI. Fixture (`GET_markups.json`) akurat ma `priorytet: 50`, więc żaden test tego nie łapie.
  - Suggestion: przy budowaniu `cialo` użyć `priorytet: edytowanyNarzut?.priorytet ?? edytowanaPromocja?.priorytet ?? 50` (albo trzymać `priorytet` w stanie komponentu, inicjalizowanym z `edycja?.priorytet ?? 50`, tak jak oryginalne `C`), i dopisać test edycji reguły z `priorytet !== 50` pilnujący, że wartość przeżywa zapis.

- [ ] `docs/rebuild-roadmap.md:154,297,822,823,855,873` i `docs/rebuild-backlog.md` — roadmapa i backlog **nie zostały zaktualizowane**, mimo że `plan.md` i `raport.md` wprost to obiecują.
  - Reason: `git diff origin/develop...HEAD` nie dotyka żadnego z tych plików. Roadmapa nadal mówi „4b (FE) niezrobione” / „⬜ nie zaczęte” (`:822-823`, `:855`) i że kolumna „Promocja” „czeka na widok 4b” (`:297`), mimo że `raport.md` deklaruje sesję jako Shipped z 261 zielonymi testami frontendu. To dokładnie łamie regułę projektu z `CLAUDE.md` („Po każdym zamkniętym bloku roadmapa opisuje STAN, nie zamiar”) i punkt DoD z `plan.md`: „Kolumna „Promocja” nietknięta; backlog i roadmapa sprostowane (D1)” — ten punkt jest w planie zaznaczony jako niespełniony (`[ ]`) i pozostaje niespełniony w diffie. Dodatkowo D8 zapowiada wpis backlogu o rozjeździe `Mb()` z backendem („Rozbieżność oryginału opisana w backlogu (Faza 5)”) — też nieobecny. Kolejna sesja czytająca roadmapę dostanie fałszywy obraz stanu prac (patrz zasada #1 i #4 w `CLAUDE.md`).
  - Suggestion: dopisać blok 4b jako zamknięty (data, ticket, zakres faktycznie dowieziony), sprostować notę o kolumnie „Promocja” w I2/I4b, dodać wpisy backlogu o martwym `_reguly` (D1) i o rozjeździe `Mb()` z backendem (D8) w Fazie 5.

## SHOULD-FIX

- [ ] `rebuild/frontend/src/pages/narzuty/DialogReguly.tsx:213` — kontrola „poniżej kosztu” liczy przez `produktyPonizejKosztu(katalog, [], [podglad])`, czyli **z pustą listą narzutów** — ignoruje aktualnie obowiązujące reguły narzutu.
  - Reason: Oryginał (`:24565`) liczy próg na bazie `prd.cenaSprzedazy` — REALNEJ, aktualnej ceny sprzedaży z katalogu, która już zawiera efekt obowiązującego narzutu (backend przelicza cały katalog po każdej mutacji narzutu, 4a). Port pomija narzuty całkowicie i liczy od `cenaZakupu`, więc przy jakimkolwiek aktywnym narzucie (fixture ma globalny +6%) pokazywana w dialogu `cenaSprzedazy` i sama decyzja „poniżej kosztu” nie odpowiadają temu, co faktycznie wyjdzie po zapisie. Kierunek błędu jest bezpieczny (zaniżona cena bazowa → check ostrzega częściej, nie rzadziej), ale to prosta niedokładność sprzeczna z własnym uzasadnieniem D8 („symulator/kontrola mają tłumaczyć cenę, która NAPRAWDĘ jest w katalogu”) — tu kontrola pokazuje liczby, których w katalogu nie będzie. Testy (`narzuty.dialog.test.tsx`, rabat 90%/5%) używają wartości tak skrajnych, że różnica +6% narzutu nie zmienia wyniku testu — więc luka jest niewidoczna dla zielonego test suite.
  - Suggestion: pobrać narzuty (`useQuery(["/api/markups"], pobierzNarzuty)`) w `DialogReguly` i przekazać realną listę zamiast `[]` do `produktyPonizejKosztu`.

- [ ] `rebuild/frontend/src/pages/narzuty/DialogReguly.tsx` — brak portu **reaktywnego** ostrzeżenia „poniżej kosztu”, wyświetlanego na żywo w formularzu podczas edycji (przed kliknięciem Zapisz).
  - Reason: Oryginał ma DWA niezależne mechanizmy tej samej kontroli: (1) baner inline `⚠ UWAGA: X produkt(ów)...` renderowany reaktywnie z aktualnego stanu formularza (`:24467-24513`, osobny `useMemo`-podobny IIFE, matcher `_mtc` bez `konstrukcja`/`srednica`/`vfIf`) — pokazuje się natychmiast przy wpisywaniu rabatu/warunków, zanim użytkownik w ogóle kliknie „Zapisz”; (2) `window.confirm` przy zapisie (`:24598`), który port implementuje jako `dialog-ponizej-kosztu`. Port ma wyłącznie (2). `plan.md` (Ustalenie 7, D6) opisuje tylko mechanizm (2) — mechanizm (1) nie został w ogóle rozpoznany przy lekturze oryginału, więc to nie jest świadomie odrzucony zakres, tylko przeoczenie.
  - Suggestion: dodać do backlogu jako świadomą decyzję (port albo rezygnacja) zamiast zostawiać jako niezauważoną lukę; jeśli celowo pomijane — dopisać do D6/D4 w planie.

- [ ] `rebuild/frontend/src/pages/narzuty/Symulator.tsx` — układ i zachowanie wyszukiwarki znacząco odbiegają od `UT()` bez odnotowania jako świadome odstępstwo.
  - Reason: Oryginał szuka po `rozmiar`/`marka`/`model`/`nazwa`/`kod` i pokazuje do 50 trafień z notą „Pokazane pierwsze 50”, plus osobny widok wybranego produktu z przyciskiem „Zmień” i deltami cenowymi przy każdym kroku (`Pi()` z `delta`). Port szuka wyłącznie po `kod`/`nazwa`, limituje do 5 trafień i nie pokazuje delt kwotowych między krokami. `plan.md` D3/Krok 8 opisuje symulator ogólnie („wyszukiwarka produktu i rozbicie ceny krok po kroku”), nie precyzuje pól/limitu — różnica nie jest więc jawnie zatwierdzonym odstępstwem, tylko niedoprecyzowaniem, które wykonawca rozstrzygnął sam.
  - Suggestion: dopisać do backlogu/planu jako świadomą decyzję albo dociągnąć wyszukiwanie do pól/limitu oryginału.

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/narzuty/TabelaNarzutow.tsx:172` i `TabelaPromocji.tsx` (przycisk usuń) — ikona `Trash2` nie ma klasy `text-red-500`, którą ma oryginał (`:24793`, `:24960`) — czysto kosmetyczna różnica.
- [ ] `rebuild/frontend/src/components/ui/toast.tsx:112` — komunikat toastu zamyka się kliknięciem na `div`, bez odpowiednika klawiaturowego (np. `role="button"`/`tabIndex`) — drobna luka dostępności.
- [ ] `rebuild/frontend/src/pages/narzuty/DialogReguly.tsx:200` — treść komunikatu walidacyjnego „Brak warunków” różni się słownie od oryginału („Dodaj warunek albo zaznacz regułę globalną.” vs „Dodaj co najmniej jeden warunek lub zaznacz regułę globalną.”) — sens ten sam.

## Plan compliance

### Done ✓
- Krok 1 — `toast.tsx` + `Toaster` w `App.tsx` (D7).
- Krok 2 — `api.ts`: typy, klient, wyłącznie pola z list edytowalnych, `odczytajCialo` znosi 200-pusty-body na `PATCH /api/promotions/{id}`.
- Krok 3 — `warunki.ts`: (de)serializacja, 9 typów (D4), opis reguły.
- Krok 4 — `ceny.ts`: silnik zgodny z `rebuild/backend/src/repos/ceny.ts` (formuła, specyficzność, priorytet, sort) — zweryfikowane liniowo, liczby w testach klienta i backendu się zgadzają.
- Krok 5, 6 — `TabelaNarzutow.tsx`, `TabelaPromocji.tsx`: kolumny, `data-testid`, sort po `id` malejąco, stany puste, badge GLOBALNY/GLOBALNA, D5 (literówka `zaplanowana`, znacznik rozbieżności, nagłówek bez fałszywej obietnicy) — 1:1 z `WT()`/`BT()` poza jednym kosmetycznym detalem (kolor ikony usuwania).
- Krok 7 — `DialogReguly.tsx`: przełącznik trybu, builder warunków, walidacje, kontrola „poniżej kosztu” na zapisie (własny dialog, D6) — patrz BLOCKER/SHOULD-FIX wyżej co do dokładności i kompletności portu.
- Krok 8 — `Symulator.tsx` w zakresie (D3), liczy silnikiem z Kroku 4 — patrz SHOULD-FIX co do wierności UI.
- Krok 9, 10 — `Narzuty.tsx`, rejestracja trasy, liczba tras routera pozostaje 12 (zweryfikowane liczeniem).
- Krok 11 — kolumna „Promocja” nietknięta w kodzie (D1) — **ale dokumentacyjna część kroku (backlog + roadmapa) niewykonana**, patrz BLOCKER.

### Missing or deviating ✗
- Wpis backlogu i sprostowanie roadmapy (D1, D8, DoD) — nie ma go w diffie (BLOCKER wyżej).
- `priorytet` przy edycji reguły/promocji nie jest zachowywany (BLOCKER wyżej) — nieudokumentowane odstępstwo, nie decyzja.
- Kontrola „poniżej kosztu” nie uwzględnia aktywnych narzutów i nie ma odpowiednika reaktywnego banera z oryginału (SHOULD-FIX wyżej) — nieudokumentowane w planie.

### Definition of done
- [x] `/narzuty` renderuje dwie zakładki, zniknęło z `placeholdery.ts`, 12 tras routera
- [x] CRUD obu zasobów przez React Query, invalidacja, stan ładowania
- [x] Dialog z builderem warunków (9 typów), `warunki` jako string JSON
- [x] Wysyłane wyłącznie pola z list edytowalnych (potwierdzone testem na zbiorze kluczy)
- [x] Klient znosi 200-pusty-body na `PATCH /api/promotions/{id}`
- [x] Symulator ceny zgodny co do wyniku z silnikiem backendu
- [ ] Kontrola „poniżej kosztu” przed zapisem promocji — obecna, ale liczy niedokładnie (ignoruje aktywne narzuty) i nie ma reaktywnego wariantu z oryginału
- [x] Badge „zaplanowana” naprawiony, nagłówek bez fałszywej obietnicy
- [x] Nota przy datach promocji
- [ ] Kolumna „Promocja” nietknięta ✓, ale backlog i roadmapa NIE sprostowane — punkt niespełniony
- [x] `lint`, `typecheck`, `build`, `test` czyste (potwierdzone uruchomieniem: 261/261 frontend, 603/603 backend kontrolnie)

## Parallel-test concerns

None — wszystkie nowe testy używają MSW (mock server) i `render()` z Testing Library, bez wspólnej bazy, portów ani plików tymczasowych ze stałą ścieżką. Bezpieczne do równoległego uruchamiania.

## Overall assessment

Warstwa portu tabel, buildera warunków i silnika cen jest bardzo staranna — formuła cenowa zgadza się liniowo z backendem, testy mają te same liczby po obu stronach, a D5/D7/D4 są dobrze udokumentowane i zaimplementowane. Największym problemem jest **cichy reset `priorytet` na 50 przy każdej edycji** — to realny logic bug mogący zmienić wynik doboru reguły bez wiedzy użytkownika, niezłapany przez testy bo fixture akurat ma `priorytet: 50`. Drugi poważny problem to brak aktualizacji roadmapy/backlogu, mimo wyraźnych zobowiązań w `plan.md` i punktu w DoD — to bezpośrednio łamie stałą zasadę projektu z `CLAUDE.md`. Kontrola „poniżej kosztu” działa, ale liczy z pominięciem aktywnych narzutów, co obniża jej wiarygodność w duchu D8. Po naprawieniu tych trzech rzeczy branch wygląda na gotowy do scalenia.
