# 39-CHORE-audyt-bezpieczenstwa-domkniecie — Code review

> Reviewed: 2026-09-08
> Branch: `chore/39-audyt-bezpieczenstwa-domkniecie`
> Diff: 27 plików, 7 commitów (baza `origin/develop`)

## BLOCKER

- [ ] `docs/rebuild-roadmap.md`, `docs/rebuild-backlog.md` — Krok 8 planu (aktualizacja
      roadmapy i backlogu) **nie został wykonany**, mimo że jest jawnym punktem planu
      implementacji i Definition of done.
  - Reason: `git diff origin/develop...HEAD --stat` nie zawiera ani `docs/rebuild-roadmap.md`,
    ani `docs/rebuild-backlog.md`, ani `docs/spec-backend.md`, ani `docs/deploy-setup.md` —
    zero zmian. Sprawdzone empirycznie: roadmapa nadal ma `#### Sesja 12e — ... — ⬜`
    (`docs/rebuild-roadmap.md:1802`) i „została jedna: 12e" (`:1605`, `:1860`), a tablica w
    §4 nie ma statusu ✅ przy I12. Backlog nadal ma `#36`, `#45`, `#48`, `#51` ze statusem
    „⬜ do decyzji Ani" i #52 z „Do decyzji (12e)" — mimo że plan.md D1–D7 te decyzje już
    podjął, a raport.md w sekcji „Rozliczenie backlogu" jawnie deklaruje wynik (✅/❌) dla
    każdego z nich. To dokładnie sytuacja, przed którą ostrzega CLAUDE.md („roadmapa opisuje
    STAN, nie zamiar") — a że to jest **ostatnia sesja całej odbudowy**, błędny stan
    „zostało 12e" i „⬜ do decyzji" zostanie w dokumentach na stałe, bo nie będzie kolejnej
    sesji, która by to sprostowała.
  - Suggestion: dopisać Krok 8 — oznaczyć I12/12e ✅ w §4 i §5 roadmapy z datą i ID ticketa,
    przepisać §6 „Po zakończeniu", rozliczyć wpisy #36 ✅, #49 ✅, #51 ✅, #45 ❌, #48 ❌,
    #50 ❌, #52 rozstrzygnięty w backlogu, oraz dopisać odsyłacz do `cutover.md`
    w `docs/deploy-setup.md` i notę w `docs/spec-backend.md` §2, tak jak zakładał plan.md.

## SHOULD-FIX

- [ ] `rebuild/backend/src/routes/maintenance.ts:92-95` — `usunNadmiarKopii` ma JEDEN
      `try/catch` wokół całej pętli `unlinkSync`, więc błąd na pojedynczym pliku (np. wpis
      będący katalogiem, brak uprawnień, plik zablokowany) przerywa kasowanie WSZYSTKICH
      pozostałych plików w tej turze, nie tylko tego jednego.
  - Reason: kopie są sortowane rosnąco i kasowane od najstarszej — jeśli zepsuty wpis jest
    najstarszy (a po pierwszym niepowodzeniu ZOSTAJE najstarszy przy każdym kolejnym
    wywołaniu, bo nigdy się nie kasuje), retencja **trwale przestaje działać** dla całego
    katalogu, mimo że limit wygląda na przestrzegany w kodzie. Test dodany w tym tickecie
    (`test/maintenance.test.ts`, „błąd sprzątania nie przerywa czyszczenia katalogu")
    weryfikuje tylko, że trasa zwraca 200 — nie sprawdza, czy pozostałe stare pliki (inne niż
    ten zepsuty) faktycznie zostały skasowane, więc ta luka przechodzi zielono.
  - Suggestion: `try/catch` per-plik wewnątrz pętli (log + `continue`), żeby jeden zepsuty
    wpis nie blokował sprzątania reszty.

## NICE-TO-HAVE

- [ ] `rebuild/backend/src/routes/maintenance.ts:66` — `LIMIT_KOPII_PRZED_CZYSZCZENIEM = 5`
      jest stałą w kodzie, nie zmienną środowiskową. Plan.md D2d świadomie nie wspomina o
      konfigurowalności, a to ustawienie czysto operacyjne (dysk) bez wpływu na API — sensowne
      zostawić jako stałą; konfigurowalność miałaby wartość tylko, gdyby ktoś chciał inny limit
      per środowisko (staging vs produkcja), co dziś nie jest potrzebą.

## Plan compliance

### Done ✓
- Krok 1 (D2b CORS guard + D2c `algorithms: ["HS256"]`) — zaimplementowane i przetestowane,
  `env.ts:137-146`, `auth/jwt.ts:29`, log w `server.ts:36-44`.
- Krok 2 (D2d retencja kopii) — zaimplementowane, `maintenance.ts:63-100`, przetestowane
  (z zastrzeżeniem SHOULD-FIX wyżej).
- Krok 3 (D2a test rejestru Express) — `test/auth.rejestr.test.ts`, zweryfikowany empirycznie
  (zdjęcie `requireAuth` z `GET /api/history` powoduje czerwony test; przywrócone).
- Krok 4 (D1 sidebar w routerze) — `App.tsx` z tabelą `TRASY_Z_RAMA` (12 tras zgodnych z listą
  z promptu), `AppShell` zdjęty z 5 widoków, padding sprawdzony na 7 nowych — żaden nie miał
  własnego `p-6` poza `Katalog.tsx`, skąd go usunięto.
- Krok 5 (D5 `DialogPotwierdzenia`) — `Staging.tsx` i `konfiguracja/Admin.tsx` przełączone,
  teksty pytań dosłownie zgodne z usuniętymi `confirm()`/`window.confirm`;
  `konfiguracja/Katalog.tsx` rzeczywiście nietknięty.
- Krok 6 (`docs/cutover.md`) — istnieje, fakty zweryfikowane empirycznie (73 kolumny po
  001+002+003, `szerokosc` TEXT, `uwaga_cena` ostatnia, `suppliers.import_wylaczony`,
  `_migracje` — wszystko zmierzone lokalnym `npm run migrate` i zgadza się z dokumentem);
  nazwy zmiennych env w tabeli różnic zgadzają się z `config/env.ts`.
- Krok 7 (`docs/przeglad-12-widokow.md`) — istnieje, 12 sekcji + logowanie, język
  nietechniczny, sekcje „wygląda inaczej" i „znane i nienaprawione" obecne.

### Missing lub deviating ✗
- **Krok 8 — dokumenty odbudowy nietknięte.** Patrz BLOCKER wyżej: roadmapa, backlog,
  `docs/spec-backend.md`, `docs/deploy-setup.md` zostały poza zakresem faktycznie
  zrealizowanej pracy, mimo że plan.md wymienia je wprost jako ostatni krok.

### Definition of done
- [x] Audyt A–D udokumentowany w `raport.md` z `plik:linia`.
- [x] D2a — test rejestru zielony, lista publicznych ma dokładnie 3 pozycje (zweryfikowane).
- [x] D2b — fail-fast na `CORS_ORIGINS=*` w produkcji + log stanu CORS przy starcie.
- [x] D2c — `algorithms: ["HS256"]` w `jwt.verify`, bez łamania istniejących tokenów (`jwt.sign`
      bez jawnego algorytmu i tak domyślnie podpisuje HS256).
- [x] D2d — retencja 5 kopii z testem (z zastrzeżeniem SHOULD-FIX o odporności na błąd
      pojedynczego pliku).
- [x] D1 — `AppShell` w routerze na 12 trasach, brak na `/login` i 404, padding sprawdzony.
- [x] D5 — `Staging.tsx` i `konfiguracja/Admin.tsx` na `DialogPotwierdzenia`, teksty dosłowne;
      `Katalog.tsx` bez zmian.
- [x] `docs/cutover.md` — kompletny wg wymaganych sekcji.
- [x] `docs/przeglad-12-widokow.md` — kompletny.
- [ ] Backlog rozliczony — **NIE zaktualizowany w `docs/rebuild-backlog.md`** (decyzje są
      w `plan.md`/`raport.md`, ale nie w dokumencie, który czyta kolejna sesja/czytelnik).
- [ ] Roadmapa — **NIE przepisana**: I12 nie oznaczone ✅ w §4/§5, §6 nie przepisane.
- [x] Bramki zielone po obu stronach (zweryfikowane uruchomieniem); `git status contract/`
      pusty (zweryfikowane).
- [ ] Całość na stagingu — poza zakresem tego review (deploy następuje po merge).

## Parallel-test concerns

None — wszystkie nowe/zmienione testy (backend: `auth.rejestr.test.ts`, `auth.jwt.test.ts`,
`config.env.test.ts`, `maintenance.test.ts`; frontend: `shell.test.tsx`, `staging.test.tsx`,
`konfiguracja.admin.test.tsx`) używają środowiska testowego z katalogiem tymczasowym
(`stworzSrodowiskoTestowe`) albo czystego jsdom bez zasobów współdzielonych. `maintenance.test.ts`
podkłada pliki we własnym katalogu tymczasowym instancji testowej — nie koliduje między agentami.

## Overall assessment

Warstwa bezpieczeństwa (D2a–D2d) jest solidna i dobrze przetestowana — test rejestru Express
zweryfikowany empirycznie faktycznie łapie brakujący `requireAuth`, guard CORS i przypięcie
JWT są precyzyjne i nie psują istniejących tokenów. Zmiany frontendowe (D1 sidebar, D5 dialogi)
są czyste, tekstowo wierne oryginałowi i dobrze pokryte testami; przy okazji naprawiono realny
defekt wirtualizacji katalogu, co jest udokumentowane rzetelnie. Jedyny poważny problem to
pominięcie Kroku 8 planu — roadmapa i backlog, czyli dokumenty opisane w CLAUDE.md jako wejście
dla kolejnej sesji, zostały nieaktualne mimo że to ostatnia sesja całej odbudowy i nie będzie
już komu tego sprostować. Do tego jeden realny, choć niekrytyczny, defekt odporności w retencji
kopii bazy (pojedynczy zepsuty plik trwale zatrzymuje sprzątanie całego katalogu).
