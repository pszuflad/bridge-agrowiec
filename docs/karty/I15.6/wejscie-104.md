# Wejście dla I15.6 od ticketu 104 (koordynator) · 2026-09-22 — odpowiedzi Ani, runda 3

KROK 0 z karty jest ROZSTRZYGNIĘTY odpowiedziami Ani (`docs/pytania-do-ani-2026-09-22.md`, sekcja „Co Ania odpowiedziała”):
- **1.1:** „skończona i działa” → port 1:1 ze stanu `origin/main` (`7d6cfc9`).
- ⭐ **PRZYPOMNIENIE DLA UŻYTKOWNIKA (prośba Ani):** Ania przygotuje podsumowanie działań i logiki synchronizacji
  Selly — **przed planowaniem tej karty zapytaj użytkownika, czy je już ma**; jeśli tak, dołącz do materiałów
  (nie zastępuje kodu — kod jest źródłem prawdy, podsumowanie pomaga zrozumieć zamiar).
- **1.2:** Ania używa wszystkich torów: Tor 1 (delta cen/stanów po API), Tor 2 (nocny pełny per dostawca, rotacja),
  CSV 6:00 (pobierany przez Selly o 12:00). Przycisków ręcznych nie wymieniła — zgodne z kodem (ich nie ma).
- **1.3 (nowe produkty, #68):** Ania nie wie, czy auto-create działa („w teorii jest to zrobione”). **Ustal z kodu
  `origin/main`**, czy ścieżka zakładania produktów (discovery `createProduct` + Tor 2 „auto-create” w `sync_full`) jest
  dziś sprawna, i opisz wynik w karcie. Port 1:1 w obu przypadkach; jeśli nie działa — raport do koordynatora
  (ewentualna naprawa to decyzja użytkownika).
- **1.4:** mylące statusy (#69/#70) — brak odpowiedzi → **1:1**. Usuwanie produktu z Selly → **#100**, rekomendacja:
  po cutoverze — **poza zakresem tej karty**.
- **#101** (puste blokady płatności u nowych produktów): jeśli pomiar wskaże, że pole jest puste po stronie Selly
  (produkty zakładane bez tej cechy), zakres trafia tutaj albo do I15.7 — koordynator dopisze decyzję.
