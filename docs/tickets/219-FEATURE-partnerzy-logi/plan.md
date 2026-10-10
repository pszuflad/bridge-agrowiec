# 219 — logi operacji partnera i retencja 30 dni (PRT-4.2)

Karta: `docs/karty/PARTNERZY/` · poziom 4 · zależy od 208, 217. (Robione przed PRT-4.1, bo scheduler zapisuje wynik w logu.)

## Zakres
Migracja `027_partner_logi.sql` (`partner_logi`, `partner_error_log`, dwa indeksy); `src/partnerzy/logi.ts` (`zapiszOperacje`, `zapiszBlad`, `zapiszWynikGenerowania`, `wyczyscLogi`, `pobierzLogi`, `pobierzBledy`);
trasy `GET /api/partnerzy/:id/logi` i `GET /api/partnerzy/:id/error-log[?poziom=blad|ostrzezenie]` (`limit` ≤ 1000, `offset`), poza `openapi.yaml` jak reszta `/api/partnerzy`.

## Reguły (z karty)
- **Jedna linia na operację** w `partner_logi` (np. „Wygenerowano 1 plik: p_AT.csv (3000 pozycji); błędów: 1; ostrzeżeń: 1”); błędy kalkulacji i ostrzeżenia osobno w `partner_error_log` ze szczegółami.
- Retencja **30 dni** — czyszczenie przy każdym zapisie wyniku generowania (wszystko w jednej transakcji).
- Limit 200 błędów szczegółowych na przebieg + linia „… i N kolejnych”, żeby tysiąc braków wagi nie zalał logu.
- Logi kasują się razem z partnerem (`ON DELETE CASCADE`).

## Zmiana zachowania produkcji
Brak — nowe puste tabele i trasy odczytu; nikt jeszcze nie zapisuje do logów (scheduler: PRT-4.1).

## Testy
`test/partnerzy.logi.test.ts` — format linii, błędy vs ostrzeżenia, limit, retencja, kaskada, trasy. Bilans migracji: 53 tabele, 27 indeksów.
