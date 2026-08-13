SELECT cena_zakupu FROM products WHERE status='aktywny' AND cena_zakupu != CAST(cena_zakupu AS INTEGER) LIMIT 5;
