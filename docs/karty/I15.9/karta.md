# I15.9 — delta instrukcji dla Ani — całe I15

> **Stan:** ✅ 2026-09-24 · 151-DOCS-instrukcja-testow-i15
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** — · **Zależy od:** I15.1–I15.8, I15.10, I15.11
> **Ticket:** `151-DOCS-instrukcja-testow-i15`

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
**Produkcja zamrożona od 2026-09-22** — zakres I15 domknięty na `88fa31c` (nie `7d6cfc9`, sprostowane
`wejscie-148.md`); triaż tego ticketu potwierdził, że 5 commitów `88fa31c..5bd4a7b` to wyłącznie
regeneracja `sellycsv-*.csv`, zero kodu — marker w `docs/triage-state.txt` stoi teraz na `5bd4a7b`.
Nowy kod na `main` poza tym = zgłoś.

—

## Dowiezione

`docs/instrukcja-testow-I15.md` — delta dla Ani, całe I15, w układzie „co zmieniliśmy →
polecenie → rezultat" (`wejscie-104b.md`). 11 punktów do sprawdzenia: rozdział 1 (1.1–1.8 —
blokowane formy płatności, zastosowania/kategorie, MO9, szerokość bez zer, Staging v2/EAN,
„Braki w cenniku", import zatrzymujący się na błędach odczytu, Selly REST), rozdział 2
(2.1–2.2 — pełne pliki CSV z Analityki, kolejka atrybutów -526), rozdział 3 (tabela 3
sprostowań), rozdział 4 (6 rozbieżności „Do Twojej decyzji"). Przy okazji: triaż produkcji
`88fa31c..origin/main` (5 commitów, same dane CSV, zero kodu) i przesunięcie markera w
`docs/triage-state.txt` na `5bd4a7b`.

Odstępstwa od pierwotnego założenia karty:
- Pierwotny plan mówił „przycisków synchronizacji Selly w panelu NIE MA" — nieprawda,
  ekran Selly ma przyciski ręcznej wysyłki JEDNEGO dostawcy (`sync-supplier`,
  `generate-csv`), różne od torów harmonogramu; punkt 1.8 rozdziela oba fakty.
- Recenzja złapała BLOCKER: punkt o „Blokowanych formach płatności" miał zmyślony przykład
  treści kolumny (nazwy form) przepisany bez weryfikacji z `wejscie-122.md` — poprawione na
  realny przykład (numeryczne ID), patrz „Do koordynatora" niżej.
- Warunki środowiskowe (D3) oparte na stanie z 24.09 podanym przez użytkownika, nie na
  `wejscie-113.md` (23.09) — scheduler importu na stagingu jest włączony, nie wyłączony;
  potwierdzone niezależnie przez `docs/karty/TEST.2/wejscie-153.md` pkt 4.

## Do koordynatora

1. **`docs/karty/I15.9/wejscie-122.md` ma nieprawdziwy przykład treści kolumny „Blokowane formy
   płatności"** — „np. «Płatność odroczona, Kredyt kupiecki»". Realnie kolumna pokazuje NUMERY
   identyfikatorów Selly (dla MO1: `203, 204, 205, … 219`), a mapy numer→nazwa nie ma nigdzie
   w repo (`grep` po „odroczon"/„kupieck" — zero trafień). Dowód:
   `rebuild/backend/src/import/legacy/payment_blocks.cjs:7-18`,
   `rebuild/frontend/src/pages/katalog/formatowanie.tsx:52-70` (kopia listy) i `:257-260`
   (render surowej listy). Błąd wszedł do dokumentu dla Ani i został złapany dopiero recenzją
   tego ticketu — warto poprawić `wejscie-122.md`, żeby kolejny czytelnik go nie powielił.
2. **Odwołanie „I3 §11 pkt 10" nie istnieje.** `docs/instrukcja-testow-I3.md` ma sekcje 1–8,
   `instrukcja-testow-I3-v2.md` też — żaden nie ma §11. Prawdziwe miejsce obietnicy o
   szerokości to `docs/instrukcja-testow-I3.md` **§4 („Rzeczy, które WYGLĄDAJĄ na błąd") punkt 3**,
   wiersze 355–358. Błędny cytat siedzi w `docs/rebuild-backlog.md:3879` (wpis #83) i został
   powielony do `docs/karty/I15.9/wejscie-120.md` — oba cudze, nie poprawiam ich tutaj.
3. **`docs/karty/I15.9/wejscie-113.md` jest nieaktualne** w punkcie „na stagingu scheduler
   importu jest wyłączony" — od 24.09 jest włączony (potwierdzone niezależnie przez ticket 153,
   `docs/karty/TEST.2/wejscie-153.md` pkt 4, oraz docelową tabelą w `docs/cutover.md` §3a).
