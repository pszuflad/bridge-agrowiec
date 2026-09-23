# I15.4a — fundament stagingu: migracja 012 (5 tabel), model, repozytoria

> **Stan:** ⬜ gotowe (może iść równolegle z falą A)
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #99, #103, #104, #105, #106, #107 (wg zakresu) · **Zależy od:** —
> **Ticket:** —

Założona przez koordynatora ticketem `123-DOCS-podzial-i15-4`, 2026-09-23 — **podział dawnej karty I15.4** (665 linii
`staging_policy.cjs`, 5 nowych tabel, podmiana rdzenia importu to za dużo na jeden przegląd; decyzja użytkownika 23.09).
Plan całej iteracji: `docs/rebuild-roadmap.md`, blok „Iteracja 15”. Materiał wspólny: wejścia w katalogach kart.

## Zakres
Sam fundament, **bez zmiany zachowania importu** — dzięki temu można go zmergować i wdrożyć niezależnie od
reszty toru stagingu.

- **Migracja `012`** (numer zarezerwowany), definicje **bajt w bajt** z `git show 88fa31c:db/schema.sql`:
  - `staging_matches` (#99) — świadome dopasowania,
  - **indeks unikalny** `staging_one_current_product ON staging_items(dostawca, kod)` (#99) **poprzedzony
    sprzątaniem duplikatów** (zostaje `MAX(id)` per `dostawca, kod` — D5; na produkcji to no-op),
  - `supplier_feed_state`, `supplier_feed_versions`, `product_absence_checks` (#103 — bezpieczeństwo źródła,
    dowody nieobecności),
  - `product_auto_suspensions` (#104 — automatyczne wstrzymania odróżnione od ręcznych),
  - `staging_absence_decisions` + indeks unikalny `staging_absence_one_choice` (#106 — decyzje o nieobecnych
    kartach, tylko gdy `selected_source_code` niepuste).
  Migracja MUSI być idempotentna: na produkcji wszystkie te tabele już istnieją (por. wzorce z `011` i `013`).
- **Model Drizzle** (`db/schema.ts`) dla sześciu nowych tabel.
- **Repozytoria** — funkcje odczytu i zapisu tych tabel, bez logiki decyzyjnej (tę wnoszą I15.4b i I15.4c).
  Ustal nazwy i sygnatury tak, żeby obie karty mogły je wołać bez zmian w tym pliku, i opisz je w „Do koordynatora”.
- Testy migracji na trzech bazach: świeża, kopia `db/snapshot.db`, baza symulująca produkcję (tabele już są).

## Pliki (wyłączna własność)
`rebuild/backend/src/schema/…` → konkretnie: `rebuild/schema/012_*.sql`, `rebuild/backend/src/db/schema.ts`
(tylko nowe tabele stagingu), nowe repozytorium tych tabel, testy migracji.
NIE: `import/tk.ts` i logika importu (I15.4b), akceptacja i trasy (I15.4c), `legacy/**` (I15.2).

## Decyzje
**Decyzje użytkownika (całe I15, zgodnie z rekomendacją):** D1 triggery jako migracja odporna na istniejące obiekty ·
D2 poprawki danych z września bez migracji (odświeżenie stagingu kopią produkcji) · D3 Staging v2 przenosimy ·
D4 błędny EAN = błąd blokujący akceptację (zastępuje 14i) · D5 skrypt reconcile nie przenosimy.
⭐ **Produkcja zamrożona — Ania skończyła 23.09 i czeka na nową wersję do testów. Źródło prawdy: `origin/main`
na commicie `88fa31c` (23.09 13:00).** Nowy commit z kodem na `main` = ZATRZYMAJ SIĘ i zgłoś użytkownikowi.

Numer migracji `012` zarezerwowany przez koordynatora — nie bierz innego.


## Dowiezione
—

## Do koordynatora
—
