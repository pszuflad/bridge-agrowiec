# Wejście dla I15.9 od ticketu 122 (I15.3) · 2026-09-23 — blokowane formy płatności (katalog + CSV)

**Co zmieniono:** w `/katalog` przybyła kolumna „Blokowane formy płatności” (widoczna domyślnie,
retrofit dla zastanych zapisów wyboru kolumn); w pliku CSV dla Selly przybyła 60. kolumna
`Blokowane-formy-platnosci`; nazwy kategorii w CSV zmieniły się na pełne („Opony rolnicze” zamiast
„Rolnicze” itd.).

**Polecenie:** wejdź w `/katalog`, znajdź dowolny produkt dostawcy MO1–MO5/MO7–MO10 → kolumna
pokazuje listę zablokowanych form płatności (np. „Płatność odroczona, Kredyt kupiecki” — dokładna
treść zależy od dostawcy). Produkt dostawcy **MO6 (Uniglory)** lub dostawcy spoza mapy → „—”.

**Rezultat:** wartość zgadza się z tym, co dziś pokazuje produkcja w tej samej kolumnie.

⚠ **Fakt do instrukcji, nie do testu API:** pole `blokowaneFormyPlatnosci` **NIE wychodzi** z
`GET /api/products` (ani z produkcji, ani z odbudowy — pomiar w `docs/karty/I15.3/karta.md`,
sekcja „Zakres”). Kolumna w `/katalog` liczy wartość **w przeglądarce** z mapy MO→formy płatności,
tak samo jak robi to dziś produkcja (`payment-blocks-injection.js`). Jeśli instrukcja dla Ani ma
kroki weryfikujące dane przez API/curl — to pole nie da się tak sprawdzić, tylko wizualnie w UI.
