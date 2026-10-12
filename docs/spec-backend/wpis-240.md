# Wpis 240 — słowniki zamówień Selly (tylko odczyt)

`KlientSelly.listOrderStatuses/listOrderPayments/listOrderDeliveries` → `GET /api/order_statuses|order_payments|order_deliveries`. W `METODY_ODCZYTU` (przechodzą w `SELLY_TRYB=tylko-odczyt`, blokuje je `wylaczony`). Trasa `GET /api/partnerzy/selly/slowniki-zamowien` oddaje `{statusy, platnosci, dostawy}` (503 bez klienta, 502 przy błędzie Selly). Poza `contract/openapi.yaml`, jak reszta tras partnerów.
