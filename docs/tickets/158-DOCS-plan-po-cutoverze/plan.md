# 158-DOCS-plan-po-cutoverze — aktualizacja roadmapy: stan przed cutoverem + plan po cutoverze

**Typ:** DOCS (koordynator). **Zero zmian w `rebuild/` i `contract/`.**
**Zlecenie użytkownika (2026-09-24):** „Zaktualizuj plan. Przekazałem Ani do testów cały system.
Zweryfikuj, czy wszystkie karty i tickety przed cutoverem są skończone, i wypisz wszystko,
co jest do zrobienia po cutoverze."

## Weryfikacja — czy faktycznie wszystko przed cutoverem zamknięte

Wykonana na `origin/develop` @ `bda6488` (lokalny `develop` był 27 commitów w tyle — dociągnięty).

- `tools/stan-kart.sh` → **31 kart, wszystkie ✅**. Ostatnia otwarta (TEST.1) zamknięta
  ticketem 149, PR #165, zmergowanym po stanie, który widziała poprzednia sesja.
- `gh pr list --state open` → **0 otwartych PR-ów**.
- Worktree 155/156/157 mają commity, ale wszystkie są w `origin/develop` (PR #170, #171, #174).
- `tools/stan-backlogu.sh --do-decyzji` → 8 wpisów, **żaden nie jest blokerem** (Blok 3 i 4 w §6b).

**Wniosek: teza użytkownika potwierdzona — po naszej stronie nie ma otwartej karty ani ticketu
przed cutoverem.** Roadmapa mówiła co innego (I15 🔨, P 🔨, FIX.1 ⬜ BLOKADA, Faza E ⬜), bo
tablicę postępu odświeża koordynator, a karty ostatniej fali z definicji jej nie ruszały.

## Zakres zmian

1. **§4 tablica postępu** — nota nagłówkowa na stan 24.09; wiersz 15 → ✅ (14/14 kart),
   wiersz P → ✅, nowy wiersz TEST (trzy dokumenty dla Ani).
2. **Blok I15 w §5** — `Status` → ✅ 2026-09-24; Faza E → ✅; wiersz `⛔ przed cutoverem` FIX.1 →
   ✅ z adnotacją o bliźniaczym, świadomie niezałatanym `#154.1`.
3. **Blok „Poprawki po testach Ani" w §5** — tabela „Po stronie użytkownika" wyzerowana:
   #94/#95/#98 rozstrzygnięte rundą DEC.1, trzy pytania „po stronie Ani" zamknięte ticketem 155.
4. **§6** — nota stanu przepisana na 24.09.
5. **§6a (nowa)** — „Przed cutoverem — co zostało": 7 czynności ludzkich z właścicielem
   i statusem + wykaz decyzji Ani czekających w dokumentach testowych.
6. **§6b (nowa)** — „Po cutoverze — plan prac": 5 bloków (okno i pierwsza doba · fala PO z DEC.1 ·
   dług z ostatniej fali · czeka na Anię · tryb pracy).
7. **`docs/przeglad-12-widokow.md`** — trzy poprawki faktyczne zgłoszone przez kartę TEST.1
   w „Do koordynatora" (karta nie jest właścicielem tego pliku) + czwarta z tej samej listy.

## Decisions

- **D1. Roadmapę aktualizuje ten ticket, bo jest koordynatorem.** CLAUDE.md pkt 0: karty nie
  piszą w roadmapie; robi to sesja planująca falę. Ta sesja planuje falę po cutoverze.
- **D2. Plan po cutoverze idzie do roadmapy, nie do nowego pliku.** Wpis `#143.3` w backlogu
  trzyma listę kart z DEC.1, ale backlogu nie czyta się jako planu — roadmapa jest wejściem dla
  następnej sesji (CLAUDE.md). W §6b jest plan, w backlogu zostają uzasadnienia per wpis.
- **D3. Poprawki w `docs/przeglad-12-widokow.md` wnosimy teraz, nie zapisujemy jako zadanie.**
  Ania testuje na tym dokumencie w tej chwili, a trzy z czterech zdań są nieprawdziwe wobec
  stanu kodu (opcje filtra stagingu, sufit wierszy w CSV analityki po P10.5, treść komunikatu
  ekranu Selly). Koszt poprawki: cztery akapity; koszt zaniechania: fałszywe zgłoszenie od Ani.
- **D4. `docs/karty/TEST.1/karta.md` nie jest ruszana**, mimo że to jej sekcja „Do koordynatora"
  zgłosiła te poprawki — karta jest zamknięta i jest jedynym właścicielem swojego pliku
  (CLAUDE.md pkt 0). Rozliczenie zgłoszenia jest w `raport.md` tego ticketu.
- **D5. Nie zakładamy jeszcze katalogów `docs/karty/PO.*`.** Fala po cutoverze rusza po oknie
  i po odpowiedziach Ani, które mogą zmienić jej skład (np. `#137.2`, `#108`). Katalogi kart
  zakłada koordynator tuż przed wydaniem promptów (`docs/karty/README.md`, „Przepływ fali").

## Tests

Nie dotyczy — zmiana wyłącznie w `docs/`. Bramki `rebuild/backend/` nieuruchamiane, bo nie ma
czego sprawdzać.
