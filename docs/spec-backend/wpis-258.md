# Wpis 258 — narzuty startowe partnerów

Stary panel narzutów partnerów miał 5 % dla każdej pary dostawca × kraj (u Adtyres i Fuhrmanna) oraz 7 reguł marek w Niemczech (Rolnicze: Alliance/CEAT 2 %, Vredestein 3 %). W Bridge wchodzi to jako dopłata kraju (`partner_kraje.narzut_proc` = 5, tylko gdzie było 0) i reguły `partner_narzuty` z warunkiem `dostawca` = KOD dostawcy (`products.dostawca`), nie nazwa. Krok `2026-10-13-partnerzy-narzuty-startowe`; szczegóły: `docs/tickets/258-DATA-partnerzy-narzuty-startowe/plan.md`.
