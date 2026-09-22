# Wejście dla PR.6 od ticketu 97 (PR.2) · 2026-09-22

Dotyczy `docs/przeglad-12-widokow.md` §8 (Analityka), pytanie 12.3.

- **Stan po tickecie 97:** nagłówek `/analityka` pokazuje teraz cztery kafle jak na produkcji —
  Dostawcy / EAN wspólne / Pozycje unikalne / Snapshoty — zamiast dotychczasowych
  „Produkty / Dostawcy / Śr. marża / Staging oczekujące”. Odstępstwo O-10a-1 zamknięte.
- **Propozycja pozycji do przeglądu (§8):** poproś Anię o porównanie czterech kafli nagłówka
  z produkcją — etykiety i kolejność (Dostawcy, EAN wspólne, Pozycje unikalne, Snapshoty) oraz
  liczby. Zwróć uwagę, że kafle liczą CAŁOŚĆ i nie reagują na pasek filtrów nad tabelą (to
  zgodne z produkcją — odstępstwo O-10a-2, nie do zgłoszenia jako błąd).
- **Pułapka do wypunktowania:** kafle „EAN wspólne” i „Pozycje unikalne” liczą wiersze z tras,
  które mają `LIMIT 1000` w backendzie (jak produkcja) — przy więcej niż 1000 pozycjach kafel
  pokaże najwyżej 1000, nie prawdziwą liczbę. To zachowanie 1:1 z produkcją, nie błąd rebuild.

Źródło: `docs/tickets/97-FEATURE-kafle-kpi-analityki/{plan.md,raport.md}`.
