# 79-DOCS-instrukcja-testow-i7-v2 — Code review

> Reviewed: 2026-09-21
> Branch: `docs/79-instrukcja-testow-i7-v2`
> Diff: 6 plików (`docs/instrukcja-testow-I7-v2.md` nowy, `docs/instrukcja-testow-I7.md`,
> `docs/rebuild-backlog.md`, `docs/rebuild-roadmap.md`, `docs/tickets/79-*/plan.md`,
> `docs/tickets/79-*/raport.md`), 6 commitów

## BLOCKER

Brak. Zweryfikowałem w kodzie na tej gałęzi każde twierdzenie o zachowaniu aplikacji, jakie
znalazłem w `docs/instrukcja-testow-I7-v2.md` (treść ostrzeżeń, komunikaty toast, wygląd wpisu
w Historii, filtr Typ/Rodzaj, wyszukiwarkę, przycisk „Akceptuj zaznaczone (N)”, zakładkę
„Dziennik”, sprzątanie kolejki na starcie i po skanie) oraz kluczowe liczby na
`db/snapshot.db` (read-only) — wszystko się zgadza co do słowa i co do liczby. Szczegóły
w sekcji „Plan compliance” niżej.

## SHOULD-FIX

- [ ] `docs/instrukcja-testow-I7-v2.md:349-368` (tabela 3.1) — brak wiersza dla własnego zdania
  §1 pierwszej wersji („**„Wyczyść pending" to schowanie, nie odrzucenie** — wartości wrócą przy
  następnym imporcie”, `docs/instrukcja-testow-I7.md:55`). Tabela unieważnia identyczną obietnicę
  cytowaną z §2 (`:68-70`), ale nie tę z §1, choć dla dzisiejszych 61 pozycji obie są dziś
  praktycznie nieprawdziwe (punkt 2.2 tej samej delty).
  - Reason: to jest dokładnie przypadek z instrukcji reviewu — zdanie z pierwszej wersji, które
    przestało być prawdą, a rozdział 3 go nie wymienia. Ryzyko dla Ani jest niskie (ramka ostrzegawcza
    na górze kartki i już praktycznie o tym mówi), więc nie blokuje, ale kompletność tabeli warto
    domknąć.
  - Suggestion: dopisać do tabeli 3.1 wiersz „§1 Sedno do sprawdzenia, pkt 3” analogiczny do
    istniejącego wiersza „§2 Skąd się bierze kolejka”.

## NICE-TO-HAVE

- [ ] `docs/instrukcja-testow-I7-v2.md:363-364` (wiersze §4 pkt 2 i pkt 7 tabeli 3.1) — cytaty
  są urwane w połowie zdania oryginału (np. „...nie zrównuje wielkich i małych liter” zamiast
  pełnego zdania kończącego się na „...mają podobieństwo zero i zobaczysz przy nich *brak
  podobnych*”) bez znacznika wielokropka, w przeciwieństwie do sąsiednich wierszy (§3.9, §4 pkt 1),
  które przy skróceniu środka zdania używają „(…)”. Treść się zgadza, to tylko niespójność
  konwencji cytowania w tej samej tabeli.

## Plan compliance

### Done ✓
- `docs/instrukcja-testow-I7-v2.md` w układzie „Zdecydowałaś → Jest teraz → Sprawdź” dla 7.1–7.3,
  sprostowanie z pytaniem przy 7.4, rozdział „Przy okazji” (2.1–2.3), tabela zdań unieważnionych
  + osobna sekcja dla §4 pkt 4, podsumowanie i „jak zgłosić” — dokładnie jak we wzorcu I4-v2/I5-v2.
- Banner „częściowo nieaktualne” w `docs/instrukcja-testow-I7.md`, z listą, co dokładnie przestało
  być prawdą — zgodny treściowo z rozdziałem 3 delty.
- Roadmapa: P7.4 ✅, „Iteracja 7 ZAMKNIĘTA” z ustaleniami i tabelą „Otwarte po stronie Ani” (dwa
  pytania, dopisane też w nagłówku planu P) — sprawdziłem zgodność z rzeczywistym stanem kart
  P7.1–P7.5 (wszystkie zmergowane).
- Backlog #41 — akapit o sprostowaniu i pytaniu doprecyzowującym; żaden inny wpis backlogu nie
  został tknięty (zgodnie z `raport.md`, Follow-up).
- Weryfikacja twierdzeń z kodem (krok 4 Implementation planu) — potwierdzona niezależnie w tym
  review: `PanelPending.tsx` (ostrzeżenie, toasty, dialogi), `historia/mapowanie.ts` +
  `TabelaHistorii.tsx` (wygląd wpisu, dostawca „—”, wyszukiwarka case-insensitive po
  `JSON.stringify`), `routes/atrybuty.ts` (audyt sześciu tras kolejki, skan po
  `POST /api/staging/accept` bez audytu), `atrybuty-pending.ts` + `app.ts` (sprzątanie kolejki na
  starcie i na końcu skanu, seed marka/bieznik z `products`), `Staging.tsx` (przycisk „Akceptuj
  zaznaczone (N)”), `konfiguracja/zakladki.ts`/`Dziennik.tsx` (zakładka i surowe nazwy akcji).
- Cytaty ze starej instrukcji (I7.md) i cytaty odpowiedzi Ani (backlog #39–#42) sprawdzone znak
  w znak — zgodne, łącznie z konwencją zamykania cudzysłowu prostym znakiem `"` w cytatach
  z pierwszej wersji.
- Scenariusz 1.1 przeliczony na `db/snapshot.db` (read-only): `307` jest w słowniku `bieznik`,
  3 produkty (MO2, ALLIANCE), nie jest odrzucony; staging ma 3362 nieprzyjętych pozycji — krok
  „zatwierdź jedną dowolną pozycję” jest wykonalny i uruchamia realny skan
  (`routes/staging-mutacje.ts:195-199`).
- Twierdzenie 2.2 przeliczone: po sprzątaniu P7.2 zostaje 61 pozycji (54 `bieznik` + 7
  `kategoria`), z czego 57 ma dziś 0 produktów na żywo, a 4 kategorie małą literą (rolnicze 334,
  ciężarowe 106, przemysłowe 90, leśne 7) migracja `004_kategoria_wielka_litera.sql` przepisuje
  na Wielką literę — po migracjach też 0. Liczby zgadzają się co do jednego produktu.
- Twierdzenie o słowniku bieżników (1665 wartości, 1660 w obu kolumnach, 3 tylko w `bieznik`,
  0 tylko w `model`, 2 na żadnym produkcie — `AGRIMAX RT 851`, `RM 500 STBT`) — zgodne co do
  jednej pozycji.
- Twierdzenie o rodzajach „model”/„zastosowanie” (1670 różnych modeli po odfiltrowaniu MO6,
  199 poza słownikiem) — zgodne po doliczeniu filtra `dostawca != 'MO6'`, którego używa realny
  skan (`repos/atrybuty-pending.ts:258`).
- Język dla Ani: brak nazw plików, tras API, tabel, funkcji ani numerów ticketów w treści
  I7-v2 i w bannerze (sprawdzone grepem); technicznie nazwy widoczne na jej ekranie
  (`atrybut_pending_...`, „bieznik” bez ogonka) są opisane jako takie, zgodnie z zasadą.
  „Zdecydowałaś” występuje tylko w rozdziale 1 (7.1–7.3), nie w rozdziale 2; „zgłosiłaś” nie
  występuje.

### Missing or deviating ✗
- Brak — zakres plików i treść odpowiadają Implementation planowi (kroki 1–4) i Out of scope
  (bez zmian w `rebuild/` i `contract/`, `docs/instrukcja-testow-I5-v2.md` nietknięta).

### Definition of done
Plan nie ma osobnej sekcji „Definition of done” — poniżej cztery kroki Implementation planu.

- [x] `docs/instrukcja-testow-I7-v2.md` wzorem I4-v2/I5-v2, ze wszystkimi punktami z planu
  (7.1–7.4, „Przy okazji”, tabela unieważnień + §4 pkt 4 osobno, podsumowanie, jak zgłosić)
- [x] Banner w `docs/instrukcja-testow-I7.md`
- [x] Roadmapa (P7.4 ✅, Iteracja 7 zamknięta, dwa pytania otwarte) + backlog #41
- [x] Review twierdzeń z kodem na develop po merge'u karty FE (P7.5) — potwierdzone niezależnie
  w tym review

## Parallel-test concerns

Nie dotyczy — ticket DOCS, bez testów automatycznych (`raport.md`: „Unit / integracja / E2E:
nie dotyczy”).

## Overall assessment

Dokument jest wyjątkowo starannie zweryfikowany: każdą liczbę, którą sprawdziłem niezależnie na
`db/snapshot.db` (307 → 3 produkty MO2/ALLIANCE; 61 pozycji kolejki po sprzątaniu, 54+7; 57 z 0
produktami + 4 kategorie zerowane migracją 004; 1665/1660/3/0/2 w słowniku bieżników; 1670/199
modeli po filtrze MO6; 3362 pozycji stagingu), potwierdziłem co do jednego. Cytaty ze starej
instrukcji i z odpowiedzi Ani zgadzają się znak w znak z `docs/instrukcja-testow-I7.md` i
`docs/rebuild-backlog.md` #39–#42. Kod (ostrzeżenia, toasty, wpis w Historii, audyt sześciu tras
kolejki, sprzątanie na starcie/po skanie, przycisk stagingu, zakładka Dziennik) potwierdza każde
zdanie, które sprawdziłem. Jedyny realny brak to kompletność tabeli 3.1 (nie unieważnia własnego
zdania §1 o „Wyczyść pending”, choć unieważnia identyczne zdanie z §2) — kosmetyczne, bo ramka
ostrzegawcza na górze kartki i tak każe nie klikać tego przycisku przed końcem rozdziału 1.
Gotowe do merge'a.
