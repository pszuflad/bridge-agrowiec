# Wpis 230 — panel zamówień partnera (lista i szczegóły, tylko odczyt)

Ticket `230-FEATURE-partnerzy-panel-zamowien` (PRT-7.6a). Nowa funkcjonalność, nie odtworzenie produkcji.

- `GET /api/partnerzy/:id/zamowienia` — zamówienia odebrane od partnera, najnowsze pobrane pierwsze, `limit` (domyślnie 100, max 1000) i `offset`; w wierszu m.in. `numerPartnera`, `numerWlasny`
  (NULL do wysyłki do sklepu), `status`, `krajDostawy`, `liczbaPozycji` (liczona w SQL). Bez `surowy_xml` i bez danych dostawy.
- `GET /api/partnerzy/:id/zamowienia/:zamowienieId` — szczegóły: pozycje, `dostawa`, `faktura`; 404, gdy zamówienie jest innego partnera. Bez `surowy_xml`, skrótu i surowych JSON-ów.
- Za `requireAuth`, poza `contract/openapi.yaml` i bez fixtures (jak reszta `/api/partnerzy*`). Tylko odczyt: statusy i wysyłka do Selly to PRT-7.4/7.5.
- Pułapka: Drizzle renderuje kolumny w podzapytaniu `sql\`…\`` bez kwalifikatora tabeli, więc `id` zasłaniał tabelę zewnętrzną i `liczbaPozycji` wychodziło błędnie (1 zamiast 2).
  Podzapytanie ma jawne nazwy tabel; pilnuje tego test `partnerzy.zamowienia-trasy.test.ts`.
- Panel: sekcja „Zamówienia od partnera” na `/partnerzy/:id` (`pages/partnerzy/ZamowieniaPartnera.tsx`), szczegóły dopiero po rozwinięciu wiersza.
