# 167-FEATURE-oszacuj-pozostale-wagi — plan

> Nadbudowa nad ticketami 155/156/166. NOWA logika biznesowa, nie odtworzenie produkcji —
> zatwierdzona przez użytkownika w rozmowie (2026-09-29).

## Ticket description

Po „Dociągnij wagę" (dokładne dopasowanie marka+rozmiar+bieżnik) ~470 produktów zostaje bez
wagi, bo nie ma w katalogu żadnego identycznego „bliźniaka". Użytkownik chce dla NICH drugi,
świadomie mniej dokładny krok: przelicznik szacujący wagę wyłącznie po rozmiarze (bez marki i
bieżnika), oznaczony w UI jako SZACUNEK, nie potwierdzona waga.

## Decisions (z Q&A)

1. **Wzór:** średnia z wagi WSZYSTKICH innych produktów w katalogu o tym samym znormalizowanym
   rozmiarze (szerokość+profil+średnica — BEZ marki, bieżnika i konstrukcji), które mają
   niepustą/niezerową wagę. Działa tylko tam, gdzie choć jeden taki produkt istnieje.
2. **Oznaczenie:** osobna flaga `wagaSzacowana` (nie myli się z `wagaAutoUzupelniona` z ticketu
   155/156) — osobny tooltip w UI, jasno mówiący „SZACOWANA, nie potwierdzona".
3. **Miejsce w UI:** osobny przycisk „Oszacuj pozostałe wagi" w tej samej sekcji „Dziedziczenie
   wagi" (Konfiguracja → Katalog), uruchamiany świadomie, osobno od „Dociągnij wagę".
4. **Priorytet:** identyczny wzorzec jak w 155/156 — działa TYLKO na produktach z pustą/zerową
   wagą, chronione ręczną poprawką (`manual_overrides`) są pomijane. Realna waga (dziedziczona
   albo ręczna) zawsze wygrywa, bo ten krok nigdy nie nadpisuje niepustej wagi.

## Implementation plan

### Backend
1. Migracja `015_waga_szacowana.sql` — `products.waga_szacowana` (nullable INTEGER, jak
   `waga_auto_uzupelniona` z 014 — ten sam powód: harness charakteryzacyjny wstawia NULL).
2. `schema.ts` — nowa kolumna.
3. `dziedziczenieWagi.ts` — nowe funkcje:
   - `kluczRozmiaru(rekord)` — jak `kluczZRekordu`, ale BEZ marki i bieżnika (tylko
     szerokość+profil+średnica; marka nie jest wymagana do klucza, tylko rozmiar).
   - `sredniaWagaDlaRozmiaru(db, klucz)` — `AVG(waga)` po dopasowaniu tylko rozmiaru,
     `waga IS NOT NULL AND waga <> 0`, zaokrąglone do liczby całkowitej.
   - `oszacujWageWstecznie(db, sqlite)` — analogiczna struktura do `dziedziczWageWstecznie`:
     skanuje puste/zerowe wagi, pomija chronione override'em, liczy średnią, ustawia
     `waga`+`wagaSzacowana=true`. W transakcji.
4. `routes/maintenance.ts` — `POST /api/products/oszacuj-wage`, audyt
   `oszacowanie_wagi_wsteczne`.
5. `scripts/oszacuj-wage.ts` — cienki wrapper CLI, wzorem `dziedzicz-wage.ts`.
6. Kontrakt: nowy endpoint + pole `wagaSzacowana` w schemacie produktu, fixture ręcznie
   napisany (jak `dziedzicz-wage` — endpoint nie istnieje w produkcji).

### Frontend
7. `filtrowanie.ts` — `Produkt.wagaSzacowana?: boolean`.
8. `formatowanie.tsx` — gałąź `waga`: priorytet `wagaAutoUzupelniona` (dzisiejszy tooltip) >
   `wagaSzacowana` (nowy tooltip, kolor amber, treść „Waga SZACOWANA wg średniej dla tego
   rozmiaru w katalogu — nie potwierdzona").
9. `konfiguracja/katalog.ts` — klient `oszacujWage()`.
10. `konfiguracja/Katalog.tsx` — nowy przycisk „Oszacuj pozostałe wagi" pod „Dociągnij wagę",
    własny wynik + link do `/katalog?status=brak_waga` (ten sam filtr — nadal łapie tylko realne
    braki, bo `wagaSzacowana` nie zeruje `waga`).
11. Reset `wagaSzacowana` przy ręcznej edycji `waga` w `repos/products.ts::aktualizujProdukt`
    (tak samo jak `wagaAutoUzupelniona`) — ręczna wartość ma zawsze wygrywać i nie być mylona
    z szacunkiem.

## Out of scope

- Szacowanie z zerowej wiedzy (formuła geometryczna) — odrzucone przez użytkownika.
- Automatyczne łączenie kroku z „Dociągnij wagę" w jedno kliknięcie — odrzucone.

## Testing strategy

Jednostkowe dla `sredniaWagaDlaRozmiaru`/`oszacujWageWstecznie` (średnia, zaokrąglenie, pominięcie
override, brak żadnego produktu w rozmiarze), integracyjne przez trasę HTTP, frontend: przycisk,
tooltip, reset flagi przy edycji.
