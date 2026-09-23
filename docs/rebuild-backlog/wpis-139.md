# Backlog — wpisy ticketu 139 (`139-FEATURE-montaz-dostepnosci`) · 2026-09-23

Karta **I15.10b** (montaż modułu dostępności w `server.ts`). Nie jest to triaż produkcji — ten
plik opisuje jedno świadome odstępstwo od oryginału wniesione samym montażem i jeden istniejący
dług, który montaż czyni po raz pierwszy osiągalnym automatycznie. Nawiązanie do wpisu
`docs/rebuild-backlog.md` `#104` (dostępność): sekcja „Status" tego wpisu poprawiona w miejscu
— część „`availability_sync`" jest teraz dowieziona w całości (moduł I15.10, ticket 119; montaż
I15.10b, ticket 139).

### #139.1 · 2026-09-23 · [BACKEND] · montaż modułu dostępności w `server.ts` — bramka `SELLY_TRYB` zamiast ścieżki bazy

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-23 (odbudowa; oryginał nie ma odpowiednika montażu, patrz niżej) |
| **Kategoria** | BACKEND |
| **Pliki** | `rebuild/backend/src/server.ts`; porównanie: `mirror/backend/staging_policy.cjs:131-134` |
| **Commit** | ticket `139-FEATURE-montaz-dostepnosci` (karta I15.10b) |
| **Do nowej wersji?** | ✅ **TAK — wdrożone** (decyzja D1, `docs/tickets/139-FEATURE-montaz-dostepnosci/plan.md`) |
| **Status** | ✅ **wdrożone 2026-09-23, ticket 139.** Bramki lint/typecheck/build/test zielone (112/1837), nowy test w `test/server.montaz-dostepnosci.test.ts`. |

**Opis biznesowy.** Do tego ticketu `zadajOdswiezenie()`, wołane przez importer na końcu każdego
przebiegu (I15.4b, `import/polityka/fabryka.ts:988`), było cichym no-opem — moduł dostępności
(`src/selly/dostepnosc.ts`, I15.10) istniał, ale nikt go nie rejestrował. Ten ticket montuje
instancję w `server.ts`: ta sama `discoverySelly`, co dostaje `stworzApp`, rejestracja przez
`ustawDomyslnaSynchronizacjeDostepnosci(...)`, wyrejestrowanie w `zamknij()`. Od teraz import,
który zmienił dostępność, realnie generuje CSV i woła Tor 1 Selly — ale tylko gdy `SELLY_TRYB`
nie jest `wylaczony`.

**Szczegół techniczny (dla rebuildu).** **To jest świadome odstępstwo od oryginału w KRYTERIUM
bramki**, nie w kierunku. Produkcja bramkuje po ścieżce bazy: `refreshAvailability()`
(`mirror/backend/staging_policy.cjs:131-134`) wychodzi natychmiast, gdy
`path.resolve(db.name) !== '/home/admin/private_apps/bridge/data.db'` — każda kopia produkcji
(w tym staging) milczy, wyłącznie prawdziwa produkcyjna baza odświeża dostępność. Odbudowa nie
hardkoduje ścieżki produkcyjnej bazy (nie ma jej skąd wziąć — proces jest deployowany identycznie
na staging i produkcję), więc bramkuje po `SELLY_TRYB` (`env.ts`): domyślnie i na stagingu
`wylaczony` → zachowanie identyczne z dotychczasowym (ciche no-op), na produkcji `pelny` →
odświeżanie działa. Kierunek ten sam (kopie milczą, produkcja działa), kryterium inne. Decyzja
D1, pełne uzasadnienie i odrzucone warianty: `docs/tickets/139-FEATURE-montaz-dostepnosci/plan.md`.

**Rekomendacja (moja).** ✅ **nanieść — już naniesione, nic do zrobienia.** Odstępstwo jest
udokumentowane w kodzie (komentarz przy montażu w `server.ts`) i w planie ticketu; nie wymaga
dalszej decyzji użytkownika. Jedyne, co zostaje do sprawdzenia, to konfiguracja `.env` przy
deployu — patrz `#139.2` niżej i `raport.md` sekcja „Breaking changes".

### #139.2 · 2026-09-23 · [DEPLOY][BEZPIECZEŃSTWO] · `SELLY_CSV_DIR` domyślnie wskazuje katalog produkcyjny — teraz osiągalny automatycznie, nie tylko ręcznie

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-23 (dług istnieje od I15.3, ten ticket czyni go automatycznie osiągalnym) |
| **Kategoria** | DEPLOY + BEZPIECZEŃSTWO |
| **Pliki** | `rebuild/backend/src/config/env.ts:138-141` (domyślka `SELLY_CSV_DIR`); trasa istniejąca od I15.3: `src/routes/selly-generate-csv.ts` (`POST /api/selly/generate-csv`) |
| **Commit** | — (brak zmiany kodu w tym tickecie; D1 świadomie odrzuca dodanie bramki) |
| **Do nowej wersji?** | ⬜ **do decyzji użytkownika** — czy dokładać bramkę analogiczną do produkcyjnej (`staging_policy.cjs:131-134`, ścieżka bazy) na `SELLY_CSV_DIR` |
| **Status** | ⬜ otwarte — świadomie odrzucone jako spoza zakresu karty I15.10b (decyzja D1 w `docs/tickets/139-FEATURE-montaz-dostepnosci/plan.md`) |

**Opis biznesowy.** `SELLY_CSV_DIR` ma domyślkę wskazującą prawdziwy katalog produkcyjny
(`/home/admin/domains/agritires.eu/public_html/panel/ex-port-files`) — świadomie, bo pusty
`.env` ma zachowywać się jak oryginał. Jedyną ochroną na środowisku innym niż produkcja (np.
staging dzielący VPS z produkcją) jest poprawnie wypełniony `.env`. Do tego ticketu ta ścieżka
była osiągalna wyłącznie ręcznie, przez `POST /api/selly/generate-csv` za `requireAuth`
(istnieje od I15.3). **Ten ticket (139) nie wnosi długu** — czyni tylko tę samą ścieżkę osiągalną
automatycznie, z każdego importu, gdy `SELLY_TRYB !== "wylaczony"`.

**Szczegół techniczny (dla rebuildu).** Rozważone i odrzucone w D1 (`plan.md`): (a) montaż
bezwarunkowy z ochroną wyłącznie w `.env` stagingu — całe ryzyko na konfiguracji, jedna pomyłka
nadpisuje produkcyjny CSV; (b) osobna bramka na `SELLY_CSV_DIR` analogiczna do produkcyjnej
(ścieżka bazy) — nowy element zachowania, nieopisany ani w karcie I15.10b, ani w planie 136.
Zamiast tego przyjęto `SELLY_TRYB` jako bramkę na cały montaż (`#139.1`), co pośrednio chroni też
`SELLY_CSV_DIR` na stagingu (domyślka `wylaczony`) — ale nie chroni przed błędną kombinacją
`SELLY_TRYB=pelny` + `SELLY_CSV_DIR` nieustawiony/błędny na środowisku innym niż produkcja.

**Rekomendacja (moja).** 🕒 **później, decyzją koordynatora.** Najtańszy wariant, gdyby miał
powstać: bramka analogiczna do `staging_policy.cjs:131-134`, ale po zmiennej środowiskowej
identyfikującej środowisko (np. `NODE_ENV=production` lub dedykowana flaga), nie po ścieżce
bazy — z tych samych powodów co D1 (`#139.1`). Do sprawdzenia **przed deployem produkcji**
niezależnie od decyzji: czy `.env` produkcji ma `SELLY_TRYB=pelny` (inaczej odświeżanie w ogóle
nie ruszy) oraz czy `SELLY_CSV_DIR` wskazuje właściwy katalog na każdym środowisku, które nie ma
`wylaczony` (`docs/tickets/139-FEATURE-montaz-dostepnosci/raport.md`, „Breaking changes").

---

*Pominięte (brak zadania dla rebuildu):* brak — ten ticket nie jest triażem produkcji, oba wpisy
wyżej to bezpośrednie skutki własnej implementacji.
