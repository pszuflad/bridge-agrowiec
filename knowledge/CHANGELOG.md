# CHANGELOG — Bridge dla Agrowca

Chronologiczny rejestr zmian we froncie, backendzie i schemacie bazy projektu Bridge (panel.agritires.eu).
Zbudowany z dziennych notatek wiki (`learnings/`), strony projektu (`projects/bridge-agrowiec.md`) i transkryptów sesji, ponieważ w repozytorium kodu nie jest prowadzony osobny plik `CHANGELOG.md`.

Format wpisu: **data · obszar · plik/miejsce · opis · powód**.
Obszary: `BACKEND`, `FRONTEND`, `SCHEMAT/DANE`, `PARSER`, `SELLY`, `INFRA/REPO`, `BEZPIECZEŃSTWO`.

Zakres: od ostatniego eksportu (2026-07-23) do daty tego eksportu (2026-08-17).

---

## 2026-08-06 — Zabezpieczenie API, klasyfikator, wycofania, moduł Atrybuty (sesja `626ef740`)

- **2026-08-06 · BEZPIECZEŃSTWO/BACKEND · `index.cjs` (trasy `/api/dostawcy`, `/api/suppliers`, `/api/products`)** — objęto trasy API katalogu tym samym middleware autoryzacji JWT co panel. *Powód:* API było publicznie dostępne bez logowania; Selly nadal pobiera statyczny CSV, więc kontrakt integratora się nie zmienia.
- **2026-08-06 · SCHEMAT/DANE · staging (status `wycofana`)** — produkt trafia do stagingu jako `wycofana` dopiero po nieobecności w trzech kolejnych importach dostawcy. *Powód:* ograniczenie fałszywych alarmów z niepełnego pliku importu jednego dnia.
- **2026-08-06 · PARSER · klasyfikator `Zc()`** — rozszerzono rozpoznawanie branżowych formatów rozmiarów: skid-steer z częścią dziesiętną, `VF`, wartości całkowite, ułamkowe, modele `TR-`, sygnały `PR TL/TT`. *Powód:* poprawne klasyfikowanie opon; rekordy bez danych rozpoznawczych pozostają odrzucone.
- **2026-08-06 · BACKEND · `atrybuty_module.cjs`, trasy `/api/atrybuty*`** — usunięto sześć starszych tras `/api/atrybuty*`, które przesłaniały moduł; ujednolicono do jednej chronionej ścieżki. Podgląd produktów działa dla 15 typów, błędy autoryzacji są jawne, token czytany z `sessionStorage` i `localStorage`. *Powód:* duplikaty tras powodowały konflikty i maskowały właściwy moduł.
- **2026-08-06 · SCHEMAT/DANE · słownik `atrybuty_wartosci`** — usunięto 1755 z 6899 wartości nieużywanych przez żaden produkt (po pełnym przeliczeniu użycia). *Powód:* porządkowanie słownika; puste `sezon` i `wentyl` wynikają z pustych kolumn produktów.

## 2026-08-04 — Identyfikacja publicznych endpointów (sesja `d35fafff`)

- **2026-08-04 · BEZPIECZEŃSTWO/BACKEND · API dostawcy i produktów** — zidentyfikowano, że API dostawcy i produktów jest otwarte (dostępne bez logowania, można pobrać wszystkie dane). *Powód:* diagnoza poprzedzająca zabezpieczenie tras JWT z 2026-08-06.

## 2026-07-31 — „Zapamiętaj mnie", jakość danych, eksport OT/CSV (sesje `204b8fdb`, `f99ad55a`, `fc2830c5`)

- **2026-07-31 · FRONTEND · bundle panelu (`localStorage`/`sessionStorage`)** — frontend zapisuje token w `localStorage` po zaznaczeniu „zapamiętaj mnie", a bez zaznaczenia w `sessionStorage`. Pierwsza poprawka bundle wymagała zmiany nazw funkcji po kolizji ze zminifikowanym komponentem Radix UI Toast. *Powód:* implementacja trwałości sesji logowania. (Otwarte: trwałość po zamknięciu przeglądarki nadal do weryfikacji.)
- **2026-07-31 · BEZPIECZEŃSTWO · ekran logowania** — ekran logowania nie pokazuje już przykładowych/testowych kont. *Powód:* usunięcie danych testowych z UI. (Otwarte: twardo zapisane dane kont nadal w bundle — osobna poprawka.)
- **2026-07-31 · BACKEND · `/api/password/change`** — zmiana hasła działa jako operacja zalogowanego użytkownika. *Powód:* podstawowa obsługa zmiany hasła; reset e-mailem zależny od wyboru transportu poczty.
- **2026-07-31 · PARSER · Handlopex (`labelSnow`, `labelIce`)** — brak etykiety zapisywany jako `null`, nie `0`; wyczyszczono wartości śniegu bez potwierdzenia `MS`/`3PMSF`. *Powód:* import nie może przedstawiać braku danych jako cechy opony.
- **2026-07-31 · SCHEMAT/DANE · eksport OT (format biznesowy)** — pola logiczne eksportują `Tak` albo pusto; `SB/SF/HF/LS` jako `Tak`; konstrukcja `R`→`Radialna`, `D/L/B`→`Diagonalna`; `PR` w postaci `{liczba}PR`. *Powód:* dopasowanie eksportu do formatu biznesowego.
- **2026-07-31 · SCHEMAT/DANE · kolumna `Szerokość opony`** — zachowanie zer dziesiętnych; formaty bez ukośnika pokazują oba segmenty przed średnicą (`16x6-8`→`16x6`), formaty z ukośnikiem (`425/50x18`) bez zmian. *Powód:* zachowanie branżowego zapisu szerokości.
- **2026-07-31 · SELLY · eksport HTTP `ex-port-files`** — stabilny eksport generuje pełny CSV z BOM UTF-8 i separatorem `;`, ograniczony na serwerze do IP integratora Selly. *Powód:* integrator mapuje wybrane kolumny i ignoruje resztę — pełny plik jest właściwym kształtem.

## 2026-07-28 — Poprawki produkcyjne parserów, danych, eksportu CSV, kolumn (sesja `fc2830c5`)

- **2026-07-28 · PARSER/SCHEMAT · parsery MO, prezentacja kolumn** — produkcyjne poprawki parserów, danych, eksportu CSV i prezentacji kolumn katalogu. *Powód:* bieżące utrzymanie jakości danych katalogu.
- **2026-07-28 · SELLY · planowanie API/layoutu** — planowanie API i layoutu Selly, wizualizacje strony kategorii (sesje `685eb28d`, `e9f305c1`). *Powód:* przygotowanie warstwy prezentacji sklepu.

## 2026-07-25 — Handover i plan migracji do repozytorium (sesja `7fcd8b97`)

- **2026-07-25 · INFRA/REPO · dokumentacja migracji** — przygotowano sanitizowany handover techniczny i plan przeniesienia Bridge do repozytorium; decyzje migracyjne utrwalono na stronie projektu. *Powód:* przejście na Git jako źródło prawdy dla kodu.

## 2026-07-24 — Projekt modelu GitHub/CI, audyt źródeł (sesje `b4336cb4`, `11a52e4b`, `7136cd47`, `cc24a1be`)

- **2026-07-24 · INFRA/REPO · model wdrożeń** — zaprojektowano GitHub/CI jako źródło prawdy: gałąź `develop` → środowisko testowe, `main` → produkcja; VPS przechowuje tylko runtime, sekrety, bazy SQLite i procesy PM2 poza commitem. *Powód:* uporządkowanie wdrożeń i wersjonowania.
- **2026-07-24 · INFRA/REPO · zakres pierwszego repo** — ustalono, że pierwszy stan repo obejmuje czytelne moduły backendu, parsery, sanitizowaną konfigurację, wdrożony bundle frontendu i dokumentację; `.env`, `data.db*`, backupy, logi, `node_modules` poza Git. *Powód:* brak źródeł Reacta nie powinien blokować utworzenia repo.
- **2026-07-24 · FRONTEND · ocena stanu źródeł** — potwierdzono, że aktywny frontend produkcyjny to zbudowany bundle z injection scripts, bez pełnego drzewa React/Vite na produkcji. *Powód:* małe zmiany UI idą jako nowy skrypt wstrzyknięcia; głębokie zmiany wymagają odzyskania/odbudowy źródeł.

---

## Ustalenia infrastrukturalne (ścieżki serwera)

- **FRONTEND · ścieżka publiczna** — rzeczywisty panel serwowany przez Apache z `/home/admin/domains/agritires.eu/public_html/panel/`; `/home/admin/private_apps/bridge/public/` na porcie 5000 to nieużywany fallback. Poprawki bundle muszą trafiać do pierwszej ścieżki. (sesja `fc2830c5`)
- **BACKEND · ścieżka runtime** — żywy backend pod `/home/admin/private_apps/bridge/`.

## Otwarte pozycje (stan na 2026-08-17)

- **BACKEND/IMPORT** — zweryfikować mechanizm trzech potwierdzeń wycofania na kolejnych automatycznych importach.
- **SCHEMAT/DANE** — zdecydować, czy atrybuty `sezon` i `wentyl` pozostają puste, czy będą uzupełniane.
- **FRONTEND/LOGIN** — ustalić, dlaczego po zamknięciu całej przeglądarki „zapamiętaj mnie" nadal nie utrzymuje sesji.
- **BEZPIECZEŃSTWO** — usunąć twardo zapisane dane testowych kont z publicznego bundle frontendu.
- **PARSER/DANE** — utrwalić w adapterach reguły kategorii, szerokości i DOT, aby poprawki nie wracały po imporcie; rozstrzygnąć `MO2_GLO00131`, `MO2_55002475`, standaryzację 139 grup modeli.
- **SELLY** — naprawić widoczność numerów telefonu w mobilnym topbarze; dokończyć konfigurację E06.

---

Źródła (sesje Perplexity): `626ef740`, `d35fafff`, `204b8fdb`, `f99ad55a`, `fc2830c5`, `685eb28d`, `e9f305c1`, `7fcd8b97`, `b4336cb4`, `11a52e4b`, `7136cd47`, `cc24a1be`, `9d749782`.
Pełne transkrypty tych sesji znajdują się w `space/sessions/`.
