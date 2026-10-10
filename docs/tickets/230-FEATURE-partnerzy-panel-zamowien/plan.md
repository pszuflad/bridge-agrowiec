# 230 — panel zamówień partnera: lista i szczegóły, tylko odczyt (PRT-7.6a)

> Status: Approved (użytkownik 2026-10-10: kolejny ticket po wydaniu 229, pracujemy autonomicznie) · Gałąź: `claude/peaceful-gates-a8yebr`

Karta: `docs/karty/PARTNERZY/` · poziom 7 · zależy od 228 (model zamówień) i 229 (odbiór e-mail). Pierwsza, niezależna od Selly i numeru katalogowego część PRT-7.6:
operator widzi w Bridge zamówienia, które przyszły od partnera. Statusy, błędy importu do rozwiązania i powiązanie z Selly dojdą z PRT-7.4/7.5.

## Zakres
- Backend: `GET /api/partnerzy/:id/zamowienia` (lista, najnowsze pobrane pierwsze, `limit`/`offset`) i `GET /api/partnerzy/:id/zamowienia/:zamowienieId` (szczegóły z pozycjami,
  dostawą i fakturą; 404, gdy zamówienie jest innego partnera). Za `requireAuth`. W odpowiedziach NIE ma `surowy_xml` ani skrótu (ciężkie i dublują sparsowane pola).
- Frontend: sekcja „Zamówienia” na `/partnerzy/:id` (lista z numerem partnera, datą, krajem, statusem, liczbą pozycji; rozwijane szczegóły z pozycjami i adresem dostawy).
- Tylko odczyt: żadnych akcji na zamówieniach (statusy i wysyłka do Selly to 7.4/7.5).

## Decyzje (samodzielnie)
- Trasy poza `contract/openapi.yaml` i bez fixtures (jak reszta `/api/partnerzy*`, ticket 209).
- Liczba pozycji w liście liczona w SQL (bez pobierania pozycji).
- Dane osobowe klienta końcowego (`dostawa`) pokazujemy tylko w szczegółach, nie na liście.

## Kontrakt i fixtures
Brak (nowe trasy poza `openapi.yaml`, zadne istniejące nie zmienia się).

## Testy
Backend `partnerzy.zamowienia-trasy.test.ts` (auth, lista, limit, szczegóły, 404, izolacja partnerów, brak surowego XML); frontend `partnerzy.zamowienia.test.tsx` (MSW od zera: lista, pusty stan, błąd, rozwinięcie szczegółów).

## Poza zakresem
Statusy/akcje (7.4–7.5), „Odbierz teraz” (wymaga wstrzyknięcia IMAP do aplikacji), zamówienia z FTP (7.2), wyszukiwanie/filtry.

## Definition of done
- [ ] Bramki backendu i frontendu zielone, PR `MERGEABLE`, gałąź zsynchronizowana z `develop`
