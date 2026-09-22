# I15.4 — Staging v2 — backend: importer, akceptacja z kontrolą aktualności, trasy review/resolve

> **Stan:** ⬜ po I15.2 (fala 3)
> **Iteracja:** 15 — domknięcie zakresu produkcji · **Wpisy backlogu:** #99 · **Zależy od:** I15.2 (I15.1 pośrednio)
> **Ticket:** —

Założona przez koordynatora ticketem `104-DOCS-plan-i15`, 2026-09-22. Plan całej iteracji: `docs/rebuild-roadmap.md`, blok „Iteracja 15”.

## Zakres
Port `staging_policy.install()` i `registerRoutes()` z `origin/main` (`mirror/backend/staging_policy.cjs`, 298 l.;
wpięcie w `mirror/backend/index.cjs`) do rdzenia importu odbudowy (`rebuild/backend/src/import/tk.ts` i repozytoria/trasy
stagingu):
- **migracja `012`**: sprzątanie duplikatów `staging_items` (zostaje `MAX(id)` per `dostawca, kod` — D5), indeks
  unikalny `staging_one_current_product ON staging_items(dostawca,kod)`, tabela `staging_matches`. Odporna na to, że na
  produkcji wszystko już jest (tam sprzątanie = no-op);
- dodawanie zgłoszenia zastępuje poprzednie tej samej pary; edycja przelicza status EAN; akceptacja
  (`checkAcceptance`) — cztery blokady 409 z komunikatami **dosłownie**: zastąpione, „stary import — odśwież cennik”
  (brak `_policyVersion`), nierozstrzygnięte dopasowanie, błędny EAN (D4); atomowość;
- nowy `importer()` (odpowiednik `tk.ts`): świeże ceny i stany, dopasowanie po EAN tylko do jednej zgodnej opony
  (marka/model/rozmiar + indeksy/DOT — `compatibility()`), ochrona ręcznych poprawek, wycofania, `historia_cen`;
- nadpisanie `assignKodImportu` (grupa produktów tylko przy zgodności);
- trasy `GET /api/staging/:id/review`, `POST /api/staging/:id/resolve` → `contract/openapi.yaml` + nagrania z oryginału.
⚠ Testy charakteryzacyjne importu zamrażały STARY `tk()` — przepnij je na nowy oryginał (`origin/main`), nie usuwaj.
Rozjazdy wobec starych testów opisz jako skutek #99, nie „naprawiaj” w stronę starego zachowania.
⚠ **Cutover i staging:** zgłoszenia bez `_policyVersion` (stary import) są nieakceptowalne — na produkcji po reconcile
22.09 ich nie ma, ale baza stagingu (snapshot) je ma. Opisz skutek i wejście dla koordynatora (odświeżenie bazy
stagingu — D2) i dla I15.9.
Karta jest duża — jeśli w planie wyjdzie naturalny podział (np. importer vs akceptacja+trasy), zaproponuj go
koordynatorowi, zamiast robić wszystko naraz.

## Pliki (wyłączna własność)
`rebuild/backend/src/import/tk.ts` i moduły importu poza `legacy/`, repozytoria i trasy stagingu, `rebuild/schema/012_*.sql`,
`db/schema.ts` (tylko staging), `contract/openapi.yaml` (dwie trasy), testy importu/stagingu. NIE: `legacy/**` (I15.2),
frontend stagingu (I15.5).

## Decyzje
**Decyzje użytkownika 2026-09-22 (całe I15, zgodnie z rekomendacją):** D1 triggery jako migracja odporna na
istniejące obiekty · D2 poprawki danych z września bez migracji (odświeżenie stagingu kopią produkcji) · D3 Staging v2
przenosimy · D4 błędny EAN = błąd blokujący akceptację (wersja Ani zastępuje 14i) · D5 skrypt reconcile nie przenosimy.
**Produkcja zamrożona od 2026-09-22** — źródło prawdy to `origin/main` na commicie `7d6cfc9`; nowy kod na `main` = zgłoś.

Numer migracji `012` zarezerwowany.

## Dowiezione
—

## Do koordynatora
—
