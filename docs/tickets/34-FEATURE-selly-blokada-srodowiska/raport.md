# 34-FEATURE-selly-blokada-srodowiska — raport z implementacji

## Podsumowanie

Staging nie ma już fizycznej możliwości ani wysłać czegokolwiek do sklepu Selly, ani nadpisać
produkcyjnego pliku CSV. Dwa niezależne zamki: **`SELLY_TRYB`** (twarda blokada w obwolucie
klienta, domyślnie `wylaczony`) i **bezpieczne ścieżki CSV ustawiane przez skrypt deployu**.

⚠ Drugi problem był **groźniejszy niż ten, o który pytał użytkownik**, i nie miał z sekretami
Selly nic wspólnego — patrz niżej.

## Zmiany

**Backend (nowe):**
- `src/selly/tryb.ts` — `TrybSelly`, `METODY_ZAPISUJACE`/`METODY_ODCZYTU`, `BlokadaSelly`,
  `komunikatBlokady`, `opakujKlientaTrybem`.
- `test/selly.tryb.test.ts` — 12 testów obwoluty, w tym **test kompletności listy metod**.
- `test/selly.tryb.trasy.test.ts` — 7 testów end-to-end na trasach.

**Backend (zmienione):**
- `src/config/env.ts` — `SELLY_TRYB` (enum, domyślnie `wylaczony`).
- `src/app.ts` — opakowanie klienta budowanego z env; klient wstrzyknięty nietknięty.
- `.env.example` — `SELLY_TRYB` + ostrzeżenie o ścieżkach CSV.

**Deploy:**
- `tools/deploy-staging.sh` — eksport `SELLY_TRYB=wylaczony` i bezpiecznych `SELLY_CSV_*`
  **przed** wczytaniem `.env` (które nadal może je świadomie nadpisać).

**Frontend:**
- `src/pages/selly/api.ts` — `czyIntegracjaWylaczona`, `czyZapisZablokowany`.
- `src/pages/selly/BladSekcji.tsx` — dwa nowe warianty komunikatu, sprawdzane **przed** brakiem
  konfiguracji.
- `test/selly.brak-konfiguracji.test.tsx` — 6 nowych testów (rozpoznanie + rozłączność stanów
  + widok).

**Dokumentacja:** `docs/deploy-setup.md`, `docs/rebuild-backlog.md` (#46, #47),
`docs/rebuild-roadmap.md` (blok I8).

## Znalezisko, którego ticket pierwotnie nie dotyczył

Pytanie brzmiało „jak zablokować integrację z Selly na stagingu". Przy weryfikacji okazało się,
że **groźniejsza jest inna ścieżka**:

`SELLY_CSV_DIR` ma domyślną wartość wskazującą katalog **produkcyjny**
(`public_html/panel/ex-port-files`) — poprawną dla produkcji, bo odtwarza dwa zahardkodowane
miejsca oryginału. Ale staging stoi **na tym samym VPS i tym samym userze**, a
`deploy-staging.sh` tej zmiennej nie ustawiał. Kliknięcie **„Wygeneruj CSV teraz"** na stagingu
nadpisywało więc produkcyjny plik CSV treścią **z bazy stagingowej**, a Selly zaciąga go o 6:00.

**Dlaczego to omijało zabezpieczenie, o które pytał użytkownik:** `POST /api/selly/generate-csv`
jest trasą **lokalną** — działa **bez żadnych sekretów `SELLY_*`**. Blokada oparta na ich braku
nie dotyczyła jej w ogóle.

**Konsekwencja dla dokumentacji:** `docs/instrukcja-testow-I8.md` (PR #44) opisuje ten tryb jako
„ryzyko: zero" i „klikaj bez obaw". **To było nieprawdziwe.** Poprawka idzie w gałęzi PR #44,
gdzie ten plik żyje — patrz „Follow-up".

## Odstępstwa od planu

Brak co do zakresu. Dwa drobiazgi wykryte przy pisaniu testów:

1. **`srodowisko.posprzataj()`, nie `zamknij()`** — pomyliłem nazwę metody sprzątającej
   w helperze testowym.
2. **Testy synchronizacji wymagają dostawcy `MO9`, nie `MO1`** — `zasiejProdukty` sieje
   produkty MO9 (zgodnie z fixture'ami). Na MO1 lista do synchronizacji jest pusta, więc test
   „pełny sync tworzy produkty" niczego by nie dowodził. Ten sam wybór ma istniejący
   `selly.synchronizacja.test.ts`.

## Wyniki testów

- **Gate odbudowy: ✓ N/D dla kontraktu, przeszedł bez zmian.** Ticket **nie zmienia kontraktu** —
  żadna ścieżka nie znika, nie zmienia metody ani kształtu odpowiedzi; zmienia się wyłącznie
  treść błędu 500 na zablokowanym środowisku, a `openapi.yaml` treści błędów nie opisuje.
  GATE 8a/8b przeszedł **bez modyfikacji** — dowód, że klient wstrzykiwany w testach nie jest
  opakowywany (D3).
- **Backend: ✓ 1043/1043** (67 plików). Nowe: 12 + 7 = 19 testów.
- **Frontend: ✓ 639/639** (43 pliki). Nowe: 6 testów.
- **Lint / typecheck / build: ✓** po obu stronach.
- `bash -n tools/deploy-staging.sh` — składnia OK.

### Co konkretnie udowadniają testy

| Dowód | Gdzie |
|---|---|
| ⭐ Lista metod zapisujących **pokrywa się z interfejsem `KlientSelly`** — nowa metoda zapisu nie ominie blokady po cichu | `selly.tryb.test.ts` §1 |
| `pelny` zwraca **ten sam obiekt** — produkcja nie płaci za mechanizm, którego nie używa | §2 |
| `wylaczony` — **wszystkie 11 metod rzuca**, zero wywołań dociera do klienta | §3 |
| `tylko-odczyt` — 5 odczytów przechodzi, **każdy z 6 zapisów rzuca** | §4 |
| ⭐ `sync-supplier` z `dry_run: true` **działa** w `tylko-odczyt`, z `dry_run: false` — nie tworzy niczego | `selly.tryb.trasy.test.ts` |
| Trasy **lokalne działają dalej** przy pełnej blokadzie | jw. |
| Trzy stany błędu (**brak konfiguracji / integracja wyłączona / zapis zablokowany**) są rozłączne | `selly.brak-konfiguracji.test.tsx` |

## Breaking changes

**Jeden, świadomy i wymagający działania przy wdrożeniu na produkcję.**

`SELLY_TRYB` jest domyślnie `wylaczony`, więc **produkcja musi ustawić `SELLY_TRYB=pelny`
jawnie**, inaczej integracja Selly przestanie działać. Wybrano ten kierunek świadomie (D2):
pomyłka daje wtedy **widoczny błąd** („nie działa"), a nie **cichy zapis do cudzego, żywego
sklepu**. Ta asymetria skutków przeważyła nad wiernością wartości domyślnej.

Staging nie wymaga niczego — `deploy-staging.sh` ustawia wszystko sam.

## Follow-up

- **⚠ Poprawka `docs/instrukcja-testow-I8.md` w gałęzi PR #44** — zdanie „tryb A: ryzyko zero"
  i „klikaj bez obaw" przy generowaniu CSV. Po tym tickecie tryb A **jest** bezpieczny, ale
  z innego powodu niż tam napisano, i instrukcja musi to opisywać poprawnie. **Do zrobienia
  przed merge'em #44.**
- **Blokada sieciowa (egress) na VPS** — najmocniejsza warstwa, bo nie zależy od poprawności
  naszego kodu. Użytkownik: „nie wiem, czy się da". ⬜ Do sprawdzenia na cyber_Folks (bez roota
  prawdopodobnie niedostępne).
- **Decyzja, czy staging w ogóle dostaje sekrety `SELLY_*`** — po tym tickecie można je ustawić
  bezpiecznie, bo `SELLY_TRYB=wylaczony` i tak zablokuje wszystko; do rozważenia
  `tylko-odczyt`, gdyby Ania miała testować ping i dry-run.
