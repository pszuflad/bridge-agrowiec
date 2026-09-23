# Wejście dla I15.4c od ticketu 124 (karta I15.4a — fundament stagingu) · 2026-09-23

## 1. Fundament jest gotowy — repozytoria do wołania bez zmian w cudzych plikach

Migracja `012`, model Drizzle i `rebuild/backend/src/repos/staging-polityka.ts` są zmergowane.
**Pełna lista 16 sygnatur z odsyłaczami do linii `staging_policy.cjs` @ `88fa31c`:
`docs/karty/I15.4a/karta.md`, sekcja „Do koordynatora" → „1. Sygnatury repozytoriów".**
Nie przepisuję jej tutaj, żeby nie rozjechała się z implementacją.

**Trzy rzeczy, których nie wolno „uprościć"** przy budowaniu na nich akceptacji i tras:
- `zapiszAutomatyczneWstrzymanie` **nie aktualizuje `suspended_at`** przy konflikcie (tylko odcisk
  i powód) — to licznik tego, jak długo produktu nie ma w ofercie;
- `zapiszStanOfertyDostawcy` podnosi `maxItemCount` przez `MAX(…)` i **nigdy go nie obniża**;
- trzy zapisy na `staging_absence_decisions` różnią się WYŁĄCZNIE traktowaniem `selected_source_code`:
  `zamknijSpraweNieobecnej` go **zachowuje**, `zapiszWyborKartyZrodlowej` **ustawia**,
  `zapiszWyborBiezacejKarty` **zeruje**.

⚠ `staging_matches` **nie ma funkcji kasującej** — oryginalny `install()` nie ma żadnego
`DELETE FROM staging_matches` (kasował je tylko skrypt jednorazowy `zero_and_delete_agrorami_20260922.cjs`,
D5: nie przenosimy). Jeśli jej potrzebujesz, to **nowe zachowanie** — zapytaj użytkownika w Kroku 3,
zamiast dopisywać po cichu.

## 2. ZADANIE PRZEJĘTE OD I15.4: pomiar z backlogu #107

`docs/rebuild-backlog.md` #107 („zatwierdzanie zbiorcze stagingu blokowało panel na 5 s na pozycję")
zleca pomiar karcie **I15.4** — czyli karcie sprzed podziału na a/b/c. Po podziale zadanie nie miało
przypisania. **Decyzja użytkownika z 2026-09-23 (D-124.4 ticketu 124): trafia do I15.4c.**

Uzasadnienie: pomiar dotyczy **zatwierdzania zbiorczego**, a akceptacja i trasy są zakresem I15.4c.
I15.4a (fundament: migracja, model, repozytoria) nie dotyka akceptacji, więc nie miała czego zmierzyć.

**Co jest do zrobienia.** Backlog #107 mówi wprost: *„⬜ sprawdzić, czy nas dotyczy, zanim cokolwiek
naniesiemy"*. To naprawa skutku architektury produkcji — `uwaga_cena_patch.cjs` otwiera WŁASNE
połączenie do `data.db` (ten sam wzorzec co `payment_blocks.cjs`), przez co każda pozycja zatwierdzania
zbiorczego czekała 5 s na blokadę. **Odbudowa ma jedno połączenie i `uwaga_cena` jako normalną kolumnę
modelu, więc problem prawdopodobnie u nas nie istnieje.** Zmierz zatwierdzanie zbiorcze na kopii
produkcji i **zapisz wynik pomiaru** w swojej `karta.md`, zamiast portować łatkę mechanicznie.

Status wpisu #107 w backlogu to nadal `⬜ do decyzji` — nie nanoś go bez decyzji użytkownika.

## 3. Statusy backlogu, które Cię blokują

W `docs/rebuild-backlog.md` **tylko #99** ma `Do nowej wersji? ✅ TAK`. Wpisy **#103 („Braki w cenniku"),
#104, #105, #106, #107** mają `⬜ do decyzji`. Ticket 124 dowiózł **sam schemat** (decyzja D-124.3
użytkownika: te tabele fizycznie istnieją na produkcji od 22–23.09, więc migracja tylko doprowadza
odbudowę do stanu produkcji i nie wnosi nowego zachowania) — ale **LOGIKA z #103/#104/#106, czyli
Twój zakres, wciąż czeka na formalne `✅`.** Podnieś to w Kroku 3, zanim zaczniesz implementację.

## 4. Drobiazg, który Cię dotknie w testach

Od migracji `012` na `staging_items` stoi indeks unikalny `staging_one_current_product (dostawca, kod)`.
Fixtury testowe wstawiające kilka zgłoszeń tej samej pary **przestają działać** — w `db.migracje.test.ts`
trzeba było nadać helperowi `dodajStaging` unikalny `kod`. Jeśli budujesz dane testowe akceptacji,
zakładaj jedno bieżące zgłoszenie na parę.
