# 100-DOCS-instrukcja-testow-i10-v2 — Code review

> Reviewed: 2026-09-22
> Branch: `docs/100-instrukcja-testow-i10-v2`
> Diff: 5 plików (`docs/instrukcja-testow-I10-v2.md` nowy, `docs/instrukcja-testow-I10.md`,
> `docs/instrukcja-testow-I8.md`, `docs/karty/P10.4/karta.md`, ticket `plan.md`), 1 commit

## BLOCKER

Brak.

## SHOULD-FIX

Brak.

## NICE-TO-HAVE

- [ ] `docs/instrukcja-testow-I10.md:12` — banner grupuje §7.4 razem z §1 pkt 4 / §6.4 / §6.9 / §8
  pod wspólnym „plik CSV zna filtry i ma kolumny tabeli", choć faktyczna unieważniona treść §7.4
  dotyczy **sesji** („eksport korzysta z sesji inaczej niż reszta panelu"), nie filtrów —
  I10-v2 §4.1 (wiersz „§7.4") opisuje to poprawnie i precyzyjniej niż skrót w bannerze. Rozjazd
  kosmetyczny, sam banner i tak każe czytać I10-v2 w całości.
- [ ] `docs/instrukcja-testow-I10-v2.md:213` — pytanie A o pełne pliki z sufitem wymienia tylko
  2.5 i 4.1/4.2 jako przykłady („Najbardziej chodzi o…"), a sufit 1000 dotyczy też 2.1-2.4, Marży
  i Rotacji (opisane w akapicie wyżej) — formalnie nieuszkadzające (akapit nad pytaniem jest
  precyzyjny), ale odpowiedź Ani może przez to pominąć te trzy karty.

## Plan compliance

### Done ✓
- `docs/instrukcja-testow-I10-v2.md` (nowy) w formacie delty I7-v2/I9-v2: rozdz. 1 (decyzje
  10.1–10.3 + pytania), rozdz. 2 (zgłoszenie kafli KPI), rozdz. 3 („Przy okazji" — P6.2, migawka),
  rozdz. 4 (tabela unieważnień §4.1, rozliczenie §8 w §4.2, checklista §9 w §4.3), podsumowanie,
  „Jak zgłosić" — komplet zgodny z planem kroku 1.
- Banner w `docs/instrukcja-testow-I10.md` (wzór I7/I9) — krok 2.
- Dwie notki w `docs/instrukcja-testow-I8.md` (§10.4 i wiersz checklisty) — krok 3, decyzja D1/K0.
- `docs/karty/P10.4/karta.md` zaktualizowana: Stan ✅ z datą i ticketem, Decyzje K0–K4, Dowiezione,
  Do koordynatora (zamknięcie Iteracji 10, kandydat na backlog, brak konsumenta kafla eksportu) —
  krok 4.
- Dwa wejścia (`wejscie-96.md`, `wejscie-98.md`) poprawnie obalone przy weryfikacji w kodzie
  (eksport z Katalogu jest kliencki i nie pisze audytu — `Katalog.tsx:297-300`,
  `katalog/eksport.ts`; sufity kart 500/1000 w `analityka.ts`) — zamiast przepisania ich na wiarę,
  co było wyraźnie oczekiwane przez ticket.
- Weryfikacja treści przeciwko kodowi `develop` (merge-base `fde7697`): sprawdzone niezależnie —
  format kafla „Ostatni eksport CSV" (`pulpit/kpi.ts`, `pulpit/czas.ts`), generator CSV Analityki
  (`analityka/csv.ts`, `eksport.tsx`), etykiety kafli i limity EAN (`NaglowekKpi.tsx`,
  `repos/analityka.ts`), limity kart 4.1/4.2/1.2/3.1 (500) i 2.1-2.4/2.5/Marża/Rotacja (1000),
  kolumny CSV karty Marża i „Dostępność" bez `%` — wszystko zgadza się z opisem w I10-v2.
- Liczby z `db/snapshot.db` (odczyt, poza zakresem raportu): `historia_cen` = 14513,
  `upload_pliku` = 92 (ostatni 2026-07-27), 0 wpisów `eksport_csv`/`eksport_shoper`, EAN wspólne
  (bez LIMIT) = 769, pozycje unikalne (bez LIMIT) = 5109, grupy 4.1/4.2 (bez LIMIT) = 5184,
  udział „—" w limitowanych 500 wierszach: 4.1 ≈ 50,8%, 4.2 ≈ 23,8% — wszystkie dokładnie
  zgadzają się z liczbami przywołanymi w `raport.md` i `karta.md`.
- Cytaty w tabeli §4.1 sprawdzone punktowo (ramka na górze, §1 pkt 4, §2.2, §2.3, §3.1, §3.3,
  §3.4, §3.5, §5.4, §6.9, §8, §10) przeciwko `origin/develop:docs/instrukcja-testow-I10.md` —
  znak w znak.
- Anchory markdown (`#12-kafel-ostatni-eksport-csv-…`, `#25-pulpit-liczy-i-pokazuje-…`)
  przeliczone algorytmem GitHub-slug — zgadzają się z linkami użytymi w I8.md i I10-v2.md.
- Numeracja §-ów w bannerze I10 odpowiada realnym liniom po doliczeniu przesunięcia +12
  wynikającego z dodania samego bannera (sprawdzone na trzech wejściach: 85, 96/97, 98).
- Język dla Ani: zero nazw plików/tras/tabel/ticketów w treści I10-v2.md poza jedynym linkiem do
  innego pliku instrukcji (dozwolone, to nie jest artefakt kodu). Rozdział „Przy okazji" nie
  przypisuje Ani zgłoszenia („nie zgłaszałaś", nie „zgłosiłaś"). Kafle KPI (§2.1) opisane jako
  „Zgłosiłaś", nigdy „zdecydowałaś" — zgodnie z D5/K4 (odpowiedź na 12.3 nie jest zapisana).
- Zgodność z CLAUDE.md: diff nie rusza `rebuild/`, `contract/`, roadmapy, backlogu, spec-backend
  ani `docs/pytania-do-ani-2026-09-18.md` (sprawdzone `git diff origin/develop...HEAD --name-only`
  — tylko 5 plików tego ticketu). Karta P10.4 opisuje stan (data, ticket, „Dowiezione" zamiast
  „Zakres" na przyszłość) — zgodnie z zasadą „karta = stan, nie zamiar".

### Missing or deviating ✗
Brak — zakres z planu pokryty w całości, bez odstępstw (raport.md też deklaruje „Deviations from
plan: Brak" i nie znalazłem nic, co by temu przeczyło).

### Definition of done
- [x] I10-v2 w formacie delty, wszystkie unieważnienia z wejść 85/90/96/97/98 + znalezione przy
      weryfikacji, cytaty znak w znak.
- [x] Banner w I10, notki w I8.
- [x] Karta P10.4 = stan; „Do koordynatora" z zamknięciem Iteracji 10.
- [x] review.md bez otwartych BLOCKER-ów (ten dokument).

## Parallel-test concerns

N/D — ticket DOCS, brak testów automatycznych (potwierdzone: `git diff origin/develop -- rebuild
contract` puste; `raport.md` deklaruje Unit/Integration/E2E: N/D).

## Overall assessment

Bardzo solidna robota weryfikacyjna: każde twierdzenie o zachowaniu aplikacji, które sprawdziłem
niezależnie w kodzie `develop` i na kopii produkcji (`db/snapshot.db`), zgadza się co do słowa i co
do liczby — łącznie z dwoma nietrywialnymi obaleniami wejść (96, 98), które wymagały realnego
zrozumienia kodu, a nie przepisania cudzego zdania. Format, ton i słownictwo dla Ani trzymają się
wzorca I7-v2/I9-v2, a karta P10.4 i banner w I10 są spójne z resztą repo i zasadami z CLAUDE.md
(stan zamiast zamiaru, brak dotknięcia roadmapy/backlogu/spec/rebuild/contract). Dwie uwagi
kosmetyczne w NICE-TO-HAVE nie wpływają na wierność ani użyteczność kartki dla Ani — ticket można
mergować bez poprawek.
