# Wpisy backlogu od sesji 196 · 2026-10-07

Źródło: notatka „Bridge: stan wdrożeń i uporządkowanie zaległości" (audyt 2026-10-07 ok. 12:00, produkcja `2783684`,
training `581a144`). Poniżej tylko to, co zmienia stan wcześniejszych wpisów; wpisów z innych sesji nie edytujemy
(wolno tylko `Status` / `Do nowej wersji?`).

### #196.1 — Krok `2026-10-07-zrodla-cennikow-foldery` omijał obecne źródła i kończył się „sukcesem" bez pracy

**Status:** ✅ naprawione w tickecie 196
**Do nowej wersji?** tak
**Źródło:** audyt. Po tickecie 194 produkcja ma bezwzględne ścieżki (MO4 `…/MO4_…/agrowiec_wr.csv`, MO5 `…/MO5_…/agrowiec_mw.csv`,
MO9 `…/imports/agrorami.csv`), których `czyStareZrodlo()` nie rozpoznawało, więc MO9 nie przechodził na folder + `agrorami-api.csv`.
Brak katalogu/folderu zwracał tekst i runner zapisywał krok jako wykonany.
**Decyzja wdrożona:** MO9 (plik bezpośrednio w `imports/`) → `plik://<folder MO9>`; MO4/MO5 (jawny plik WEWNĄTRZ własnego folderu) **bez zmian**.
Krok może zwrócić `{ odloz }` — wdrożenie idzie dalej, krok nie jest zapisany i ponowi się przy następnym wdrożeniu.

### #196.2 — W folderze MO5 „najnowszy plik" to `agrowiec_suma.csv`, nie `agrowiec_mw.csv`

**Status:** ⏳ do ustalenia (zawartość `agrowiec_suma.csv` niezweryfikowana)
**Do nowej wersji?** —
**Źródło:** audyt. Dopóki MO5 ma jawną ścieżkę do `agrowiec_mw.csv` (zostawioną przez #196.1), `suma` nie wygra. Przed przejściem MO5 na „najnowszy plik
folderu" ustalić przeznaczenie `suma` (połączone magazyny?) i wybrać jawną nazwę/wzorzec albo wyłączyć pliki pomocnicze.

### #196.3 — Sprostowanie #154.1: usterka dotyczy starszego `selly/mapper.ts`, nie całego sync v2

**Status:** ⏳ do decyzji
**Do nowej wersji?** —
**Źródło:** audyt. `selly/mapper.ts` (opis HTML z rekordów Drizzle) zjada `'Tak'` przez tryb `boolean`; `selly/rest/mapper-v2.ts` ma `yn()`
akceptujące „Tak" i pełną synchronizację na surowych zapytaniach SQLite. Pomiar: 922 z 5410 aktywnych kart (≈17%) ma „Tak" w M+S/3PMSF
(skala danych podatnych w starszym odczycie, nie liczba uszkodzonych kart w Selly). CFO/NRO/CHO nie są w mapie cech v2 — to osobna kwestia
kompletności eksportu. Naprawa: odczyt konsumenta, nigdy `schema.ts`.

### #196.4 — Aktualizacja statusów wpisów z listy

- **#168.1:** #288 przywraca poprawkę `nazwa` po akceptacji — tylko ten przypadek, nie wszystkie pola/ścieżki.
- **#187.1:** aktualne (`/api/staging/reject` = proste usunięcie); decyzja o „Odrzuć" na liście otwarta.
- **#173.1:** pomiar: 8 kart `AUTO` (5×MO5, 3×MO9), wszystkie `wstrzymany`, każda ma kartę tego samego dostawcy z tym samym EAN. Trzy MO5 to mocni
  kandydaci na duplikat (`MO5_AUTO_913CD4D4D6354CC06A`→`MO5_KARD080F16004LWG0`, `…6545B91AE2F7029C68`→`MO5_HLRD153G10758MA04`,
  `…4BD3121250A066BD06`→`MO5_GNCR17521575MP460`); dwie MO5 różnią się zestawem DOT, trzy MO9 mają „nie starsza niz 3 lata" — **nie scalać po samym EAN**.
- **#173.2:** regex nadal w adapterze legacy; wskazana karta ma dziś poprawny model `CONTI HYBRID HS5` — potrzebny test potoku importu, nie SQL.
- **#175.1–175.3:** nadal otwarte, bez pełnego porównania archiwów.
- **Tor 2:** `SELLY_TOR2=false`; 89 aktywnych rekordów Bridge bez wpisu w `selly_products` (brak mapowania ≠ brak produktu w sklepie). Przed włączeniem dry-run.
- **#143.3:** plan do odświeżenia, nie siedem potwierdzonych błędów. **#162.1:** `.claude/commands/feature.md` nadal każe odtwarzać oryginał — dług procesu.
- **#139.2:** domyślka wskazuje bridgeone (nie agritires), `.env` obu środowisk ma osobne katalogi; ryzyko tylko przy braku env.
- **PR #279** zamknięty jako zbędny (konta założone 07.10 09:37); **#280** zmergowany 06.10. Stare crony sklepu: wyłączanie odłożone.
- **#295** (historia usunięć z Selly: tabela, karta, eksport CSV) jest na `develop`, nie na produkcji; samo wdrożenie nie włącza usuwania.
