# Wejście dla I15.4b od ticketu 124 (karta I15.4a — fundament stagingu) · 2026-09-23

## Fundament jest gotowy — wołaj repozytoria, nie pisz SQL-a od nowa

Migracja `012` (sześć tabel + dwa indeksy), model Drizzle i `rebuild/backend/src/repos/staging-polityka.ts`
są zmergowane. **Pełna lista 16 sygnatur z odsyłaczami do linii `staging_policy.cjs` @ `88fa31c`:
`docs/karty/I15.4a/karta.md`, sekcja „Do koordynatora" → „1. Sygnatury repozytoriów".** Nie przepisuję
jej tutaj, żeby nie rozjechała się z implementacją. Sygnatury są tak dobrane, żebyś mogła ich używać
**bez zmian w plikach I15.4a**.

Do importera przydadzą się przede wszystkim: `stanOfertyDostawcy` / `zapiszStanOfertyDostawcy`,
`czyZnanaWersjaOferty` / `zapiszWersjeOferty` (bezpieczeństwo źródła, #103),
`dowodyNieobecnosci` / `zapiszDowodyNieobecnosci` / `usunDowodyNieobecnosci` (dowody nieobecności, #103),
`czyAutomatycznieWstrzymany` / `zapiszAutomatyczneWstrzymanie` / `usunAutomatyczneWstrzymanie`
(dostępność, #104) oraz `dopasowanieStagingu` / `zapiszDopasowanieStagingu` (#99).

## Trzy rzeczy, których nie wolno „uprościć"

- `zapiszAutomatyczneWstrzymanie` **nie aktualizuje `suspended_at`** przy konflikcie (tylko
  `source_fingerprint` i `reason`) — data pierwszego wstrzymania jest punktem odniesienia dla tego,
  jak długo produktu nie ma w ofercie. Przesunięcie jej przy każdym imporcie skasowałoby ten licznik.
- `zapiszStanOfertyDostawcy` podnosi `maxItemCount` przez `MAX(supplier_feed_state.max_item_count,
  excluded.max_item_count)` i **nigdy go nie obniża** — to po nim poznaje się ofertę „mniejszą o ponad
  20%". Oryginał zabezpiecza to podwójnie: podaje w parametrze już policzone
  `Math.max(itemCount, feedState?.max_item_count||0)`, a SQL i tak robi `MAX(…)`. Oba zostają.
- `zapiszWersjeOferty` to **goły `INSERT`, bez `ON CONFLICT`** — wiernie. Oryginał woła go tylko pod
  warunkiem `distinctCompleteFeed`, prawdziwym wyłącznie wtedy, gdy `czyZnanaWersjaOferty()` było
  fałszem. Powtórka rzuca `UNIQUE constraint failed` i **tak ma być** — to błąd wołającego, nie
  sytuacja do połknięcia.

⚠ `staging_matches` **nie ma funkcji kasującej** — oryginalny `install()` nie ma żadnego
`DELETE FROM staging_matches` (kasował je tylko skrypt jednorazowy `zero_and_delete_agrorami_20260922.cjs`,
D5: nie przenosimy). Jeśli jej potrzebujesz, to **nowe zachowanie** — zapytaj użytkownika w Kroku 3.

## Indeks unikalny zmienia Twoje fixtury testowe

Od `012` na `staging_items` stoi `staging_one_current_product (dostawca, kod)`. Dane testowe
wstawiające kilka zgłoszeń tej samej pary **przestają działać** — w `db.migracje.test.ts` trzeba było
nadać helperowi `dodajStaging` unikalny `kod`. To jest dokładnie reguła Staging v2 (#99), którą
odtwarzasz w `addStaging`: nowe zgłoszenie **zastępuje** poprzednie dla tej pary, a nie dokłada się obok.

## Statusy backlogu, które Cię blokują

W `docs/rebuild-backlog.md` **tylko #99** ma `Do nowej wersji? ✅ TAK`. Wpisy **#103 („Braki w cenniku"),
#104, #105, #107** mają `⬜ do decyzji`. Ticket 124 dowiózł **sam schemat** (decyzja D-124.3
użytkownika: te tabele fizycznie istnieją na produkcji od 22–23.09, więc migracja tylko doprowadza
odbudowę do stanu produkcji i nie wnosi nowego zachowania) — ale **LOGIKA z #103/#104, czyli Twój
zakres, wciąż czeka na formalne `✅`.** Podnieś to w Kroku 3, zanim zaczniesz implementację.
