# Wpis do spec-backend od ticketu 155 · 2026-09-25

**Sekcja:** §2 (import — zapis produktu).

**NOWA logika biznesowa, NIE potwierdzenie zachowania oryginału.** Produkcja (`deminified/`,
`mirror/backend/`) nie ma żadnego mechanizmu dziedziczenia wagi po podobieństwie produktów —
research do ticketu 155 to potwierdził (grep po backlogu/kartach: brak wcześniejszych wpisów).
Jedyny pokrewny, istniejący mechanizm to `waga_pamiec` (port `applyWagaPamiec`,
`src/import/silnik/bridge-ext.ts`), który pamięta wagę PO TYM SAMYM `kod` przy ponownym
imporcie — inny klucz, inny cel.

**Od ticketu 155** (`155-FEATURE-dziedziczenie-wagi-po-rozmiarze`, decyzja użytkownika,
2026-09-25): gdy produkt (import przez `zatwierdzPozycjeStagingu`/`dodajProduktyBulk`, albo
ręczne dodanie przez `POST /api/products` — ta sama ścieżka co bulk) trafia z pustą lub zerową
wagą, a w bazie jest już inny produkt tej samej marki + znormalizowanego rozmiaru
(szerokość/profil/średnica/konstrukcja) + bieżnika (tolerancyjnie, gdy dane bieżnika brakuje po
którejkolwiek stronie) z wypełnioną wagą — nowy produkt dziedziczy NAJWYŻSZĄ wagę spośród
pasujących kandydatów. Logika: `src/import/dziedziczenieWagi.ts`, wołana w `akceptacja.ts` i
`bulk.ts` TUŻ PO `applyWagaPamiec` — priorytet „pamięć wagi / ręczna edycja wygrywa" wynika z
kolejności wywołań, nie z dodatkowego sprawdzenia. Nowa kolumna `products.waga_auto_uzupelniona`
(migracja `014_waga_auto_uzupelniona.sql`, nullable) oznacza wagę uzupełnioną tą drogą; reset na
`false` następuje przy ręcznej edycji pola `waga` (`repos/products.ts::aktualizujProdukt`).
Wsteczne dociągnięcie dla istniejących produktów z pustą/zerową wagą: skrypt CLI
`npm run dziedzicz-wage` (`scripts/dziedzicz-wage.ts`), uruchamiany ręcznie, nie przy starcie
serwera.

Kontrakt: `GET/POST/PUT/PATCH /api/products` dokładają opcjonalne pole `wagaAutoUzupelniona:
boolean` — rozszerzenie, nie łamanie istniejącego kształtu. Fixtures zaktualizowane.

Szczegóły: `docs/tickets/155-FEATURE-dziedziczenie-wagi-po-rozmiarze/`.
