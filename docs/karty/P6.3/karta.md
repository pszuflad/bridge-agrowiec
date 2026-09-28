# P6.3 — delta instrukcji I6 dla Ani

> **Stan:** ✅ 2026-09-21 · 85-DOCS-instrukcja-testow-i6-v2
> **Iteracja:** 6 — Alerty · **Wpisy backlogu:** — (instrukcja do #26 i #90) · **Zależy od:** P6.1, P6.2
> **Ticket:** `85-DOCS-instrukcja-testow-i6-v2`

*Katalog założony przez samą kartę w okresie przejściowym (`docs/karty/README.md`, „Okres
przejściowy") — zakres przepisany z wiersza P6.3 w roadmapie.*

## Zakres
Delta instrukcji I6 dla Ani — co P6.1 (72) i P6.2 (77) obaliły w `docs/instrukcja-testow-I6.md`.
Źródła listy: `raport.md` ticketu 72 (Follow-up), `raport.md` ticketu 77 („Do zrobienia później"),
podsekcja „Delta dla P6.3" w bloku Iteracja 6 roadmapy.

## Pliki (wyłączna własność)
- `docs/instrukcja-testow-I6-v2.md` (nowy)
- `docs/instrukcja-testow-I6.md` (tylko banner)
- `docs/karty/P6.3/karta.md`, `docs/karty/P10.4/wejscie-85.md`
- `docs/tickets/85-DOCS-instrukcja-testow-i6-v2/**`
- `docs/rebuild-backlog.md` — tylko odsyłacz do instrukcji w #26 i #90

## Decyzje
Brak nowych — format delty ustalony wzorem I5-v2 (ticket 73) i I4-v2 (ticket 65).

## Dowiezione
- **`docs/instrukcja-testow-I6-v2.md`** — delta w układzie I5-v2:
  - rozdział 1 (odpowiedzi Ani, „Zgłosiłaś → Jest teraz → Sprawdź"): 1.1 zakładka „Katalog"
    (runda 2, 1a), 1.2 „Oznacz jako przejrzany" / „Rozwiąż" w obu zakładkach (runda 2, 1b),
    1.3 wyszukiwarka „Szukaj w treści" (pytanie 6.4);
  - rozdział 2 „przy okazji": „Otwórz ponownie", domyślne „Nierozwiązane" i różnica „Wszystkie
    statusy" wobec oryginału, „Zaakceptuj wszystko" (bez pytania, cofanie tylko pojedynczo),
    status na serwerze w obu zakładkach, Pulpit (suma na kaflu, sekcje IMPORT/KATALOG);
  - rozdział 3 „czego nie zgłaszaj" (brak importu wraca co dobę, odcisk marży, MO7/MO8, marża =
    narzut, data alertu marżowego = data aktualizacji produktu, surowe plakietki);
  - rozdział 4 — 16 zdań I6 z numerami paragrafów + nota o I10;
  - ramka „Zanim zaczniesz": wiek danych stagingu (brak importu krytyczny prawie wszędzie, dwa
    z czterech rodzajów pewnie niewidoczne) — bez liczb, bo danych stagingu nie da się zmierzyć
    z repo (API za logowaniem).
- **Banner** w `docs/instrukcja-testow-I6.md` z listą unieważnionych paragrafów; reszta pliku
  bez zmian.
- **Weryfikacja stagingu (2026-09-21):** bundle `https://test.agritires.eu/assets/index-CQfyF1-x.js`
  zawiera „Zaakceptuj wszystko", „Oznacz jako przejrzany", „Otwórz ponownie", „Szukaj w treści"
  i „Nie udało się policzyć alertów katalogu" → P6.1 i P6.2 wdrożone. `tools/deploy-staging.sh`
  (`set -euo pipefail`) publikuje frontend dopiero PO udanym `npm run migrate`, więc `008` jest
  zastosowana.
- **Odstępstwo od promptu:** prompt mówił „link z Pulpitu otwiera od razu właściwą zakładkę" —
  prawda tylko dla WIERSZY sekcji; kafel „Aktywne alerty" i „Zobacz wszystkie" prowadzą na
  `/alerty` (zakładka Import). Instrukcja opisuje stan z kodu (`Pulpit.tsx:216`, `:252`).

## Do koordynatora
- **P6.3 zrobiona — Iteracja 6 może zostać zamknięta** (P6.1 ✅ 72, P6.2 ✅ 77, P6.3 ✅ 85).
  Wiersz P6.3 w tabeli roadmapy (`⬜ P6.1 i P6.2 zrobione, może startować`) jest już nieaktualny.
- **Nieścisłość w źródle listy (raport 72, Follow-up):** „§3.4–3.7: przyciski «Oznacz jako
  rozwiązane (5)»" — §3.4 pierwszej wersji nie wymienia żadnego przycisku; obalone są §3.3, §3.5,
  §3.6 (i §3.7 częściowo). Jeśli roadmapa przy zamknięciu iteracji cytuje ten zakres, poprawić.
- **I10 też jest obalona przez P6.2** (Pulpit): §2.3, §3.1 (tabela kafli), §3.3, §3.4, §3.5 i §6.8 opisują
  kartę powiadomień tylko z alertami importu. Wiersz P10.4 w roadmapie tego nie wspomina — ustalenie
  zapisane w `docs/karty/P10.4/wejscie-85.md`.
- **Fakt dla cutoveru/stagingu:** zawartość bundla na stagingu jest tanim dowodem wdrożenia bez
  logowania (`curl` indeksu → `grep` napisów); przydatne dla kolejnych delt instrukcji.
