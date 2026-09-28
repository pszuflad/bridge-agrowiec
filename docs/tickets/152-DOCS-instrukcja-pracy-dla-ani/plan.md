# 152-DOCS-instrukcja-pracy-dla-ani — jak Ania zgłasza uwagi i poprawki po testach

> Status: Draft → Approved → Implemented → Shipped
> Branch: `docs/152-instrukcja-pracy-dla-ani`
> Worktree: `.worktrees/152-DOCS-instrukcja-pracy-dla-ani`
> Karta: `docs/karty/TEST.3/karta.md` (dokument 3 z trzech w fali „dokumenty dla Ani")

## Ticket description

Napisać `docs/instrukcja-pracy-dla-ani.md` — dokument „jak zgłaszać uwagi i poprawki po testach".
Sedno: każde zgłoszenie Ani idzie przez komendę `/feature` w Claude Code w przeglądarce, bez furtki
„popraw mi to szybko w czacie". Uzasadnienie korzyścią, nie procedurą: bez `/feature` znika research
po kontrakcie i oryginale, pytania zadane ZANIM ktoś zacznie pisać, plan do zatwierdzenia, review,
aktualizacja dokumentacji i PR bez konfliktów zamiast pushu na gałąź główną. Ma to zastąpić
dotychczasową drogę łatek doklejanych do bundla produkcji.

Zakres z karty: jak wejść · jak sformułować zgłoszenie · trzy rodzaje zgłoszeń · czego nie wolno ·
czego się spodziewać po drodze.

⚠ To NIE instrukcja testu, tylko dokument dla osoby, która zna stary Bridge i dopiero poznaje nasz
sposób pracy. Nie przepisywać `.claude/commands/feature.md` (instrukcja dla agenta). Żargon
z `CLAUDE.md` tylko z jednozdaniowym wyjaśnieniem przy pierwszym użyciu. Zasadę, której nie umiem
uzasadnić korzyścią dla Ani — pomijam, zamiast wpisywać jako nakaz.

## Context

Research (subagent, 2026-09-24) ustalił fakty, których dokument nie mógł zgadnąć:

- **Infrastruktura chmurowa NIE jest gotowa.** `docs/tickets/134-CHORE-praca-w-chmurze/plan.md` to
  sam plan (1 commit, wszystkie 4 pozycje „Definition of done" nieodhaczone). Potwierdzone
  niezależnie: `.claude/settings.json` nie ma bloku `hooks`/`SessionStart`,
  `.claude/commands/feature.md` nie zawiera wariantu „branch w chmurze" (zero wystąpień
  „chmur"/„cloud"/„claude.ai"). Hook `pre-push` włącza się dopiero przez `prepare`
  (`rebuild/backend/package.json:11`), czyli po `npm install`.
- **Żadna z trzech warstw z `CLAUDE.md` nie jest twardym zamkiem na tym repo.** Hook dokumentuje
  własne obejście (`.githooks/pre-push:6` — `POMIN_SYNC=1`, `--no-verify`); job `synchronizacja`
  (`.github/workflows/ci.yml:17-34`) sprawdza to samo, ale czerwony check nie wstrzyma merge'a —
  rulesety GitHuba dają HTTP 403 na prywatnym repo w planie Free (sprawdzone 2026-09-23,
  `134-.../plan.md:4-6,21-22`).
- **`SELLY_CSV_DIR` domyślnie wskazuje katalog PRODUKCYJNY** — `rebuild/backend/src/config/env.ts:138-143`
  (`/home/admin/domains/agritires.eu/public_html/panel/ex-port-files`), świadome odstępstwo
  (komentarz `env.ts:127-134`, decyzja użytkownika 2026-09-04). Oryginał miał twardą blokadę
  (`mirror/backend/staging_policy.cjs:131-134`), odbudowa jej NIE ma — jedyna ochrona to poprawny
  `.env`. Otwarte w backlogu jako `#139.2` (`docs/rebuild-backlog/wpis-139.md`), przywołane
  w `docs/karty/I15.9/wejscie-144.md:13-33`. Generowany plik zawiera kolumnę `Cena-zakupu`
  (`rebuild/backend/src/selly/generator-csv.ts:54`) i leży pod publicznym adresem.
- **`POST /api/selly/sync-supplier` z `dry_run=false` realnie tworzy i modyfikuje produkty w cudzym
  sklepie** — `rebuild/backend/src/selly/klient.ts:10`, trasa `rebuild/backend/src/routes/selly.ts:236`,
  kontrakt `contract/openapi.yaml:20431`. Sklep: `agroopony.selly24.pl`.
- **Zamrożenie produkcji w mocy** — `docs/rebuild-roadmap.md:3436` (2026-09-22, Paweł + Ania),
  ostatnia zmiana produkcji `7d6cfc9`.
- **Historia „dlaczego nie łatki" potwierdzona w trzech punktach:** duplikaty `Lq` w
  `mirror/backend/index.cjs` → komunikat „zapis naukowy ma tylko null cyfr znaczących"
  (`docs/rebuild-backlog.md:664`, wpis #11); łatka `konstrukcja` wpisana w MARTWY bundel frontendu,
  więc kolumna „Konstrukcja opony" do dziś pokazuje „—" (dowód: tabela łatek w
  `deminified/README.md`); etykieta `.bak_szer_marka_20260904_1500` nieodpowiadająca treści łatki
  (`docs/tickets/47-CHORE-i13e-frontend-bridgeone/plan.md:29,206`).
- **Wzorzec formy** — polecenie Ani z 2026-09-22 (`docs/karty/I15.9/wejscie-104b.md:1-9`): bez ściany
  tekstu, „co zmieniliśmy → polecenie → rezultat", rozbieżności do „Do Twojej decyzji". Styl
  do naśladowania: `docs/instrukcja-testow-I10-v2.md` (per „Ty", pogrubienia, ⭐ na priorytety,
  ⚠ na ostrzeżenia, „Ile to zajmuje", bez emoji).
- **Nic nie koliduje** — `docs/instrukcja-pracy-dla-ani.md` nie istnieje, `docs/cutover.md` nie ma
  rozdziału o zgłaszaniu poprawek, żaden dokument dla Ani nie wspomina `/feature`.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Brak (ticket nie dotyka kontraktu).** Ticket dodaje jeden plik w `docs/` i domyka kartę TEST.3;
nie rusza `rebuild/`, `contract/`, schematu ani migracji. GATE odbudowy nie obowiązuje.

Kontrakt wchodzi tu tylko jako **źródło faktów cytowanych w dokumencie** (`openapi.yaml:20431` dla
`sync-supplier`) — sprawdzone, nie zmieniane.

## Decisions

Cztery decyzje użytkownika (runda pytań, 2026-09-24):

1. **Zakazy opisujemy jako UMOWĘ, uczciwie.** Dokument mówi „tak się u nas pracuje" i dodaje jedno
   zdanie, że technicznie da się to obejść — dlatego liczy się umowa, nie zamek. *Dlaczego tak:*
   alternatywa („nie da się") jest nieprawdą (`.githooks/pre-push:6`, CI bez blokady) i przy
   pierwszym obejściu dokument stracił zaufanie Ani. Za: dokument wychodzi teraz i nie kłamie.
   Przeciw: przyznaje słabszą gwarancję niż sugeruje `CLAUDE.md` → domknięcie ticketu 134 idzie
   jako follow-up.
2. **Ścieżka awaryjna: telefon do Pawła, nie naprawa i nie łatka w czacie.** Osobna, krótka sekcja
   „Gdy pali się". *Dlaczego tak:* po cutoverze nowy Bridge jest produkcją, a `/feature` z researchem
   i planem do zatwierdzenia jest za wolne na „zły cennik poszedł do Selly". Za: zachowuje brak
   furtki (decyduje człowiek, nie czat) i jest realistyczne. Przeciw wariantowi „PILNE przez
   /feature": przy realnej awarii Ania i tak zadzwoni, a dokument wyglądałby na oderwany od życia.
3. **Backlog: Ania mówi tylko „to zmiana świadoma".** Zapis do `docs/rebuild-backlog/wpis-<N>.md`
   robi za nią sesja; w jej dokumencie zero ścieżek plików i numeracji. *Dlaczego tak:* w całej
   dotychczasowej praktyce wpisy zakładały sesje, nie Ania, a `/feature` i tak nanosi tylko wpisy
   oznaczone ✅ (`.claude/commands/feature.md:29`). Skutek uboczny researchu: `/feature` **nie ma
   jawnego kroku „utwórz nowy wpis backlogu dla świadomej zmiany"** — zgłaszam to koordynatorowi
   („Do koordynatora" w karcie TEST.3) i jako follow-up, bez obiecywania Ani mechanizmu, którego
   dziś nie ma nazwanego w procedurze.
4. **Wejście opisujemy krok po kroku — Ania ma (lub będzie miała) własne konto i dostęp do repo.**
   Logowanie → wybór repozytorium → wybór gałęzi `develop` → `/feature`. Założenie: dostęp jest
   załatwiony przed wydaniem dokumentu (wchodzi do warunków wstępnych w raporcie).

**Świadome odstępstwa od zachowania oryginału:** brak (ticket dokumentacyjny, nie odtwarza
zachowania produkcji).

**Decyzje redakcyjne moje, nie użytkownika** (do zakwestionowania przy odbiorze):
- Zasady, których NIE wpisuję, bo nie umiem ich uzasadnić korzyścią dla Ani: nazewnictwo gałęzi
  i worktree, numeracja ticketów, kolejność źródeł prawdy, GATE na fixtures, `tools/sync-z-develop.sh`
  i kody wyjścia. To robota sesji, nie jej.
- Żargon, który dopuszczam **z jednozdaniowym wyjaśnieniem przy pierwszym użyciu**: `develop`,
  PR, backlog, staging. Żargon, który **zastępuję polskim**: „gate" → „bramka/sprawdzenie",
  „fixture" → „nagrana odpowiedź starego Bridge'a", „karta" → nie użyję wcale.
- Długość docelowa: 2–3 strony. Dokument ma być przeczytany raz i używany jako kartka pod ręką.

## Implementation plan

Jeden nowy plik `docs/instrukcja-pracy-dla-ani.md`, w kolejności:

1. **Nagłówek** — dla kogo, data, jedno zdanie „po co ta kartka", i wprost: to nie instrukcja testu,
   to sposób pracy po testach. Wzór nagłówka z `docs/instrukcja-testow-I10-v2.md:1-6`.
2. **„Dlaczego nie łatka"** (3–4 zdania, bez wyrzutu wobec Ani, na faktach z Context): kolumna
   „Konstrukcja opony" pokazująca „—", bo łatka trafiła w bundel, którego produkcja nie ładuje;
   „zapis naukowy ma tylko null cyfr znaczących" z podwójnej definicji; kopia `.bak` z nazwą
   niepasującą do treści. Puenta: nie dlatego, że ktoś się pomylił, tylko dlatego, że **nikt tego
   nie przeczytał przed wysłaniem** — i to jest dokładnie to, co dokłada `/feature`.
3. **„Co dostajesz w zamian"** — pięć konkretów z karty, każdy w formie korzyści: przeczytanie
   kontraktu i starego Bridge'a przed pisaniem · pytania ZANIM cokolwiek się zmieni · plan
   do zatwierdzenia · review i aktualizacja dokumentacji · zmiana wchodzi przez PR, nie prosto
   na gałąź główną.
4. **„Jak wejść"** — `claude.ai/code`, repozytorium, gałąź **`develop`** (jedno zdanie, czym jest
   i dlaczego nie `main`), wpisanie `/feature <opis>`. Plus: sesja pracuje na własnej kopii, więc
   nie da się zepsuć cudzej roboty ani produkcji.
5. **„Jak napisać zgłoszenie"** — cztery linijki (co zrobiłam → co się stało → czego oczekiwałam →
   zrzut/adres) + **gotowy szablon do skopiowania** + jeden przykład dobrze napisanego zgłoszenia
   i ten sam przykład napisany źle, z jednym zdaniem, co w nim gubimy.
6. **„Trzy rodzaje zgłoszeń"** — tabela (rodzaj · jak rozpoznać · co dopisać w zgłoszeniu · co się
   stanie): błąd (jest inaczej niż w starym Bridge) · świadoma zmiana (ma być inaczej — dopisz
   „to zmiana świadoma, nie błąd", trafia do backlogu jako Twoja decyzja) · obserwacja albo pytanie
   (też przez `/feature`, żeby nie zginęło w czacie).
7. **„Czego nie robimy"** — pięć pozycji, każda w układzie *co · dlaczego (skutek) · co zamiast*:
   push prosto na `develop`/`main` (umowa, nie zamek — jedno zdanie o obejściu) · praca bezpośrednio
   na produkcji (zamrożenie z 22.09) · `sync-supplier` z `dry_run=false` (modyfikuje żywy sklep
   `agroopony.selly24.pl`) · generowanie CSV bez ustawionego `SELLY_CSV_DIR` (domyślka = katalog
   produkcyjny, plik z kolumną `Cena-zakupu` publicznie dostępny) · hasła i klucze w czacie (nazwy
   `SELLY_*`, `AGRORAMI_*` — co zrobić, jeśli już się wklei).
8. **„Gdy pali się"** — krótko: nie naprawiaj, nie proś o łatkę, dzwoń do Pawła; on decyduje
   o cofnięciu. Dwa przykłady kwalifikujące (zły plik poszedł do Selly, import wywalił stany).
9. **„Czego się spodziewać po drodze"** — cztery momenty: pytania z wariantami (odpowiedź Ani
   rozstrzyga) → plan do zatwierdzenia („go") → PR + raport → merge i wdrożenie robi Paweł.
   Bez obiecywania czasu w godzinach — research pokazał, że z repo nie da się tego rzetelnie
   ustalić; zamiast liczby: „pytania dostajesz na początku, nie na końcu".
10. **„Do Twojej decyzji"** — sekcja na wzór pozostałych dokumentów: czy dostęp do repozytorium
    dla niej jest już założony; czy telefon to właściwa droga awaryjna.
11. **Domknięcie karty** `docs/karty/TEST.3/karta.md` (Stan ✅ + „Dowiezione" + „Do koordynatora”
    z luką w `feature.md`) — robi doc-checker w Fazie 5.

## Testing strategy

Dokument — brak testów automatycznych. Weryfikacja:
- **GATE odbudowy: N/D** (uzasadnienie w sekcji „Kontrakt i fixtures").
- **Bramki backendu nie dotyczą** — ticket nie zmienia ani linii w `rebuild/`. Kontrola: `git diff
  --name-only origin/develop` ma zwrócić wyłącznie ścieżki w `docs/`.
- **Weryfikacja faktograficzna (to jest tu realny test):** każda liczba, ścieżka i cytat
  w dokumencie potwierdzony w pliku wskazanym w „Context". Reviewer dostaje wprost polecenie
  sprawdzenia trzech najbardziej ryzykownych twierdzeń: domyślka `SELLY_CSV_DIR`, kolumna
  `Cena-zakupu`, skutek `dry_run=false`.
- **Kontrola żargonu:** przebieg po dokumencie z listą słów z `CLAUDE.md` („gate", „fixture",
  „karta", „worktree", „GATE", „triaż") — każde wystąpienie albo ma wyjaśnienie w tym samym zdaniu,
  albo wypada.
- **Kontrola zakresu własności:** ticket pisze tylko `docs/instrukcja-pracy-dla-ani.md`,
  `docs/karty/TEST.3/karta.md`, `docs/tickets/152-*/**` i (przez doc-checkera) statusy w backlogu.
  NIE `.claude/commands/feature.md`, NIE `CLAUDE.md`, NIE `docs/rebuild-roadmap.md`.

## Out of scope

- **Domknięcie ticketu 134** (hooki auto-on w chmurze, wariant „branch bez worktree"
  w `feature.md`) — follow-up, decyzja 1.
- **Dopisanie do `.claude/commands/feature.md` kroku „utwórz nowy wpis backlogu"** — karta TEST.3
  tego wprost zakazuje („zmiana samej komendy = osobna decyzja użytkownika"); idzie jako follow-up
  i do „Do koordynatora".
- **Instrukcje testów** — TEST.1 (`docs/instrukcja-pelnego-testu.md`) i TEST.2
  (`docs/instrukcja-testu-sciezki-krytycznej.md`) to osobne karty. Ten dokument tylko mówi,
  co Ania robi ze znaleziskami; nie mówi, co ma sprawdzać.
- **Poprawka błędnego odsyłacza w `CLAUDE.md`** (`mirror/backend/CHANGELOG.md:101` nie wskazuje
  dziś na łatkę `konstrukcja`; dowód jest w `deminified/README.md`) — plik zakazany przez kartę,
  idzie do „Do koordynatora".
- **Twarda bramka na `SELLY_CSV_DIR`** (odpowiednik `staging_policy.cjs` z oryginału) — otwarte
  w backlogu jako `#139.2`, nie ten ticket.

## Definition of done

- [ ] `docs/instrukcja-pracy-dla-ani.md` istnieje: pięć punktów zakresu z karty TEST.3 pokryte
      (jak wejść · jak zgłaszać · trzy rodzaje · czego nie robimy · czego się spodziewać)
- [ ] Każde zgłoszenie prowadzi do `/feature` — w dokumencie nie ma zdania sugerującego, że coś
      da się „poprawić szybko w czacie"; jedyne wyjście awaryjne to telefon do Pawła
- [ ] Uzasadnienie oparte na korzyści i na trzech udokumentowanych skutkach dawnych łatek,
      bez tonu wyrzutu wobec Ani
- [ ] Gotowy szablon zgłoszenia do skopiowania + jeden przykład dobry i jeden zły
- [ ] Każdy zakaz ma podane NASTĘPSTWO (co się stanie) — zakaz bez uzasadnienia korzyścią wypadł
      z dokumentu, nie został wpisany jako nakaz
- [ ] Żargon: każde użyte słowo z `CLAUDE.md` wyjaśnione jednym zdaniem przy pierwszym użyciu
      albo zastąpione polskim
- [ ] Zero przepisanej treści `.claude/commands/feature.md` — dokument mówi, co Ania dostaje
      i co zatwierdza, nie jak Master orkiestruje
- [ ] Fakty o Selly (`dry_run=false`, domyślka `SELLY_CSV_DIR`, `Cena-zakupu`) zweryfikowane
      w kodzie przez reviewera
- [ ] `docs/karty/TEST.3/karta.md` domknięta (Stan ✅ + data + ID ticketa, „Dowiezione",
      „Do koordynatora" z luką w `feature.md`)
- [ ] `git diff --name-only origin/develop` zwraca wyłącznie ścieżki w `docs/`
- [ ] Gałąź zsynchronizowana z `origin/develop`, PR `MERGEABLE`
