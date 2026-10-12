# 237-FEATURE-partnerzy-konfiguracja-startowa — Code review

> Reviewed: 2026-10-12
> Branch: claude/peaceful-gates-a8yebr
> Diff: 6 plików (+187), 1 commit (305599d)

## BLOCKER

Brak. Blokada publikacji przy narzucie 0 % działa (`rebuild/backend/src/partnerzy/selekcja.ts:153-160`: `!(k.narzutProc > 0)` → cena `null`, nic nie jest publikowane), a krok tylko uzupełnia puste pola. Scheduler jest domyślnie wyłączony (`PARTNERZY_SCHEDULER`), a `harmonogram_minuty` jest `null`, więc aktywacja nie uruchamia generowania.

## SHOULD-FIX

- [ ] `rebuild/backend/src/partnerzy/konfiguracja-startowa.ts:15,60` — stała „przesyłka 15 EUR" jest doliczana do KAŻDEJ ceny pozycji, a nie raz na przesyłkę. Formuła domyślna to `zakup*(1+narzut)/kurs + przesylka_eur + koszty_dodatkowe` (`kalkulator.ts:16`), czyli +15 EUR na oponę.
  - Reason: odp. 12 w `wejscie-odpowiedzi-2026-10-12.md:16` mówi „Paliwo/myto/pakowanie ~15 EUR per dostawca (do doprecyzowania)". Nie ma tam mowy o kwocie doliczanej do ceny sztuki. Gdy użytkowniczka ustawi narzut i nie zauważy tego pola, opublikuje zawyżone ceny (opona za ~1000 PLN dostaje +15 EUR, czyli kilka %). Nie ma sprawdzenia, że to zamierzone.
  - Suggestion: nie ustawiaj `przesylkaStalaEur` (zostaw `null`/0) do czasu doprecyzowania albo wyraźnie ostrzeż w opisie PR i w wpisie spec, że kwota wchodzi do ceny każdej pozycji. Obecny opis kroku mówi tylko „przesyłką 15 EUR".
- [ ] `rebuild/backend/src/partnerzy/konfiguracja-startowa.ts:75-78` — aktywacja jest bezwarunkowa (`if (!p.aktywny)`). Krok nie odróżnia „nieaktywny, bo założony przez krok 2026-10-10" od „świadomie wyłączony lub niedokończony przez użytkowniczkę w panelu".
  - Reason: jeśli użytkowniczka zdążyła już ustawić narzuty (>0) dla części krajów, a partnera zostawiła nieaktywnego, aktywacja plus `harmonogram_minuty` (jeśli ustawiony) i `PARTNERZY_SCHEDULER=true` na produkcji opublikują częściową konfigurację. Odp. 22 wymaga aktywności „od początku", ale blokada narzutu chroni tylko kraje z 0 %.
  - Suggestion: aktywuj tylko wtedy, gdy krok sam coś uzupełnił, albo gdy żaden kraj nie ma `narzut_proc > 0`. Albo zapisz decyzję „aktywacja bezwarunkowa" w planie.
- [ ] `rebuild/backend/src/partnerzy/konfiguracja-startowa.ts:55,62` — gdy w katalogu nie ma aktywnych produktów z magazynem (`magazyny.length === 0`), magazyny są pomijane po cichu, partner jest mimo to aktywowany, a krok zapisuje się jako wykonany i nigdy nie ruszy ponownie. Na produkcji mało prawdopodobne, ale na kopii z pustym katalogiem daje aktywnego partnera bez magazynów.
  - Suggestion: przy pustej liście zwróć `{ odloz: ... }` (wzór `2026-10-09-reset-hasla-arkadiusz`) albo nie aktywuj.
- [ ] `rebuild/backend/src/partnerzy/konfiguracja-startowa.ts:55` — lista magazynów to migawka z dnia wdrożenia (`dostepneMagazyny` bierze tylko `status='aktywny'`). Magazyn, który chwilowo nie ma aktywnych pozycji, wypada na stałe. Spec to odnotowuje („nowe dodaje się w panelu"). Odp. 15 mówi „wszystkie oprócz MO6/7/8", więc docelowo to powinna być reguła, nie lista. Do decyzji, czy to akceptowalne.
- [ ] `docs/tickets/237-…/raport.md:2` — raport nie zawiera wyników testów („patrz CI w PR"). Wg reguł review brak wyniku bramek jest do uzupełnienia. W tym review testów nie uruchamiano.
- [ ] `rebuild/backend/test/partnerzy.konfiguracja-startowa.test.ts` — luki w testach.
  - Brak scenariusza „partner istnieje z częściową konfiguracją użytkowniczki" (np. własne kolumny, nazwa pliku, nieaktywny z narzutem > 0). Test „nie nadpisuje" podmienia dane dopiero PO kroku, więc nie dowodzi, że krok szanuje wcześniejsze ustawienia.
  - Brak testu pustego katalogu, brak testu generowania TyreWorld (układ „wszystkie kraje w jednym pliku", cena `null` w kolumnach krajów bez narzutu).
  - Brak asercji, jak `przesylkaStalaEur=15` wpływa na cenę po ustawieniu narzutu (patrz pierwszy punkt).
  - Linia `db.delete(partnerMagazyny).where(undefined as never)` to obejście typów. Lepiej `db.delete(partnerMagazyny).run()`.

## NICE-TO-HAVE

- [ ] `konfiguracja-startowa.ts:10-11` — uzupełnianie jest „per sekcja, tylko gdy puste". Częściowo usunięte kolumny (np. użytkowniczka skasowała jedną) nie są odtwarzane, co jest właściwe. Warto to dopisać do wpisu spec, bo „kolumny: wszystko albo nic" nie jest oczywiste.
- [ ] `konfiguracja-startowa.ts:34` — kolumna `PriceEurNet` Adtyres ma `zrodlo` = pierwszy kraj z listy (AT). Działa dzięki podmianie kraju w `generator.ts:150-152`, ale jest mylące w panelu. Komentarz w szablonie by pomógł.
- [ ] Brak `MfrCode` w TyreWorld jest jawnie opisany (dobrze). Warto założyć wpis w `docs/rebuild-backlog/wpis-237.md`, żeby decyzja nie zginęła.
- [ ] Krok tworzy partnera, jeśli brakuje go w bazie (`dodajPartnera`), mimo że krok 2026-10-10 już to robi. Jest to bezpieczne (idempotentne), ale duplikuje odpowiedzialność.

## Plan compliance

### Done ✓
- Krok `2026-10-12-partnerzy-konfiguracja-startowa` dopisany na końcu `KROKI_WDROZENIA`, `deploy-produkcja.sh` nietknięty.
- Logika w `partnerzy/konfiguracja-startowa.ts`; uzupełnia tylko puste (nazwa pliku, magazyny, kraje, kolumny); aktywacja obu partnerów.
- Magazyny bez MO6/MO7/MO8, kraje wg listy (Adtyres 13, TyreWorld 6), narzut 0 %.
- Test przez `uruchomKroki` (wzór `kroki.runner.test.ts`), testy na tmp-bazie (równoległe bezpiecznie).
- Wpis `docs/spec-backend/wpis-237.md` jako osobny plik. Kontrakt API/Selly/cenniki dostawców nietknięte.

### Missing or deviating ✗
- Plan mówi „przesyłka stała 15 EUR" jako przyjętą wartość, ale nie opisuje, że wchodzi do ceny każdej pozycji (patrz SHOULD-FIX nr 1).
- Raport bez wyników bramek.

### Definition of done
- [x] Krok w rejestrze, idempotentny przez zasadę „tylko puste" (wyjątek w trakcie nie zapisuje kroku, ponowny bieg dokończy resztę).
- [x] Brak publikacji cen przy narzucie 0 % (test + `selekcja.ts`).
- [ ] Wyniki bramek w raporcie — brak.
- [ ] Bezpieczna aktywacja wobec wcześniejszych ustawień użytkowniczki — bezwarunkowa.

## Parallel-test concerns

None — wszystkie testy parallelizable (katalog tymczasowy per test, brak portów i stałych ścieżek).

## Overall assessment

Zmiana jest zwarta i ostrożna. Wzorzec „uzupełnij puste" jest dobry, a blokada narzutu 0 % realnie chroni przed publikacją cen zakupu. Główne ryzyko to nie technika, tylko wartość biznesowa: stałe +15 EUR doliczane do ceny każdej opony, przyjęte mimo „do doprecyzowania". Drugie to bezwarunkowa aktywacja bez sprawdzenia dotychczasowych ustawień. Obie rzeczy warto rozstrzygnąć przed merge'em do `main`.
