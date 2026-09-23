# 151-DOCS-instrukcja-testow-i15 — Code review

> Reviewed: 2026-09-24
> Branch: `docs/151-instrukcja-testow-i15`
> Diff: 3 pliki (`docs/instrukcja-testow-I15.md` nowy, `docs/tickets/151-.../plan.md` nowy, `docs/triage-state.txt` zmieniony), 1 commit

## BLOCKER

- [ ] `docs/instrukcja-testow-I15.md:71` — przykład treści kolumny „Blokowane formy płatności" jest zmyślony.
  - Reason: dokument mówi „kolumna pokazuje listę zablokowanych form, np. «Płatność odroczona, Kredyt
    kupiecki»". W kodzie (`rebuild/frontend/src/pages/katalog/formatowanie.tsx:47-70,257-260`, 1:1 z
    oryginałem `rebuild/backend/src/import/legacy/payment_blocks.cjs:7-16`) kolumna wypisuje **surową listę
    numerycznych ID form płatności Selly**, np. dla MO1 dosłownie `"203, 204, 205, 206, 207, 208, 209, 210,
    211, 212, 213, 214, 215, 216, 217, 218, 219"` — nigdzie w repo (backend, frontend, `contract/`, karty
    ticketu 122) nie ma mapowania tych ID na nazwy typu „Płatność odroczona" czy „Kredyt kupiecki". Fraza
    pochodzi wyłącznie z `docs/karty/I15.9/wejscie-122.md` i została przepisana bez weryfikacji w kodzie
    (dokładnie ten typ błędu, przed którym ostrzega `plan.md`: „każdy fakt w dokumencie ma oparcie w pliku,
    nie w pamięci"). Ania, klikając krok 2, zobaczy ciąg liczb, a nie nazwy form płatności — może to zgłosić
    jako błąd (bo dokument obiecał czytelny tekst), albo zwątpić w resztę dokumentu.
  - Suggestion: zamienić przykład na rzeczywistą wartość (np. `"203, 204, 205, ..., 219"` dla MO1) albo
    opisać ogólnie „ciąg numerów identyfikatorów form płatności, oddzielonych przecinkami — to jest to samo,
    co dziś pokazuje produkcja".

## SHOULD-FIX

- [ ] `docs/instrukcja-testow-I15.md:409-421` — licznik w podsumowaniu nie zgadza się z liczbą wierszy tabeli.
  - Reason: tabela ma 11 wierszy (1.1–1.8, 2.1, 2.2, 3), a stopka mówi „Sprawdzonych ____ / 10". Wiersz „3"
    (sprostowania) nie jest wliczony do dziesiątki, ale wygląda identycznie jak pozostałe wiersze z checkboxami
    OK/ŹLE, więc Ania może dodać go do licznika i się nie zgodzi z „/10".
  - Suggestion: dopisać przy wierszu „3" adnotację „nie liczy się do dziesiątki" albo zmienić licznik na „/11".
- [ ] `docs/instrukcja-testow-I15.md:283,418` — punkt 1.8 ma inny format oceny niż reszta.
  - Reason: sama sekcja 1.8 kończy się „Twoja ocena: ☐ przeczytane" (bo na stagingu nic nie da się kliknąć),
    ale wiersz 1.8 w tabeli podsumowania (rozdz. 5) ma zwykłe kolumny OK/ŹLE — niespójność formy, która może
    zdezorientować przy wypełnianiu zbiorczej tabelki.
  - Suggestion: ujednolicić — albo tabela dostaje trzecią kolumnę „przeczytane" dla 1.8, albo się to jasno
    opisze w nagłówku tabeli.
- [ ] Odsyłacze do `instrukcja-testu-sciezki-krytycznej.md`, `instrukcja-pelnego-testu.md`,
  `instrukcja-pracy-dla-ani.md` (linie 20-21, 84, 137, 192, 270, 429) wskazują na pliki, które **jeszcze nie
  istnieją** w repo (powstają równolegle w tickecie 150/149/153). To świadoma decyzja D2 z `plan.md`, więc nie
  jest to błąd tego ticketu — ale warto, żeby koordynator upewnił się, że te trzy dokumenty trafią do `develop`
  zanim ktokolwiek wyśle tę kartkę Ani, inaczej linki będą martwe.

## NICE-TO-HAVE

- [ ] `docs/instrukcja-testow-I15.md:126` — „Wiersz MO9 (Agrorami)" używa pisowni „Agrorami" (bez łącznika),
  podczas gdy `docs/cutover.md` i część kart konsekwentnie piszą „Agro-Rami". Nazwa faktycznie widoczna w
  panelu pochodzi z kolumny `suppliers.nazwa` w bazie i nie jest zaszyta w kodzie frontu, więc nie da się tego
  100% zweryfikować statycznie — ale warto ujednolicić pisownię w dokumentacji.
- [ ] Dokument jest dość długi (442 linie) jak na „krótko, bez ściany tekstu" z polecenia Ani
  (`wejscie-104b.md`). Struktura per punkt jest zwarta, ale liczne ramki ⚠ z wyjaśnieniami mechanizmu (np.
  1.6, 1.8, 2.1) miejscami zbliżają się do uzasadnień technicznych, których polecenie Ani prosiło unikać.
  Prawdopodobnie uzasadnione (zapobiega fałszywym zgłoszeniom „błędu"), ale warto to mieć na uwadze przy
  kolejnych deltach.

## Plan compliance

### Done ✓
- Nowy `docs/instrukcja-testow-I15.md` w układzie „co zmieniliśmy → polecenie → rezultat" (D6).
- Wszystkie tematy z karty I15.9 (11 wejść) i kart I15.10/I15.10b/I15.11 pokryte: blokowane formy płatności
  (1.1), zastosowania/kategorie (1.2), MO9 (1.3), szerokość bez zer — sprostowanie (1.4), Staging v2/EAN —
  sprostowanie (1.5), „Braki w cenniku" (1.6), import zatrzymujący się na błędach odczytu (1.7), Selly REST
  (1.8), pełne pliki CSV z Analityki — sprostowanie (2.1), kolejka atrybutów -526 (2.2).
- Trzy sprostowania (D4/D7) poprawnie zaadresowane i zweryfikowane niezależnie: cytat „I3 §11 pkt 10" faktycznie
  nie istnieje (I3 i I3-v2 mają sekcje 1–8), prawdziwe miejsce to `instrukcja-testow-I3.md` §4 pkt 3, wiersze
  355-358 — treść zgadza się słowo w słowo z dokumentem. EAN naukowy (I3-v2 pkt 4.3) i pliki CSV Analityki
  (I10-v2 pkt 1.3) też poprawnie zacytowane.
- D8 (przycisk „Synchronizuj", nie „Synchronizuj teraz") potwierdzony w `Dostawcy.tsx:309-314` i w
  `instrukcja-testow-I3-v2.md:374-389`.
- D9 (brak filtra „Zastosowanie", filtruje się przez „Kategoria") potwierdzony w `filtrowanie.ts` — kryteria
  mają tylko `kategorie`, `zastosowanie` nie ma w `POLA_SZUKAJKI`.
- Ścieżka krytyczna nie jest powielona (D5) — przy MO9, Staging v2 i CSV zostaje „jest teraz tak" + odesłanie,
  bez pełnych scenariuszy.
- Karta `docs/karty/I15.9/karta.md` i `docs/triage-state.txt` zaktualizowane zgodnie z planem.
- Zweryfikowałem wyrywkowo prawie każdą etykietę z tabeli „Weryfikacja etykiet interfejsu" w raporcie
  (nawigacja, zakładki Konfiguracji, filtr „Typ sprawy" + odznaki, kolumny domyślne, filtr „Kategoria",
  kolejka „Do akceptacji", przyciski Selly, komunikat blokady EAN, reguły zastosowań, generator CSV, migracje)
  — wszystkie się zgadzają z kodem, łącznie z numerami linii.
- Liczby (265 rekordów Ładowarka→Ciągnik, 172 zmiany szerokości, 1114/991/123 dla MO9, 5109/5184/1716/1644/1100
  dla CSV Analityki) mają pokrycie w `docs/rebuild-backlog.md` i kartach — nic zmyślonego poza pozycją z
  BLOCKER.

### Missing or deviating ✗
- Brak — zakres z karty I15.9 (11 wejść) pokryty w całości, nic nie wypadło.

### Definition of done
- [x] `docs/instrukcja-testow-I15.md` pokrywa cały zakres z karty I15.9 i decyzji D1
- [x] Każdy punkt w układzie „co zmieniliśmy → polecenie → rezultat", bez ściany tekstu (poza drobną uwagą
      NICE-TO-HAVE o długości)
- [x] Trzy sprostowania wyraźnie oznaczone i zebrane w tabeli
- [x] Rozbieżności z logiką biznesową w osobnej sekcji „Do Twojej decyzji"
- [x] Tematy wspólne ze ścieżką krytyczną odesłane, nie przepisane
- [x] Karta I15.9 opisuje STAN, nie zamiar; `triage-state.txt` zaktualizowany
- [ ] Gałąź zsynchronizowana z `origin/develop`, PR `MERGEABLE` — nie sprawdzałem (poza zakresem code review;
      do weryfikacji przy pushu)

## Parallel-test concerns

Brak testów automatycznych — ticket jest czysto dokumentacyjny, nie dotyczy suite'ów Vitest ani zasobów
współdzielonych.

## Overall assessment

Rzemiosło weryfikacyjne w tym tickecie jest bardzo solidne — niemal każdy fakt (nazwy ekranów, zakładek,
filtrów, kolumn, komunikatów, godzin harmonogramu, liczby z charakteryzacji) ma dokładne pokrycie w kodzie i
kartach, łącznie z numerami linii. Jeden istotny wyjątek psuje ten obraz: przykład treści kolumny „Blokowane
formy płatności" w punkcie 1.1 jest zmyślony i wprowadzi Anię w błąd przy pierwszym, najważniejszym (⭐) punkcie
dokumentu — to trzeba poprawić przed wysłaniem. Reszta uwag to drobne niespójności formy (licznik w
podsumowaniu, format oceny 1.8) i informacja o zależności od równoległych ticketów z linkami do jeszcze
nieistniejących dokumentów — żadna z nich nie blokuje merge'a samego dokumentu, ale BLOCKER musi być
naprawiony.
