# 274 — przesyłka partnerów: reguła palety Erwina

Decyzja (Ania, 2026-10-15): wzorujemy się na starym systemie (opcja B), ale na naszych kolumnach paczki (`dlugosc`, `szerokoscPaczki`, `wysokosc`) i wzorze Erwina (szerokość ≤55 → 60, ≤80 → 80, wysokość +10 cm). Akceptacja na przykładach z prawdziwych stawek GEIS (plik `GEIS_tabele_13_krajow1.xlsx`, odczyt 05.10.2026).

Przykład (stawka × 1,44 paliwa + myto 9,92 € + pakowanie 15 €; wagi rzeczywiste założone):

| Opona | Kraj | Stawka dziś → po | Razem dziś → po |
|---|---|---|---|
| 10.0/75-15.3 | DE | 25 → 42 | 60,92 → 85,40 € |
| 340/55-16 | DE | 40 → 42 | 82,52 → 85,40 € |
| 500/45-22.5, 480/70R30 | DE | bez zmiany | bez zmiany |
| 10.0/75-15.3, 340/55-16 | FR | 103 → 163 | 173,24 → 259,64 € |
| 480/70R30 | FR | 231 → 316 | 357,56 → 479,96 € |

Zmiany: `transport.ts` (reguła), `podglad-przesylki.ts`, `symulacja-ceny.ts`, frontend (wymiary z paletą w „Symulacji ceny”), testy (`partnerzy.transport`, `.geis-panel`, `.generator`). Skutek: ceny części produktów w cennikach partnerów wzrosną przy najbliższej publikacji (co 60 min po wdrożeniu). Do sprawdzenia po wdrożeniu w „Symulacji ceny”: że paliwo w bazie to 44 (%), myto 9,92 i pakowanie 15 € (ustawienia kraju partnera).
