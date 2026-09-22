# 102-DOCS-przeglad-widokow-aktualizacja — Code review

> Reviewed: 2026-09-22
> Branch: docs/102-przeglad-widokow-aktualizacja
> Diff: 4 pliki, 2 commity

## BLOCKER

- [ ] `docs/przeglad-12-widokow.md:300` — przycisk przy dostawcy z adresem URL nazwany „Synchronizuj teraz", a kod ma etykietę „Synchronizuj" (bez „teraz").
  - Reason: `rebuild/frontend/src/pages/konfiguracja/Dostawcy.tsx:308-314` ma wprost komentarz „„Synchronizuj", nie „Synchronizuj teraz" — etykieta zweryfikowana w ŻYWYM bundlu produkcji", a renderowany tekst to `synchronizacja.isPending ? "Synchronizuję…" : "Synchronizuj"`. Ania szukająca przycisku „Synchronizuj teraz" go nie znajdzie — narusza kryterium 1 (etykiety przycisków dosłownie zgodne z kodem). Ten fakt jest już udokumentowany w kodzie (najwyraźniej po wcześniejszej korekcie tej samej pomyłki w innym miejscu), więc przegląd PR.6 powinien był go złapać — `raport.md` deklaruje weryfikację etykiet grep'em tylko dla `Alerty, Waga, Analityka, Selly, Historia, Pulpit, Archiwum`, z pominięciem `Konfiguracja`, mimo że ta sekcja dostała w tym samym ticketcie nową strukturę zakładek (8 zamiast dotychczasowych).
  - Suggestion: zmienić linię 300 na „„Synchronizuj" przy dostawcy z adresem URL uruchamia pobranie." i przy okazji zweryfikować grep'em resztę etykiet w sekcji 11 (Konfiguracja), bo akurat ta sekcja nie była objęta deklarowaną weryfikacją.

## SHOULD-FIX

Brak.

## NICE-TO-HAVE

- [ ] `docs/tickets/102-DOCS-przeglad-widokow-aktualizacja/plan.md:50-53` — sekcja „Definition of done" ma wszystkie punkty odznaczone `[ ]`, mimo że `raport.md` i `karta.md` opisują ticket jako w pełni dowieziony (stan ✅ 2026-09-22). Inne niedawno zamknięte karty (np. 97, 101) odznaczają DoD jako `[x]` w `plan.md`. Czysto kosmetyczne — treściowo wszystkie punkty są spełnione (patrz „Plan compliance" niżej).

## Plan compliance

### Done ✓
- Nagłówek: tytuł „Przegląd widoków", data aktualizacji 2026-09-22, „13 ekranów" (linie 1-2, 32).
- Sekcje 0–9 zaktualizowane zgodnie z wejściami i przeglądem całości (kafel „Ostatni eksport CSV", ALLIANCE w filtrze marek, wyszarzona „Historia" w Akcje, promocja po terminie zostaje na liście, atrybuty bez „X→X" i ze śladem w Historii, Alerty — trzy stany/filtr/szukajka/polskie znaki, Waga — serwer + potwierdzenia + kalkulator paletowy, Analityka — cztery kafle/zakładki/limit 1000/CSV=tabela, Historia — bez limitu 5000, filtr „Edycje").
- Nowa sekcja „10. Archiwum importów" wstawiona zaraz po Historii, zgodnie z rzeczywistym miejscem w sidebarze (`components/nawigacja.ts:50-54`); treść (przycisk Odśwież, 3 filtry, pasek zajętości, 8 kolumn tabeli, „Pobierz" pod oryginalną nazwą) zweryfikowana z `ArchiwumImportow.tsx` i `archiwum-importow/*`.
- Przenumerowanie 11 (Konfiguracja, 8 zakładek z „Wgrywaniem ręcznym" jako osobną zakładką), 12 (Selly, bez zakładek, pięć kart, dwa kroki „Wygeneruj CSV teraz"), 13 (Moje konto).
- Sekcje zbiorcze: usunięte nieaktualne punkty („wygasłe promocje nadal obniżają ceny", „karty Dostępności puste"), dopisane pozycje 8–12 zgodne ze stanem kodu.
- `docs/karty/PR.6/karta.md` — stan ✅, decyzje D1/D2, „Dowiezione", „Do koordynatora" z zamknięciem przeglądu, nieaktualnością pytania 12.6 i wymaganiem stagingu — linia `tools/deploy-staging.sh:120` rzeczywiście uruchamia `npm run migrate`, zgodnie z treścią karty.
- Zero nazw plików / tras API / numerów ticketów / kodów kart w treści dla Ani (`docs/przeglad-12-widokow.md`) — potwierdzone grep'em.
- Roadmapa, `docs/pytania-do-ani-2026-09-18.md`, `rebuild/`, `contract/` nietknięte.

### Missing or deviating ✗
Brak — poza opisanym wyżej BLOCKEREM (etykieta „Synchronizuj teraz"), wszystkie elementy planu i wszystkie sześć wejść (77, 91, 92, 93, 97, 101) są uwzględnione w treści.

### Definition of done
- [x] Dokument opisuje stan develop, z sekcją Archiwum i numeracją 0–13.
- [x] Wszystkie wejścia PR.6 uwzględnione.
- [x] Sekcje zbiorcze bez rzeczy naprawionych.
- [x] Karta PR.6 oznaczona jako zrobiona.

(Checkboxy w `plan.md` pozostały nieodznaczone — patrz NICE-TO-HAVE.)

## Parallel-test concerns

Nie dotyczy — ticket DOCS bez testów automatycznych.

## Overall assessment

Bardzo solidna aktualizacja: prawie każde zdanie dodane lub zmienione w tej rundzie (kafle Analityki, Alerty, Waga, Archiwum, Selly, ALLIANCE, numeracja 0–13) zweryfikowałem osobno z kodem `develop` i zgadza się co do słowa, łącznie z dosłownymi etykietami przycisków, tekstami błędów i strukturą zakładek. Jedyny realny problem to etykieta „Synchronizuj teraz" w sekcji 11 — pojedyncza linia, którą deklarowana weryfikacja grep'em ominęła, bo nie objęła Konfiguracji mimo że ta sekcja też dostała nową treść. Po poprawieniu tej jednej linii dokument jest gotowy do wysłania Ani.
