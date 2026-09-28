# 16-FEATURE-widok-narzuty-promocje — Code review (runda 2)

> Reviewed: 2026-09-02
> Branch: feature/16-widok-narzuty-promocje
> Diff: 21 plików, 5 commitów (origin/develop...HEAD)

## Runda 1 — jak rozliczona

Runda 1 zgłosiła **2 BLOCKER** i **3 SHOULD-FIX**. Poprawki w `a2cbe44`:

| # | Finding rundy 1 | Status w rundzie 2 |
|---|---|---|
| BLOCKER 1 | `priorytet` zbijany do 50 przy każdym zapisie | **Naprawione i zweryfikowane** — stan `priorytet` inicjowany z edytowanej reguły/promocji, odsyłany bez zmian; test regresyjny z `priorytet: 99` faktycznie łapie regresję (sprawdzone przez odtworzenie starego kodu w głowie względem testu — asercja nietrywialna). |
| BLOCKER 2 | Roadmapa/backlog nie zaktualizowane | **Świadomie odłożone do Fazy 5** (po tym review, wykonuje Master) — zgodnie z poleceniem prowadzącym tę rundę, nie zgłaszam ponownie. |
| SHOULD-FIX 1 | Kontrola „poniżej kosztu" liczona silnikiem zamiast metodą oryginału (`el()` własny matcher, `cenaSprzedazy × (1−rabat)`) | **Naprawione** — `produktyPonizejKosztu` przepisane 1:1 z `:24563-24597`/`:24473-24513`: aktualna `cenaSprzedazy` z katalogu, własny `dopasujDoOstrzezenia` (marka/kategoria/dostawca/produkt po równości, rozmiar/bieżnik przez zawieranie, globalna ⇒ wszystkie), próg „pierwszych 10", format wiersza. Zweryfikowane linia po linii względem oryginału — zgodne. |
| SHOULD-FIX 2 | Brak reaktywnego paska „poniżej kosztu" na żywo | **Naprawione** — pasek liczony tym samym `produktyPonizejKosztu` przy każdej zmianie formularza (`ponizejKosztu` poza `useMutation`), niezależny od dialogu potwierdzenia przy zapisie, dokładnie jak dwa niezależne mechanizmy oryginału. |
| SHOULD-FIX 3 | `Symulator.tsx` odbiega od `UT()` (pola wyszukiwania, limit 50→5, brak delt) | **NIE naprawione, nadal aktualne** — plik nietknięty w `a2cbe44` (potwierdzone `git log` — ostatnia zmiana to commit `c2cd415`, sprzed review). Przenoszę do SHOULD-FIX niżej. |
| NICE-TO-HAVE (3 pozycje) | kolor ikony usuń, dostępność toastu, tekst walidacji | Nietknięte — to były nice-to-have, brak obowiązku poprawy. Przenoszę do NICE-TO-HAVE niżej. |

Dodatkowo `raport.md` opisuje **4 dalsze rozjazdy znalezione przy weryfikacji** (poza zgłoszeniem review): złe domyślne nowej reguły, `zasieg` promocji globalnej, kształt PATCH (6/7 zamiast 8 pól), fallback typu `"marka"`. Wszystkie zweryfikowane liniowo względem `deminified/frontend-index.js` (`:24216-24225`, `:24600-24641`) — **zgodne z oryginałem**.

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `rebuild/frontend/src/pages/narzuty/Symulator.tsx:41-51` — wyszukiwarka symulatora nadal odbiega od `UT()` bez odnotowania jako świadome odstępstwo (przeniesione z rundy 1, nienaprawione).
  - Reason: Oryginał (`:24972-25120`) szuka po `rozmiar`/`marka`/`model`/`nazwa`/`kod`, pokazuje do 50 trafień z notą „Pokazane pierwsze 50" i osobny widok wybranego produktu z przyciskiem „Zmień" oraz deltami kwotowymi na każdym kroku rozbicia ceny. Port szuka wyłącznie po `kod`/`nazwa`, limituje do 5 trafień i nie pokazuje delt. `plan.md` D3/Krok 8 nie precyzuje pól ani limitu — różnica nie jest jawnie zatwierdzonym odstępstwem.
  - Suggestion: dopisać do backlogu/planu jako świadomą decyzję (uzasadnienie: symulator ma wskazać PRODUKT, nie być drugą listą katalogu) albo dociągnąć wyszukiwanie do pól/limitu oryginału.

- [ ] `rebuild/frontend/src/pages/narzuty/DialogReguly.tsx:301-320` — przycisk „Dodaj regułę/promocję" jawnie resetuje CAŁY formularz przy każdym otwarciu; oryginał tego nie robi.
  - Reason: `el()` (`:24177-24226`) inicjalizuje stan formularza WYŁĄCZNIE raz, przy pierwszym montowaniu (`useState`, bez `useEffect`), a trigger „Dodaj regułę" to `DialogTrigger asChild` bez własnego `onClick` — Radix tylko przełącza `open`. Skutek w produkcji: instancja triggera jest zamontowana NA STAŁE (`s.jsx(el, {})` bez warunku), więc po wpisaniu danych i kliknięciu „Anuluj" (albo po udanym zapisie — `c(!1)` w `:24642` też nic nie resetuje) kolejne otwarcie tego samego dialogu pokazuje STARE wartości z poprzedniej próby, nie defaulty. Port jawnie czyści `nazwa`/`warunki`/`globalna`/`wartosc`/`priorytet`/`start`/`koniec` w `onClick` triggera — to poprawia UX, ale jest to nieudokumentowana zmiana zachowania względem 1:1 (nie ma jej w D1–D8 ani w raporcie).
  - Suggestion: jeśli to świadoma poprawka defektu produkcji — dopisać jako D9 do planu i wpis do backlogu; jeśli ma być 1:1 — usunąć reset i pozwolić na „lepkie" pola między otwarciami, tak jak oryginał.

## NICE-TO-HAVE

- [ ] `rebuild/frontend/src/pages/narzuty/DialogReguly.tsx:332-356` — sekcja „Typ reguły" renderuje się zawsze (z zablokowanymi przyciskami przy edycji), a oryginał (`:24346`, `!i &&`) w trybie edycji **w ogóle jej nie pokazuje**. Kosmetyczne, logika zapisu nie zależy od tego.
- [ ] `rebuild/frontend/src/pages/narzuty/DialogReguly.tsx:359` — etykieta pola to stałe „Nazwa"; oryginał (`:24368-24369`) pokazuje dynamicznie „Nazwa reguły (opcjonalnie)" / „Nazwa promocji (opcjonalnie)" — pole i tak jest opcjonalne po obu stronach, różni się tylko tekst.
- [ ] `rebuild/frontend/src/pages/narzuty/TabelaNarzutow.tsx:181` i `TabelaPromocji.tsx:194` — ikona `Trash2` bez `text-red-500` (`:24793`/`:24960` w oryginale mają kolor) — przeniesione z rundy 1, nadal nietknięte.
- [ ] `rebuild/frontend/src/components/ui/toast.tsx:112` — zamykanie toastu kliknięciem na `div` bez odpowiednika klawiaturowego — przeniesione z rundy 1, nadal nietknięte.
- [ ] `rebuild/frontend/src/pages/narzuty/DialogReguly.tsx:274` — treść „Dodaj warunek albo zaznacz regułę globalną." różni się słownie od oryginału („Dodaj co najmniej jeden warunek lub zaznacz regułę globalną.") — przeniesione z rundy 1, nadal nietknięte.

## Plan compliance

### Done ✓
- Wszystkie kroki 1–10 z rundy 1 pozostają zaimplementowane i teraz dokładniejsze:
  - `priorytet` trzymany w stanie i odsyłany 1:1 z `C` (`:24221`, `:24605/24615/24627/24636`).
  - Kontrola „poniżej kosztu" i pasek na żywo liczone WŁASNĄ metodą oryginału (`el()`), nie silnikiem cen — zgodne z D6 i z lekturą `:24473-24513`/`:24563-24597`.
  - Domyślne nowej reguły (`globalna` odznaczona, jeden warunek `kategoria`, wartość 15%/10%, daty prefilled) zgodne z `:24216-24225`.
  - `zasieg` promocji globalnej = `"globalny"` (`:24613`).
  - Kształt PATCH: narzut 6 pól bez `jednostka`/`status` (`Ag()`), promocja 7 pól bez `status` (`Eb()`), POST 8 pól — potwierdzone w `rebuild/backend/src/repos/{markups,promotions}.ts` (listy `POLA_EDYTOWALNE_*` mają dokładnie te same 8 pól).
  - Fallback typu nieglobalnej reguły to `"marka"` (`:24623`).
- Lint/typecheck/build/test uruchomione ponownie w tej rundzie: **275/275 zielone**, lint i typecheck czyste, build przechodzi.

### Missing or deviating ✗
- Krok 8 (Symulator) — wyszukiwarka nadal odbiega od `UT()` bez decyzji użytkownika (SHOULD-FIX, przeniesione z rundy 1).
- Reset formularza na triggerze „Dodaj" — nieudokumentowane odstępstwo od zachowania oryginału (nowy SHOULD-FIX tej rundy).
- Krok 11 (dokumentacja: backlog + roadmapa) — świadomie w Fazie 5, poza zakresem tej rundy.

### Definition of done
- [x] `/narzuty` renderuje dwie zakładki, zniknęło z `placeholdery.ts`, 12 tras routera
- [x] CRUD obu zasobów przez React Query, invalidacja, stan ładowania
- [x] Dialog z builderem warunków (9 typów), `warunki` jako string JSON
- [x] Wysyłane wyłącznie pola z list edytowalnych (potwierdzone testem na zbiorze kluczy, teraz osobno dla POST i PATCH)
- [x] Klient znosi 200-pusty-body na `PATCH /api/promotions/{id}`
- [x] Symulator ceny zgodny co do wyniku z silnikiem backendu (wynik owszem, ale UI wyszukiwarki się różni — SHOULD-FIX)
- [x] Kontrola „poniżej kosztu" przed zapisem promocji — teraz liczona metodą oryginału, z odpowiednikiem reaktywnym
- [x] Badge „zaplanowana" naprawiony, nagłówek bez fałszywej obietnicy
- [x] Nota przy datach promocji
- [ ] Kolumna „Promocja" nietknięta ✓, backlog/roadmapa — świadomie odłożone do Fazy 5 (poza tą rundą)
- [x] `lint`, `typecheck`, `build`, `test` czyste (zweryfikowane ponownie w tej rundzie: 275/275 testów, build OK)

## Parallel-test concerns

None — wszystkie testy nadal używają MSW i `render()` z Testing Library, bez wspólnej bazy, portów ani plików tymczasowych ze stałą ścieżką. Bezpieczne do równoległego uruchamiania.

## Overall assessment

Obie prawdziwe blokery z rundy 1 są naprawione poprawnie i zweryfikowane liniowo względem zdeminifikowanego oryginału — `priorytet` przeżywa edycję, a kontrola „poniżej kosztu" (obie odmiany: pasek na żywo i dialog przy zapisie) liczy dokładnie tak, jak `el()` w produkcji, łącznie z własnym, odrębnym od silnika cen dopasowaniem. Dodatkowe cztery rozjazdy znalezione przez wykonawcę przy weryfikacji (domyślne formularza, `zasieg` globalnej, kształt PATCH, fallback typu) też się zgadzają z oryginałem po sprawdzeniu. Zostają dwa SHOULD-FIX: jeden przeniesiony z rundy 1 i wciąż nietknięty (wyszukiwarka symulatora), drugi nowy — świadome (acz nieudokumentowane) odstępstwo w resetowaniu formularza „Dodaj", warte decyzji użytkownika, czy to akceptowana poprawka defektu produkcji, czy coś do cofnięcia. Żaden z nich nie blokuje scalenia; branch jest w dobrym stanie do merge po ewentualnym wpisaniu tych dwóch odstępstw do planu/backlogu.
