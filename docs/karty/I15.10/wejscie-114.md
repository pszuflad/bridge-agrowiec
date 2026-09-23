# Wejście dla I15.10 od ticketu 114 (koordynator) · 2026-09-23 — ze specyfikacji Selly od Ani + #101

1. **Potwierdzenie zakresu:** `availability_sync.cjs` (22.09) — brak w pełnej wiarygodnej ofercie → wstrzymanie,
   wyzerowanie stanu i **wykluczenie z CSV**; pewny powrót przywraca tylko produkty wstrzymane automatycznie
   (ręczne blokady zostają); inny dostawca z tą samą oponą zachowuje swoją potwierdzoną dostępność.
2. **#101 — sprawdzenie po stronie Selly.** Pomiar z 23.09: w bazie Bridge **zero** produktów z pustym
   `blokowane_formy_platnosci`, więc zgłoszenie Ani („nowe produkty mają to pole puste") dotyczy najpewniej
   **karty produktu w Selly**. Karty I15.6 i I15.7 są już zamknięte, więc sprawdzenie przejmuje ta karta:
   czy payload Toru 1/Toru 2 (`mapper-v2.buildProductPayload`, 21 cech) w ogóle niesie blokady form płatności.
   **Nie naprawiaj** — zmierz, opisz w karcie i zgłoś koordynatorowi; naprawa to decyzja użytkownika.
