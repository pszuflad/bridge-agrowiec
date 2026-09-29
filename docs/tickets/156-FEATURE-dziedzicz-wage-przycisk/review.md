# 156-FEATURE-dziedzicz-wage-przycisk — Code review

> Reviewed: 2026-09-29
> Branch: feature/156-dziedzicz-wage-przycisk
> Diff: 10 plików, 2 commity

## BLOCKER

Brak.

## SHOULD-FIX

- [ ] `rebuild/frontend/src/pages/konfiguracja/katalog.ts:35` (`dziedziczWage`) — `zadanie()` woła `rzucGdyBlad()`, która robi `new Error(\`${status}: ${text}\`)` bez parsowania `{error: "..."}` z JSON-a (`rzucGdyBlad` w `src/lib/api.ts:95-100`). Test frontendowy (`konfiguracja.admin.test.tsx`, "pokazuje błąd...") sprawdza tylko tytuł toastu "Błąd dociągania wagi", nie treść opisu — realny komunikat użytkowniczki wyglądałby jak `500: {"error":"Baza niedostępna"}`, surowy JSON w toaście.
  - Reason: nie jest to regresja wprowadzona przez ten ticket (wzorzec `zadanie`/`rzucGdyBlad` jest współdzielony i tak samo zachowuje się gdzie indziej), ale skoro `wyczyscKatalog()` w tym samym pliku (linia ~30) świadomie parsuje `cialo.error` z odpowiedzi przed rzuceniem błędu, a nowy `dziedziczWage()` tego nie robi (bo idzie przez ogólny `zadanie()`), UX błędu jest tu gorszy niż w sąsiednim przycisku w tej samej sekcji.
  - Suggestion: rozważyć doprecyzowanie `description` w toaście błędu (np. spróbować `JSON.parse` treści błędu) albo świadomie zaakceptować niespójność i odnotować to w raporcie — obecnie nie jest to wspomniane jako świadoma decyzja.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/routes/maintenance.ts:212` — guard `if (!sqlite)` zwraca 500, ale `sqlite` jest w typie `ZaleznosciUtrzymania` opcjonalne (`sqlite?: BazaSqlite`) tylko formalnie — w praktyce serwer zawsze przekazuje realny `sqlite` (patrz `zrobKopieBazy` w tym samym pliku, które też zakłada jego obecność przez `sqlite?.pragma(...)`). Gałąź prawdopodobnie martwa w produkcyjnym kodzie, nieprzetestowana (nie ma testu na `sqlite: undefined`) — OK jako defensywny guard, ale warto rozważyć, czy nie usunąć niespójności typu (`BazaSqlite` vs `BazaSqlite | undefined`) w całym pliku przy okazji innego ticketu.
- [ ] `rebuild/frontend/src/pages/konfiguracja/Katalog.tsx:38-40` — treść toastu sukcesu (opis z licznikami) nie jest pokryta osobnym testem sprawdzającym liczby zero (np. wszystkie kandydaci dopasowani) — obecny test zawsze ma niezerowe liczniki we wszystkich kategoriach, co ukrywa ewentualny błąd w formatowaniu przy `0`. Drobne, bo logika formatowania jest trywialna (proste interpolacje).

## Plan compliance

Brak formalnego `plan.md` (ticket ustalony bezpośrednio z użytkowniczką, odnotowane w `raport.md`) — porównanie oparte o opis w raporcie.

### Done ✓
- Logika wydzielona ze skryptu CLI do `dziedziczWageWstecznie(db, sqlite)` — refaktor 1:1 (diff pokazuje identyczną kolejność kroków, te same liczniki, ta sama transakcja `sqlite.transaction`).
- Skrypt CLI (`scripts/dziedzicz-wage.ts`) po refaktorze produkuje identyczny komunikat konsolowy (te same nazwy pól, ta sama kolejność w zdaniu) i te same kody wyjścia (`process.exit(1)` przy braku `DB_PATH` — niezmienione).
- Nowa trasa `POST /api/products/dziedzicz-wage` z `requireAuth` i audytem `dziedziczenie_wagi_wsteczne`.
- Fixture + wpis w `openapi.yaml` — kształt odpowiedzi trasy (`ok`, `wszystkichKandydatow`, `zaktualizowano`, `pominietoOverride`, `pominietoBrakDanych`, `pominietoBrakDopasowania`) zgodny 1:1 z fixture i schematem `POSTProductsDziedziczWageOdpowiedz200`, oznaczone jako ręcznie pisany (wzorzec `usun-nieopony` zachowany).
- Przycisk „Dociągnij wagę" w zakładce Katalog, bez `window.confirm` (uzasadnione — operacja nie jest destrukcyjna), toast z wynikiem, unieważnienie `/api/products` po sukcesie.
- Testy backend (+4): auth, happy path z licznikami, priorytet ręcznej poprawki (override wygrywa nawet przy `waga: 0`), audyt z poprawną treścią `szczegolyJson`.
- Testy frontend (+3): wywołanie bez potwierdzenia + treść toastu, unieważnienie zapytań, obsługa błędu z backendu.

### Missing or deviating ✗
Brak zidentyfikowanych odchyleń od opisu w raporcie.

### Definition of done
- [x] Skrypt CLI zachowuje zachowanie sprzed refaktoru (transakcja, komunikat, kody wyjścia).
- [x] Nowa trasa działa i jest chroniona `requireAuth`.
- [x] Audit log zapisuje się poprawnie, `szczegoly` to obiekt liczników (JSON-owalny, brak pól, które mogłyby wywrócić `GET /api/audit-log`).
- [x] Fixture i openapi spójne z kształtem odpowiedzi.
- [x] Frontend: stan ładowania (`disabled`, tekst „Dociąganie…"), obsługa błędu (toast `destructive`), brak wycieku stanu między testami (mock resetowany w `zamockujApi()`).
- [x] Testy nietautologiczne, pokrywają priorytet override i happy path przez HTTP.

## Parallel-test concerns

None — all tests parallelizable (środowisko testowe tworzone per `describe` przez `stworzSrodowiskoTestowe()`, baza w katalogu tymczasowym zgodnie z konwencją repo; frontend używa współdzielonego MSW server z resetem handlerów między testami).

## Overall assessment

Czysty, mały refaktor + nadbudowa zgodna z konwencjami repo (wzorzec `usun-nieopony` dla nowej-logiki-nie-portu, ręczny fixture, audyt, brak `window.confirm` dla operacji nie-destrukcyjnej). Refaktor CLI jest wierny co do zachowania — sam skopiowano ciało funkcji bez zmian semantyki. Jedyna rzecz warta uwagi to niespójny UX komunikatu błędu względem sąsiedniego przycisku „Wyczyść katalog" w tym samym pliku, ale nie jest to regresja wprowadzona przez ten ticket i nie blokuje merge'a. Testy sensowne i nietautologiczne, pokrywają zarówno happy path przez HTTP, jak i priorytet ręcznej poprawki.
