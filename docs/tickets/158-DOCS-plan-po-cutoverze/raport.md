# 158-DOCS-plan-po-cutoverze — raport

**Data:** 2026-09-24 · **Baza:** `origin/develop` @ `bda6488`

## 1. Weryfikacja stanu — dowody

| Sprawdzenie | Polecenie | Wynik |
|---|---|---|
| karty | `tools/stan-kart.sh` | 31 kart, **0 otwartych** (ostatnia TEST.1 → ✅ 149) |
| PR-y | `gh pr list --state open` | **0** |
| gałęzie w locie | `git worktree list` + `git branch --contains` | worktree 155/156/157 zawarte w `origin/develop` (PR #170, #171, #174) |
| backlog do decyzji | `tools/stan-backlogu.sh --do-decyzji` | 8 wpisów: `#108`, `#137.2`, `#139.2`, `#142.1`–`#142.4`, `#154.1` — żaden nie jest blokerem cutoveru |
| backlog odłożony | `tools/stan-backlogu.sh` \| grep 🕒 | 11 wpisów, wszystkie z decyzją „po cutoverze" (DEC.1, ticket 141) |

⚠ **Lokalny `develop` był 27 commitów w tyle** za `origin/develop` — bez `git fetch` sesja
zobaczyłaby TEST.1 jako otwartą kartę i FIX.1 jako nierozliczoną blokadę. Zanim ktokolwiek
odczyta stan fali z roadmapy, musi zrobić `git fetch origin`.

## 2. Co zostało zmienione

- `docs/rebuild-roadmap.md` — §4 (nota + wiersze 15, P, nowy TEST), blok I15 w §5 (status, Faza E,
  wiersz FIX.1), blok „Poprawki po testach Ani" (tabela decyzji wyzerowana), §6 (nota stanu),
  **§6a i §6b — nowe sekcje**: co zostało przed cutoverem i pełny plan po cutoverze.
- `docs/przeglad-12-widokow.md` — cztery poprawki faktyczne, patrz niżej.

## 3. Rozliczenie zgłoszeń „Do koordynatora" z zamkniętych kart

| Źródło | Zgłoszenie | Co zrobiono |
|---|---|---|
| TEST.1 pkt 1 | punkt 8 i pozycja 9 twierdzą, że plik CSV Analityki ma tyle wierszy co tabela — nieprawda po P10.5 | ✅ poprawione (oba miejsca) |
| TEST.1 pkt 2 | punkt 2 opisuje filtr stagingu jako „nowa / zmieniona / wycofana" | ✅ poprawione na sześć realnych opcji (`pages/staging/dane.ts:75-82`) |
| TEST.1 pkt 3 | punkt 12 cytuje komunikat Selly jako „tryb wyłączony" | ✅ poprawione na „Integracja Selly wyłączona na tym środowisku" (`BladSekcji.tsx:28`) |
| FIX.1 | wiersz `⛔ przed cutoverem \| FIX.1 \| ⬜ BLOKADA` do przestawienia | ✅ przestawiony na ✅ + adnotacja o `#154.1` |
| FIX.1 | `mapper.ts:197-203` ma ten sam błąd, świadomie niezałatany | ✅ wniesione do §6b Blok 3 jako **najwyższy priorytet** tego bloku |
| DEC.1 pkt 5 | siedem kart do zaplanowania po cutoverze | ✅ wniesione do §6b Blok 2 jako PO.1–PO.7, z kolejnością wg rekomendacji DEC.1 |
| DEC.1 pkt 4 | `docs/karty/I15.10b/karta.md` ma `Stan: ⬜` mimo zmergowanego PR | ✅ nieaktualne — karta ma dziś `✅ 2026-09-23` |
| TEST.3 pkt 4 | brak twardej bramki na `SELLY_CSV_DIR` — rozważyć przed cutoverem | ✅ wniesione do §6a jako ostrzeżenie środowiskowe **i** do §6b Blok 3 |
| TEST.2 pkt 2 | pułapka: żywy generator produkcji bierze się z `origin/main`, nie z `mirror/` na `develop` | ⬜ zostaje w karcie TEST.2 — to ostrzeżenie dla przyszłej karty, nie pozycja planu |

**Nie zrobiono świadomie:**
- `docs/karty/*/karta.md` — nietykane (własność zamkniętych kart, CLAUDE.md pkt 0).
- `CLAUDE.md` — TEST.3 pkt 3 zgłasza w nim błędny odsyłacz (`mirror/backend/CHANGELOG.md:101`,
  dziś inny wpis; dowód jest w `deminified/README.md`). Poprawka `CLAUDE.md` to osobna decyzja
  użytkownika, nie ticket koordynacyjny.
- `.claude/commands/feature.md` — TEST.3 pkt 1 zgłasza brak jawnego kroku „utwórz NOWY wpis
  backlogu dla świadomej zmiany". Zmiana komendy = osobna decyzja użytkownika.
- `docs/cutover.md` — TEST.3 pkt 5 proponuje odsyłacz do `instrukcja-pracy-dla-ani.md`.
  Nie wnoszę: `cutover.md` będzie edytowany przy oknie, a §6b Blok 5 już niesie tę informację.

## 4. Znaleziona niespójność, której nikt nie zgłosił

`docs/instrukcja-pelnego-testu.md` (ticket 149) pyta Anię w sekcji „Do Twojej decyzji" punkt 1
o **priorytet reguł** — a wpis `#89` został zamknięty jej własną decyzją dzień wcześniej
(ticket 155, „zostawiamy jak jest"). Oba tickety szły równolegle, więc żaden nie mógł tego
złapać. Skutek jest nieszkodliwy (Ania odpowie „A" drugi raz), więc **nie edytuję dokumentu,
który jest już u niej** — odnotowane w §6a jako ⚠ przy tym pytaniu.
