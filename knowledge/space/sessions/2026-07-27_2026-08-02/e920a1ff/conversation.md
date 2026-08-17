# Session e920a1ff (2026-07-31 06:03 UTC → 2026-07-31 06:05 UTC) — 2 turns

**Session UUID:** e920a1ff-4688-4220-ae19-5383818be4b4

1. [2026-07-31 06:03 UTC] [line 10] Proszę o wskazanie, czy możemy włączyć poniższe funkcje funkcje samodzielnie w p...
2. [2026-07-31 06:05 UTC] [line 60] czy coś z tych rzeczy możemy zrobić sami?

---

## Turn 1 — 2026-07-31 06:03 UTC
### Query
Proszę o wskazanie, czy możemy włączyć poniższe funkcje funkcje samodzielnie w panelu administracyjnym. Jeżeli Szablon Premium nr 6 nie posiada odpowiednich ustawień, prosimy o wycenę kompleksowej modyfikacji szablonu.
Zastosowanie separatora tysięcy i polskiego formatu cen w całym sklepie, np.:
11 598,52 zł
zamiast:
11598.52 zł
Jednoczesne wyświetlanie ceny brutto i netto we wszystkich miejscach sklepu, w których prezentowana jest cena, w szczególności:
na stronie głównej,
na listach produktów i w kategoriach,
w wynikach wyszukiwania,
na karcie każdego produktu,
w produktach polecanych, podobnych i ostatnio oglądanych,
w koszyku,
w podsumowaniu zamówienia,
w formularzu składania zamówienia.
Cena brutto powinna być ceną główną, natomiast cena netto powinna znajdować się bezpośrednio pod nią
Cena netto musi być automatycznie obliczana zgodnie ze stawką VAT przypisaną do danego produktu. W koszyku i podsumowaniu zamówienia łączna wartość netto powinna uwzględniać stawki VAT wszystkich produktów.
Wymóg dotyczy również cen promocyjnych, cen wariantów i opcji produktu oraz cen zmieniających się zależnie od wybranej konfiguracji.

### Answer
Mam już wystarczająco danych, żeby odpowiedzieć merytorycznie. Bazuję na oficjalnej dokumentacji Selly (Cennik usług dodatkowych, Baza wiedzy – sprzedaż hurtowa B2B, Aktualizacje Selly 06/2022, archiwalny cennik Selly).

Poniższych funkcji nie da się w pełni włączyć samodzielnie w panelu Szablonu Premium nr 6 – wymagają zlecenia modyfikacji szablonu po stronie Selly. Prosimy o wycenę kompleksowego wdrożenia.

1. Polski format ceny (separator tysięcy + przecinek, np. 11 598,52 zł)
W panelu Selly można ustawić tylko separator dziesiętny (kropka/przecinek), głównie na potrzeby importu i zaokrągleń cen.
Separator tysięcy w prezentacji cen w witrynie nie jest opcją konfiguracyjną szablonów Premium – wymaga modyfikacji szablonu (zmiana funkcji formatujących cenę + miejsc wyświetlania: listing, karta, koszyk, podsumowanie, e‑mail transakcyjny).

2. Jednoczesne wyświetlanie ceny brutto i netto (brutto główna, netto pod spodem) we wszystkich miejscach
Selly obsługuje wybór brutto albo netto jako domyślnej ceny; równoczesne wyświetlanie „brutto + netto pod spodem” w każdym miejscu (strona główna, listy, wyszukiwarka, karta produktu, produkty polecane/podobne/ostatnio oglądane, koszyk, podsumowanie, formularz zamówienia) to funkcja szablonowa realizowana na zlecenie – potwierdza to zapis „możliwość ustawienia domyślnego wyświetlania cen netto (w zależności od szablonu – w formie zlecenia)”.
W archiwalnym cenniku Selly ta praca jest wyceniona jako osobna usługa: „wdrożenie wyświetlania cen netto produktów w katalogu produktów” i „…w strefie koszyka” – aktualną wycenę wystawia Selly.

3. Automatyczne wyliczanie netto wg stawki VAT przypisanej do produktu + suma netto z uwzględnieniem różnych stawek VAT w koszyku/podsumowaniu
Stawki VAT per produkt są w Selly standardem, ale prezentacja rozbicia „netto/brutto z rozbiciem po stawkach VAT” w koszyku i podsumowaniu, a także zsumowana wartość netto, wymaga modyfikacji szablonu i widoku koszyka.

4. Ceny promocyjne, warianty i opcje wpływające na cenę (dynamiczna zmiana brutto i netto)
To najbardziej wrażliwy punkt: cena netto musi się przeliczać dynamicznie w JS przy zmianie wariantu/opcji, spójnie z ceną promocyjną. To zawsze robota po stronie szablonu – nie ma przełącznika w panelu.

Sugeruję poprosić Selly o wycenę jednym pakietem, żeby uniknąć rozbicia na małe zlecenia:
1. Formatowanie cen w standardzie PL (separator tysięcy „spacja”, przecinek dziesiętny, „ zł”) globalnie – wszystkie widoki front‑endu i e‑maile.
2. Dual price „brutto (główna) / netto (pod spodem)” we wszystkich lokalizacjach wymienionych w zapytaniu.
3. Netto liczone dynamicznie z VAT produktu; w koszyku i podsumowaniu suma netto z rozbiciem po stawkach VAT.
4. Obsługa cen promocyjnych, wariantów i opcji konfiguracyjnych – dynamiczna aktualizacja brutto/netto po zmianie konfiguracji.
5. Zgodność ze Szablonem Premium nr 6 + gwarancja utrzymania po aktualizacjach szablonu.

Czy chcesz, żebym przygotował gotowy e‑mail do Selly z powyższą treścią (PL, oficjalny ton) do wysłania z Twojej skrzynki?

---

## Turn 2 — 2026-07-31 06:05 UTC
### Query
czy coś z tych rzeczy możemy zrobić sami?

### Answer
Krótka odpowiedź: samodzielnie w panelu Selly – praktycznie nic z tej listy nie da się w pełni włączyć. Można tylko przygotować grunt (dane), ale sama prezentacja cen wymaga modyfikacji szablonu przez Selly.

1. Poprawność stawek VAT na produktach – upewnić się, że każdy produkt ma prawidłową stawkę VAT ([Selly – hurt B2B](https://www.selly.pl/baza-wiedzy/sprzedaz/uruchomienie-sprzedazy-hurtowej/)). To warunek konieczny, żeby netto liczyło się poprawnie po wdrożeniu.
2. Separator dziesiętny w imporcie – ustawić przecinek jako separator groszy w Import/Integrator XML/CSV oraz zaokrąglenia cen ([Aktualizacje 06/2022](https://www.selly.pl/aktualizacje/aktualizacje-czerwiec-2022/)). To wpływa tylko na dane wejściowe, nie na wyświetlanie w sklepie.
3. Wybór typu ceny domyślnej (brutto albo netto) – jeśli sklep ma aktywną sprzedaż hurtową B2B, można ustawić domyślne wyświetlanie netto dla grup hurtowych ([Selly – hurt B2B](https://www.selly.pl/baza-wiedzy/sprzedaz/uruchomienie-sprzedazy-hurtowej/)). Ale to nadal „albo netto, albo brutto” – nie obie ceny naraz.
Separatora tysięcy „11 598,52 zł” w całym sklepie – brak przełącznika.
Jednoczesnego brutto + netto pod spodem na listach, karcie, koszyku, podsumowaniu, e‑mailach – wymaga modyfikacji Szablonu Premium 6.
Dynamicznego przeliczania netto przy zmianie wariantu/opcji i przy cenach promocyjnych – to logika w szablonie/JS.
Sumy netto z rozbiciem po stawkach VAT w koszyku i podsumowaniu – to widok koszyka, nie ustawienie.

Nie ma sensu robić tego etapami samemu – wysłać jedno zapytanie do Selly o wycenę całości (punkty 1–5 z poprzedniej wiadomości) i równolegle po Waszej stronie tylko zweryfikować stawki VAT na produktach, żeby po wdrożeniu netto liczyło się od razu poprawnie.

Chcesz, żebym przygotował krótki e‑mail do Selly z prośbą o wycenę?

---
