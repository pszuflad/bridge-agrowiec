# Podsumowanie — wykluczenie produktów „wstrzymanych" z eksportu CSV Selly

**Data:** 2026-07-31
**Plik:** `generate_selly_export.cjs`

Eksport CSV pobierał wszystkie produkty (`SELECT * FROM products ORDER BY id`), przez co do Selly trafiały też 193 pozycje `status='wstrzymany'`. Zmieniono zapytanie na `WHERE status = 'aktywny'`, więc plik zawiera teraz tylko produkty aktywne. Po regeneracji plik ma **7018 wierszy** (było 7211), status karty = OK. Filtr obowiązuje zarówno automat 6:00, jak i przycisk „Wygeneruj CSV teraz". Backup: `generate_selly_export.cjs.bak_pre_filter_wstrzymany_20260731_...` na serwerze + paczka kodu w Space.
