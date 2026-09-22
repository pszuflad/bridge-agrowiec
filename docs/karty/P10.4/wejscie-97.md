# Wejście dla P10.4 od ticketu 97 (PR.2) · 2026-09-22

Dotyczy `docs/instrukcja-testow-I10.md:171` i `:472` — opis czterech kafli nagłówka Analityki.

**Zgłosiłaś:** pytanie 12.3 z przeglądu 12 widoków (§8) — kafle KPI w Analityce wyglądają inaczej
niż na produkcji.

**Jest teraz:** nagłówek `/analityka` pokazuje cztery kafle jak na produkcji — **Dostawcy / EAN
wspólne / Pozycje unikalne / Snapshoty** — zamiast dotychczasowych „Produkty / Dostawcy /
Śr. marża / Staging oczekujące" (`:171`, `:472`). Odstępstwo O-10a-1 zamknięte, ticket
`97-FEATURE-kafle-kpi-analityki`.

**Sprawdź:**
- etykiety i kolejność kafli: Dostawcy, EAN wspólne, Pozycje unikalne, Snapshoty;
- „Dostawcy" liczy dostawców z paska filtrów (ten sam zestaw, co lista w filtrze „Dostawcy");
- „EAN wspólne" i „Pozycje unikalne" to liczby wierszy z zakładki **EAN i ceny** (karty 2.x) —
  powinny zgadzać się z tym, co widać po otwarciu tej zakładki;
- „Snapshoty" to liczba migawek historii cen — powinna rosnąć wraz z upływem dni po wdrożeniu;
- kafle NIE reagują na pasek sześciu filtrów (to zgodne z produkcją, nie błąd);
- przy pustych/błędnych odpowiedziach z serwera: „Dostawcy" pokazuje „—", pozostałe trzy „0".

Źródło: `docs/tickets/97-FEATURE-kafle-kpi-analityki/{plan.md,raport.md}`.
