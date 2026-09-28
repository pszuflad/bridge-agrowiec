# P10.4 — delta instrukcji I10 dla Ani

> **Stan:** ✅ 2026-09-22 · 100-DOCS-instrukcja-testow-i10-v2
> **Iteracja:** 10 — Analityka i Pulpit · **Wpisy backlogu:** #32, #34, #91 (tylko opisane, statusy bez zmian) · **Zależy od:** P10.1, P10.2, P10.3, PR.2 (wszystkie ✅ w `develop` `fde7697`)
> **Ticket:** 100-DOCS-instrukcja-testow-i10-v2

Przeniesione z roadmapy (blok „Poprawki po testach Ani”, plan P) ticketem `86-DOCS-migracja-kart-etap2`, 2026-09-21.

## Zakres
Delta instrukcji `docs/instrukcja-testow-I10.md` dla Ani (format jak I7-v2/I9-v2: „Zdecydowałaś /
Zgłosiłaś → Jest teraz → Sprawdź”, „Przy okazji”, „Co przestało być prawdą”). Wejścia od innych
kart: pliki `wejscie-*.md` w tym katalogu (85, 90, 96, 97, 98 — wszystkie rozliczone).

## Pliki (wyłączna własność)
`docs/instrukcja-testow-I10-v2.md` (nowy) + banner w `docs/instrukcja-testow-I10.md` + dwie notki
w `docs/instrukcja-testow-I8.md` (decyzja K0).

## Decyzje
Użytkownik, 2026-09-22:
- **K0** — I8 (§10.4 i wiersz tabeli „Rzeczy, które mają wyglądać źle”) dostaje po jednej notce
  z odesłaniem do I10-v2 §1.2; bez bannera na cały plik.
- **K1** — kafel „Ostatni eksport CSV”: opis uczciwy (z UI osiągalna tylko gałąź „Ostatni import”)
  + pytanie do Ani, czy eksport z Katalogu ma zostawiać wpis w Historii (I10-v2 §1.2).
- **K2** — sufity serwera w plikach CSV: opis stanu + pytanie A do Ani o pełne pliki (I10-v2 §1.3).
- **K3** — pytanie B do Ani o plik marży per produkt (zapowiedziane w backlogu #91, pkt 2).
- **K4** — kafle KPI: „Zgłosiłaś (przegląd) → Jest teraz”, bez „zdecydowałaś” (odpowiedź na 12.3
  nie jest zapisana) i bez dodatkowej linijki-potwierdzenia wariantu.

## Dowiezione
- `docs/instrukcja-testow-I10-v2.md`: §1.1 karty 4.1/4.2 (#32), §1.2 kafel eksportu (#34) + pytanie,
  §1.3 CSV = tabela (#91) + pytania A i B, §2.1 kafle KPI (PR.2), §3.1 Pulpit z P6.2 (odesłanie do
  I6-v2 §2.5, bez scenariusza), §3.2 migawka (#31, bez scenariusza), §4.1 tabela 20 unieważnień
  z cytatami znak w znak (sprawdzone skryptem względem pierwszej wersji), §4.2 rozliczenie §8,
  §4.3 wiersze listy kontrolnej §9, podsumowanie, „Jak zgłosić”. #35 (404) — tylko usunięcie
  zapisów o pustym pliku (§6.3, §7.5), bez scenariusza.
- Banner w I10 (wzór I7/I9), notki w I8.
- **Dwa wejścia obalone przy weryfikacji w kodzie** (zamiast przepisania na wiarę):
  1. `wejscie-96.md` „Sprawdź: zrób eksport CSV z katalogu i wróć na Pulpit → data” — niewykonalne.
     Eksport z Katalogu jest kliencki i świadomie nie pisze audytu (`rebuild/frontend/src/pages/Katalog.tsx:297-300`,
     `pages/katalog/eksport.ts:5-11`); `eksport_csv`/`eksport_shoper` piszą tylko
     `routes/export-shoper.ts:141,165,203`, których żaden ekran nie woła. Kopia produkcji: 0 eksportów,
     92 × `upload_pliku` (ostatni 2026-07-27). I10-v2 sprawdza gałąź importu („Wgraj plik”).
  2. `wejscie-98.md` „eksport nie ma ŻADNEGO limitu” — nieścisłe. Plik ma wiersze karty, a trasy kart
     mają sufity: 1000 (`ean/comparison`, `ean/unique`, `margins` — grupy, `rotation/inactive`),
     500 (`suppliers/lifecycle`, `prices/last-import`, `availability/products`, `availability/sell-through`)
     — `rebuild/backend/src/repos/analityka.ts:170,391,713-715,1126,1299-1302`. I10-v2 mówi „tyle wierszy,
     ile N w stopce” i opisuje sufit.
- Gate odbudowy: N/D (DOCS, `rebuild/` i `contract/` nietknięte).

## Do koordynatora
- **Iteracja 10 do oznaczenia jako zamknięta** w roadmapie: P10.1–P10.4 i PR.2 ✅. Przed wysłaniem
  I10-v2 Ani na stagingu (https://test.agritires.eu) musi stać `develop` co najmniej z `fde7697`
  (P10.1, P10.2, P10.3, PR.2 i P6.2), z bazą z historią cen (kopia produkcji) — inaczej §1.1 krok 1
  zatrzyma Anię.
- **Regresja pliku CSV po P10.3 — kandydat na wpis backlogu.** Plan P10.3
  (`docs/tickets/98-FEATURE-eksport-csv-z-tabeli/plan.md:66`) zakładał, że „karty i tak pobierają pełne
  listy z tras dashboardu” — nieprawda. Dawny serwerowy eksport `unique` nie miał limitu, a
  `availability-products`/`sell-through` miały 5000; dziś plik z karty ma najwyżej 1000/500 wierszy.
  Zmierzone na `db/snapshot.db`: pozycje unikalne 5109 → plik 1000; 4.1/4.2 ~5184 → 500; EAN wspólne
  769 (poniżej sufitu). Ania dostała pytanie A (I10-v2 §1.3) — od jej odpowiedzi zależy, czy trzeba
  zdjąć sufit dla plików. Ten sam sufit robi „Pozycje unikalne” = 1000 na kaflu KPI (port 1:1 oryginału).
- **Kafel „Ostatni eksport CSV” nie ma w UI żadnego źródła eksportu.** P10.2 ożywiła kafel, ale z
  panelu nie da się wytworzyć wpisu `eksport_*` (trasy serwerowego eksportu bez konsumenta, eksport
  z Katalogu bez audytu — decyzja D3 bloku 10f). Ania dostała pytanie (I10-v2 §1.2); wariant (a)
  byłby nowym odstępstwem (audyt z eksportu Katalogu).
- Pytanie B (plik marży per produkt) — odpowiedź zamyka otwarty punkt 2 z backlogu #91.
- `docs/karty/P10.4/wejscie-96.md` i `wejscie-98.md` zawierają obalone zdania (powyżej) — zostają jako
  historyczne wejścia, prawdą jest ten plik i I10-v2.
