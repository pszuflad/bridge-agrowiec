# I15.9 — delta instrukcji dla Ani — całe I15

> **Stan:** ⬜ po I15.1–I15.8 i I15.10–I15.11 (faza 6 — OSTATNIA karta I15)
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** — · **Zależy od:** I15.1–I15.8, I15.10, I15.11
> **Ticket:** —

Założona przez koordynatora ticketem `104-DOCS-plan-i15`, 2026-09-22. Plan całej iteracji: `docs/rebuild-roadmap.md`, blok „Iteracja 15”.

## Zakres
Nowy `docs/instrukcja-testow-I15.md` w formacie delty (wzorce: I7-v2, I10-v2). To są zmiany, które Ania SAMA
wdrożyła na produkcji — układ „Wdrożyłaś → Jest teraz w nowym Bridge → Sprawdź”, bez „zgłosiłaś”. Obejmuje:
blokowane formy płatności (katalog + CSV), listę zastosowań i kategorie, MO9 (quady/kosiarki, stany z hurtowni —
test API na stagingu z hasłami `AGRORAMI_*`), szerokość bez zer (**sprostowanie** obietnicy z I3 §11 pkt 10), Staging v2
(„Rozstrzygnij”, blokada błędnego EAN — **sprostowanie** zachowania z I3-v2/14i: EAN naukowy nie jest już pusty),
Selly REST (nocna synchronizacja 4:30, trasy bez przycisków). Wejścia od kart: `wejscie-*.md` w tym katalogu. Obejmuje też zmiany z kart I15.10/I15.11 (zmiany Ani w toku).
**Forma: polecenie Ani z 2026-09-22 — krótko: co zmieniono → polecenie → rezultat** (`wejscie-104b.md`).
⚠ Warunek testowalności: staging z kodem I15 i **odświeżoną bazą z kopii produkcji** (D2), inaczej zgłoszenia ze
starego importu będą nieakceptowalne (I15.4).

## Pliki (wyłączna własność)
`docs/instrukcja-testow-I15.md` (nowy), notki w starszych instrukcjach wg decyzji użytkownika, ta karta.

## Decyzje
**Decyzje użytkownika 2026-09-22 (całe I15, zgodnie z rekomendacją):** D1 triggery jako migracja odporna na
istniejące obiekty · D2 poprawki danych z września bez migracji (odświeżenie stagingu kopią produkcji) · D3 Staging v2
przenosimy · D4 błędny EAN = błąd blokujący akceptację (wersja Ani zastępuje 14i) · D5 skrypt reconcile nie przenosimy.
**Produkcja zamrożona od 2026-09-22** — źródło prawdy to `origin/main` na commicie `7d6cfc9`; nowy kod na `main` = zgłoś.

—

## Dowiezione
—

## Do koordynatora
—
