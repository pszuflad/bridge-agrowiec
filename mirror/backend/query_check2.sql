SELECT COUNT(*) FROM products WHERE status='aktywny' AND cena_sprzedazy != CAST(cena_sprzedazy AS INTEGER);
