# Bridge dla Agrowca — plan odbudowy projektu

*Wersja z 2026-07-24. Dokument roboczy — aktualizowany w miarę postępu.*

Powiązane dokumenty:
- [README.md](README.md) — audyt stanu obecnego (źródła, schemat, dane, API)
- [audyt-vps.sh](audyt-vps.sh) — skrypt audytu serwera (wykonany, §2.8 README)
- [PROMPT-dokumentacja-backendu.md](PROMPT-dokumentacja-backendu.md) — dokumentacja backendu przez Perplexity
- `PROMPT-dokumentacja-frontendu.md` — dokumentacja frontendu przez Perplexity

---

## Punkt wyjścia — co wiemy na pewno

- **Kodu źródłowego nie ma i nie da się go odzyskać.** Sprawdzono lokalnie,
  w Space Perplexity, na Google Drive, w archiwach ZIP i **na samym VPS**
  (audyt 2026-07-24): zero `.tsx`, zero `src/`, zero source map, zero repo Git.
- Backend to zminifikowany bundle `index.cjs` (MD5 `3eca99b8…`) + czytelne moduły.
- Frontend to zminifikowany bundle Vite — **100% bez źródeł**.
- **Mamy mocne fundamenty odbudowy:** snapshot bazy produkcyjnej (26 tabel,
  6941 produktów o zweryfikowanej jakości), instrukcję obsługi z 17 zrzutami UI,
  98 zinwentaryzowanych endpointów, ~276 kopii `.bak` na produkcji = faktyczny
  changelog, oraz bazę wiedzy z regułami biznesowymi.
- **Aplikacja żyje i jest rozwijana.** Ania nadal wprowadza zmiany przez
  Perplexity computer. To jest ruchomy cel — plan musi to uwzględniać.

## Zasada przewodnia

**Nie wielki przepis „big bang", tylko odbudowa przy żywym pacjencie.**
Stary system działa do dnia, w którym nowy udowodni, że zachowuje się identycznie.
Kolejność: najpierw zamrozić i zmierzyć obecne zachowanie, potem odtwarzać,
na końcu przełączać — komponent po komponencie, z możliwością rollbacku.

---

## Faza 1 — Zabezpieczenie ruchomego celu *(najpilniejsze)*

Dopóki tego nie ma, każdy dzień pracy Ani to zmiana, którą tracimy z oczu.

### 1.1 Ciągły zapis zmian Ani (changelog na produkcji)
Skonfigurować Perplexity computer tak, żeby **każdą** zmianę we froncie,
backendzie i schemacie bazy zapisywał do `CHANGELOG.md` na serwerze
(data, obszar, plik, opis, powód). Prompt konfiguracyjny — osobny dokument.
- Dowód, że to działa: ~276 kopii `.bak` o semantycznych nazwach już teraz
  pełni tę rolę mimowolnie. Formalizujemy to, zamiast zdawać się na nazwy plików.

### 1.2 Skrypt synchronizacji produkcja → maszyna deweloperska
`rsync` po SSH ściągający katalog backendu i frontendu (bez `node_modules`,
bez `data.db-wal/shm`) na maszynę dev, uruchamiany regularnie (cron / ręcznie
przed każdą sesją pracy). Ściąga też `CHANGELOG.md` i łańcuch `.bak`.

### 1.3 Repozytorium Git jako rejestr zmian
Kopia dev jest repozytorium Git. Każda synchronizacja = commit. Dzięki temu
**zmiany Ani stają się widoczne jako diffy** — nawet w zminifikowanym bundlu
`git diff` pokaże, który fragment się ruszył, a `CHANGELOG.md` powie dlaczego.
To jest odpowiedź na „jak monitorować zmiany w bundlu w trakcie odbudowy".
- Repo **prywatne** — w `knowledge/` i bazie są dane osobowe i handlowe.
- `data_snapshot.db` i sekrety poza repo (`.gitignore` już przygotowany).

**Efekt Fazy 1:** żadna zmiana Ani nie ginie; mamy ją jako (diff pliku + wpis
w changelogu) i wprowadzamy na bieżąco do naszej specyfikacji i implementacji.

---

## Faza 2 — Pełna dokumentacja i zamrożenie kontraktu API

### 2.1 Dokumentacja specyfikacji
Na podstawie przygotowanych promptów Perplexity generuje pełną dokumentację:
- **frontend** — 11 widoków (widok/dane/akcje/API/komponenty),
- **backend** — endpointy, `tk()`, warstwa `U.*`, parsery, moduły, schemat.

Każdy dokument **zestawiam z własnym audytem** — rozbieżności (np. zmyślone
endpointy, które już raz się pojawiły) wychodzą przy porównaniu.

### 2.2 Zamrożenie kontraktu API — co to znaczy

To jest fundament, na którym stoi cała reszta. „Kontrakt API" = dokładny opis
tego, **jak backend odpowiada na każde żądanie** — nie prozą, tylko w formie,
którą da się wykonać i sprawdzić maszynowo.

Składa się z dwóch warstw:

**a) Specyfikacja formalna (OpenAPI/Swagger).** Dla każdego z 98 endpointów:
ścieżka, metoda, wymagane nagłówki i autoryzacja, kształt body żądania, kształt
odpowiedzi (pola i typy), kody błędów. To jest „umowa" — spisana raz, obowiązuje
obie strony.

**b) Nagrane rzeczywiste pary żądanie↔odpowiedź (testy charakteryzujące).**
Odpytujemy **działający** backend realnymi danymi i zapisujemy dokładnie, co
zwrócił — komplet przykładów per endpoint. To jest „dowód", że umowa opisuje
rzeczywistość, a nie nasze wyobrażenie.

**Po co to, konkretnie:**

1. **Cel dla nowego frontendu.** Odbudowany panel woła te same ścieżki z tym
   samym body i dostaje ten sam kształt odpowiedzi. Bez zamrożonego kontraktu
   powtórzylibyśmy błąd, który już jest w produkcji: klient woła `/api/attributes`,
   a backend ma `/api/atrybuty` — i widok Atrybuty trzeba było ratować 50 KB
   skryptu wstrzykiwanego w DOM.

2. **Siatka bezpieczeństwa dla nowego backendu.** Gdy przepisujemy `tk()` albo
   warstwę `U.*`, puszczamy nagrane żądania na nową implementację i porównujemy
   odpowiedzi z zamrożonymi. Zgadza się co do bajta → moduł odtworzony wiernie.
   Różni się → mamy błąd, zanim dotknie produkcji. To zamienia „mam nadzieję, że
   działa tak samo" w automatyczny test.

3. **Punkt odniesienia niezależny od kodu.** Kontrakt opisuje **zachowanie**, nie
   implementację. Możemy przepisać backend dowolnie (inne moduły, inny styl,
   docelowo inna baza) i wciąż udowodnić, że z zewnątrz zachowuje się identycznie.

**Kiedy zamrozić:** teraz, na starym, działającym backendzie — zanim zaczniemy
cokolwiek odtwarzać. Kontrakt zamrożony na żywym systemie jest prawdą; kontrakt
odtworzony z przepisanego kodu byłby tylko naszą hipotezą.

**Uwaga o ruchomym celu:** skoro Ania rozwija API, kontrakt trzeba **wersjonować**
razem z changelogiem z Fazy 1. Każdy nowy/zmieniony endpoint → aktualizacja
OpenAPI + dogranie nagrania. Kontrakt żyje w repo obok kodu.

---

## Faza 3 — Plan odbudowy frontendu (na osobnym środowisku)

Krok po kroku, na oddzielnym środowisku (nie dotyka produkcji do przełączenia).
Materiały wejściowe: instrukcja + 17 zrzutów, kontrakt API z Fazy 2, łańcuch
`.bak` jako historia zmian, żywy panel do porównań.

Kolejność (od najczęściej używanych):
1. `/login` + przepływ autoryzacji + layout (sidebar + topbar)
2. `/katalog` + `/staging` — rdzeń operacyjny
3. `/alerty`, `/historia`
4. `/atrybuty` — **od razu na poprawnym API**, bez injection
5. `/narzuty`, `/konfiguracja`, `/waga-gabarytowa`, `/moje-konto`, `/` (pulpit)

Domknąć przy okazji: paginacja od pierwszego dnia (przyczyna OOM-ów), ekran
analityki (31 gotowych endpointów bez UI), ekran Selly.

**Pytanie „czy da się przez weekend":** realnie **nie dla całości**. 11 widoków
z tabelami, filtrami, drawerami i bulk-akcjami to tygodnie, nie 48 godzin.
Ale weekend jest idealny na **wdrożenie** gotowego frontendu (okno bez pracy Ani)
albo na postawienie działającego szkieletu (`/login` + layout + `/katalog`
read-only). Budujemy w tygodniach, przełączamy w weekend.

---

## Faza 4 — Plan odbudowy backendu (3 kierunki)

Backend odtwarzamy **jako jedną aplikację** (nie mikroserwisy — patrz „Decyzje").
Trzy kierunki to logiczny podział pracy i testów, nie osobne wdrożenia:

**A. Import danych od dostawców**
- Każdy parser MO1–MO10 osobno (są już czytelne — przenosimy wiernie).
- Silnik `tk()`: klasyfikacja nowe/zmiana/wycofany, auto-zatwierdzanie, staging.
- Zapis do bazy + `manual_overrides` + pamięci (`nazwa`, `waga`, `link`).
- Najtrudniejszy element całego backendu — robiony na końcu, gdy reszta ma testy.

**B. Eksport do Selly**
- Integracja jest kompletna, ale **niepodpięta** w runtime — do dokończenia.
- `client` (OAuth), `mapper`, `routes`, tabele mapowania.
- Osobno: migracja 2174 mapowań ze starych kodów bez podkreślnika.

**C. API dla frontendu**
- 98 endpointów wg zamrożonego kontraktu z Fazy 2.
- Autoryzacja, warstwa `U.*`, CRUD, analityka, paginacja.
- Weryfikacja: nagrane żądania muszą dać identyczne odpowiedzi.

Metoda dla wszystkich trzech: **stopniowe wyprowadzanie logiki z bundla do
czytelnych modułów** — ścieżka już przetarta (analytics, pagination, atrybuty,
pending powstały właśnie tak). Kolejność w kierunku C: od `auth` (łatwe) przez
`storage`/`staging` do `tk()` (najtrudniejsze, ostatnie).

Przy okazji domknąć dryf schematu (4 tabele + 2 kolumny bez kodu tworzącego),
`JWT_SECRET` bez fallbacku, zawężenie CORS, jedną rejestrację tras.

---

## Faza 5 — Wdrożenie produkcyjne

1. Nowy backend obok starego, na kopii bazy; porównanie odpowiedzi z kontraktem.
2. Nowy frontend na tym samym API.
3. Przełączenie w oknie serwisowym, **stary bundle zachowany jako rollback**.
4. Dopiero po stabilizacji — sprzątanie repo (lista w README §7.4).

---

## Faza 6 (opcjonalna, później) — migracja bazy na PostgreSQL

**Nie na starcie.** SQLite obsługuje obecne obciążenie bez problemu (25 MB danych,
2 użytkowników, import wsadowy). Migracja na Postgres ma sens dopiero, gdy pojawi
się realna potrzeba: więcej równoczesnych użytkowników, zapisy współbieżne,
raportowanie na żywo, replikacja. Do tego czasu byłaby to komplikacja bez zysku.

Warunek wejścia w tę fazę: nowy backend działa produkcyjnie i ma zamrożony
kontrakt — wtedy zmiana bazy pod spodem jest bezpieczna, bo kontrakt udowodni,
że zachowanie się nie zmieniło. Warstwa `U.*` powinna być tak napisana, żeby
podmiana silnika bazy była lokalną zmianą, nie przepisaniem aplikacji.

---

## Decyzje architektoniczne

**Odrzucone: mikroserwisy.** Wcześniejsza wersja planu zakładała rozbicie
backendu na osobno wdrażane mikroserwisy (API / importer / eksporter) na wspólnej
bazie. **Rezygnujemy.** Uzasadnienie:
- Nie rozwiązują żadnego realnego problemu tego projektu (skala jest mała,
  jeden zespół, jedna baza).
- Dokładają złożoność tam, gdzie właśnie walczymy o jej redukcję: osobne
  wdrożenia, komunikacja między usługami, więcej ruchomych części.
- „3 kierunki" z Fazy 4 dają ten sam podział logiczny (import / eksport / API)
  bez kosztu operacyjnego — jako moduły jednej aplikacji, nie osobne usługi.

Odbudowa celuje w **jedną, czytelną aplikację** o tej samej architekturze co
oryginał (Node + Express + Drizzle + SQLite), tylko z odzyskanymi źródłami
i kontrolą wersji.

---

## Kolejność wykonania — skrót

| # | Faza | Zależy od | Blokuje |
|---|---|---|---|
| 1 | Zabezpieczenie zmian (changelog + rsync + Git) | — | wszystko |
| 2 | Dokumentacja + zamrożenie kontraktu API | 1 | 3, 4 |
| 3 | Odbudowa frontendu (osobne środowisko) | 2 | 5 |
| 4 | Odbudowa backendu (import / eksport / API) | 2 | 5 |
| 5 | Wdrożenie produkcyjne | 3, 4 | 6 |
| 6 | (opcjonalnie) PostgreSQL | 5 | — |

Fazy 3 i 4 mogą iść **równolegle** — łączy je kontrakt API z Fazy 2.

## Pierwsze konkretne kroki

1. `git init` na katalogu projektu (`.gitignore` gotowy) + pierwszy commit stanu.
2. Skrypt `rsync` produkcja → dev (Faza 1.2).
3. Prompt konfigurujący changelog Ani na produkcji (Faza 1.1).
4. Uruchomić dwa prompty dokumentacyjne, zestawić wynik z audytem (Faza 2.1).
5. Nagrać kontrakt API na żywym backendzie (Faza 2.2).

Niezależnie, natychmiast (produkcja cierpi): naprawić feed MO3 (nie działa od
2026-07-06), włączyć powiadamianie o alertach.
