# Wejście dla I15.10 od ticketu 117 (koordynator) · 2026-09-23 — decyzje i zdjęcie zależności

**1. Decyzja użytkownika (zgodnie z rekomendacją): ZAWÓR BEZPIECZEŃSTWA na kolizje `kod_importu` WCHODZI.**
Przed wysyłką w Torze 1 wykryj, że dla pary `(dostawca, kod_importu)` istnieje więcej niż jeden aktywny produkt;
taką grupę **pomiń** (licznik `skip`) i zaraportuj w `selly_sync_log` (osobny licznik albo wpis w `sample_errors`).
To **świadome odstępstwo** — produkcja wysyła i wpada w pętlę (pomiar 23.09: 80 grup / 174 produkty / 76 z różnymi
cenami lub stanami, wszystkie z mapowaniem w Selly — backlog #108). Rozdzielenie grup w danych to osobna decyzja
Ani; **tej karcie nie wolno ruszać danych**.

**2. Zależność od I15.4 ZDJĘTA — karta startuje od razu.** Moduł dostępności (`availability_sync`) portujesz
w całości, ale **nie podpinasz go** do stagingu: punkt wpięcia („zmiana dostępności → odśwież CSV i wyślij deltę")
dołoży karta I15.4, która ma ten obszar na własność. Wystaw jawną funkcję (np. `zadajOdswiezenie(db, dostawca)`)
i opisz w „Do koordynatora”, jak I15.4 ma ją zawołać.

**3. Zależność od I15.3 ZDJĘTA — z drobną decyzją do podjęcia w planie.** Produkcja uruchamia generator CSV
jako OSOBNY PROCES (`execFileSync(process.execPath, ['generate_selly_export.cjs'])`), bo tam to samodzielny skrypt.
W odbudowie generator jest modułem (`selly/generator-csv.ts`), więc naturalny port to **wywołanie funkcji w tym
samym procesie**. Rekomendacja koordynatora: wywołanie w procesie, opisane jako świadome odstępstwo (prostsze,
bez zależności od polecenia CLI z karty I15.3, bez kosztu startu Node'a). Jeśli uznasz, że osobny proces jest
istotny dla zachowania (np. izolacja błędu albo pamięć) — WRÓĆ z pytaniem.

**4. Kolejność wobec I15.3:** karty idą równolegle; ty nie ruszasz `generator-csv.ts`, tylko go wołasz.
