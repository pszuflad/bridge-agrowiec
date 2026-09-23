# Wejście dla TEST.1 od ticketu 139 (139-FEATURE-montaz-dostepnosci) · 2026-09-23 — jak odświeżanie dostępności objawia się przy testach

**Zmieniliśmy:** `src/server.ts` teraz montuje moduł dostępności — import, który zmienił
dostępność produktu, może zaraz regenerować plik CSV Selly.

**Polecenie:** uruchom staging i zrób import, który zmienia dostępność (np. produkt wraca na
stan po tym, jak był niedostępny). Sprawdź log startu procesu.

**Rezultat zależy od `SELLY_TRYB` na środowisku:**
- `SELLY_TRYB=wylaczony` (dzisiejszy staging) — w logu startu jest
  `[dostepnosc] niezamontowana (SELLY_TRYB=wylaczony) …`, żaden import nie regeneruje CSV.
  To jest **oczekiwane**, nie błąd.
- `SELLY_TRYB=pelny` lub `tylko-odczyt` — import, który zmienił dostępność, regeneruje plik pod
  `SELLY_CSV_DIR` i woła Tor 1.

**Do Twojej decyzji:** żadnej — to jest opis zachowania do rozpoznania, nie rozbieżność z logiką
biznesową. Ważne tylko, żeby wiedzieć, KTÓRY wariant jest na środowisku, zanim ocenisz, czy
„nic się nie stało" znaczy „zepsute" czy „bramka działa zgodnie z zamierzeniem".
