# 241 — PARTNERZY: panel słowników zamówień Selly

Przycisk „Słowniki zamówień Selly" w widoku /partnerzy: po kliknięciu pobiera GET /api/partnerzy/selly/slowniki-zamowien (ticket 240) i pokazuje statusy, płatności i dostawy w tabelach (wszystkie klucze rekordu, bo kształt odpowiedzi Selly nieustalony). Tylko frontend, tylko odczyt, bez zapytania przy wejściu w widok. Testy: frontend/test/partnerzy.test.tsx.
