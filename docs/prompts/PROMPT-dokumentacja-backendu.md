# Prompt do Perplexity — pełna dokumentacja techniczna backendu Bridge

> Skopiuj wszystko poniżej linii i wklej do Perplexity (konto/Space z agentami
> pracującymi nad Bridge, z dostępem do VPS `vpshd1242.cyber-folks.pl`).
> Zadanie wymaga **czytania rzeczywistych plików i żywej bazy na serwerze**,
> nie pamięci.

---

Pracujesz nad projektem **Bridge dla Agrowca** (panel.agritires.eu). Odtwarzam
backend jako czysty projekt — kod źródłowy nie istnieje (audyt VPS 2026-07-24:
`index.cjs` to zminifikowany bundle esbuild, brak `.ts`, brak `src/`, brak repo
Git). Do odbudowy potrzebuję **kompletnej dokumentacji technicznej backendu** —
takiej, z której da się napisać identycznie zachowujący się serwer.

## ⚠ Zasada nadrzędna: zero zgadywania, wszystko z plików i z żywej bazy

Wcześniejsza dokumentacja frontendu, którą przygotowałeś, zawierała **zmyślone
endpointy** (`/api/import/run`, `/api/products/export`, tabelę `products_staging`
zamiast `staging_items` itd.) — wszystkie nieprawdziwe. Ten sam błąd po stronie
backendu byłby jeszcze groźniejszy, bo backend jest kontraktem dla całej aplikacji.

Dlatego: **każdy endpoint, każda tabela, każda kolumna musi pochodzić z konkretnego
pliku albo z żywej bazy i być zacytowana.** Czego nie da się potwierdzić — oznacz
„NIEZNANE". Nie podawaj wersji prawdopodobnej.

## Architektura, którą dokumentujesz (dla orientacji)

Backend ma dwie warstwy:
- **Rdzeń** — `/home/admin/private_apps/bridge/index.cjs` (zminifikowany bundle,
  632 linie, MD5 `3eca99b8d78118dba682d651588ccbb7`). Zawiera: autoryzację,
  warstwę dostępu do danych, silnik importu `tk()`, przeliczanie cen i ~42 trasy.
- **Moduły czytelne** (obok, jako `.cjs`) — parsery MO1–MO10, `analytics_module`,
  `pagination_module`, `atrybuty_module`, `pending_module`, `bridge_ext`,
  `extensions`, integracja `selly/`.

Dokumentacja ma pokryć **obie warstwy** i pokazać, jak są spięte.

## Krok 0 — potwierdź tożsamość rdzenia i wypisz moduły

```bash
cd /home/admin/private_apps/bridge
md5sum index.cjs; wc -l index.cjs           # potwierdź MD5 i liczbę linii
ls -la *.cjs parsers/*.cjs selly/*.cjs      # lista modułów czytelnych
cat package.json                            # realne zależnności
```

Podaj MD5 i listę modułów na początku dokumentacji.

## Krok 1 — deminifikacja rdzenia

```bash
mkdir -p /tmp/bridge_be && cd /tmp/bridge_be
cp /home/admin/private_apps/bridge/index.cjs be.cjs
npx prettier --write be.cjs 2>/dev/null || npx js-beautify -r be.cjs
```

Rdzeń po upiększeniu jest czytelny — nazwy funkcji przetrwały minifikację
(np. `recalcPricesFromRules`, `tk`, `listAtrybuty`). Zmangowane są tylko
identyfikatory modułowe; mapowanie tabel Drizzle, gdyby się przydało:
`he`=products, `He`=staging_items, `Bt`=markups, `hn`=promotions,
`Ot`=suppliers, `dt`=users, `Yt`=manual_overrides, `X`=uchwyt Drizzle,
`U`=warstwa danych, `we`=middleware auth.

## Krok 2 — inwentarz endpointów (KOMPLETNY, zweryfikowany)

Wyciągnij **wszystkie** trasy — z rdzenia i z modułów:

```bash
grep -oE '(e|app|router)\.(get|post|put|patch|delete)\("/api/[^"]+"' be.cjs | sort -u
grep -rhoE '(app|router)\.(get|post|put|patch|delete)\(\s*["'"'"'][^"'"'"']+' \
  /home/admin/private_apps/bridge/*.cjs /home/admin/private_apps/bridge/selly/*.cjs | sort -u
```

Dla **każdego** endpointu podaj tabelę: `metoda | ścieżka | plik i linia, gdzie
zarejestrowany | czy wymaga auth (middleware we/requireAuth) | body żądania |
kształt odpowiedzi`. Body i odpowiedź **odczytaj z kodu**, nie wymyślaj.

**Szczególnie oznacz podwójne rejestracje.** Wiem, że `analytics_module`
i `pagination_module` są ładowane dwa razy (raz przez `extensions.cjs`, raz
bezpośrednio z rdzenia), a trasy `/api/atrybuty/*`, `/api/history/paged`,
`/api/staging/:id` istnieją równolegle w rdzeniu i w modułach. **Ustal, która
rejestracja faktycznie wygrywa** (Express bierze pierwszą pasującą) — to
przesądza, który kod jest żywy, a który martwy.

## Krok 3 — schemat bazy z ŻYWEJ bazy (nie z pamięci)

```bash
sqlite3 /home/admin/private_apps/bridge/data.db .schema > /tmp/bridge_be/schema.sql
sqlite3 /home/admin/private_apps/bridge/data.db \
  "SELECT name, (SELECT COUNT(*) FROM pragma_table_info(name)) cols FROM sqlite_master WHERE type='table' ORDER BY name;"
```

Udokumentuj **każdą tabelę**: nazwa, kolumny z typami, klucze, indeksy, liczba
wierszy. Dla porównania — mój audyt snapshotu z 2026-07-23 wykazał **26 tabel**,
`products` z **71 kolumnami**. Potwierdź albo skoryguj względem żywej bazy
(może się różnić, jeśli od tego czasu coś doszło).

**Analiza dryfu (ważne).** Trzy tabele i dwie kolumny istnieją w bazie, ale
**żaden kod ich nie tworzy** — istnieją tylko dlatego, że ktoś je dodał ręcznie:
`atrybuty_wartosci_pending`, `atrybuty_wartosci_odrzucone`,
`selly_kategoria_norm_map`, `selly_zastosowanie_category_map` (z plików `*_pplx.sql`),
oraz kolumny `products.kod_importu` i `products.zastosowanie`. Dla każdego takiego
obiektu **znajdź, gdzie jest UŻYWANY w kodzie, a gdzie (nie) TWORZONY** — czysta
instalacja się na tym wywali, więc dokumentacja musi to wychwycić. Zweryfikuj
grepem, czy lista jest kompletna, czy jest tego więcej.

## Krok 4 — silnik importu `tk()` (najważniejsza funkcja backendu)

To rdzeń całej logiki i najtrudniejsza do odtworzenia część. Znajdź `function tk(`
w `be.cjs` i opisz **dokładnie**:
- sygnaturę i co przyjmuje (`tk(dostawca, surowe)`),
- jak porównuje nowe dane z istniejącym katalogiem,
- **reguły klasyfikacji**: kiedy wpis jest `nowy`, `zmiana ceny`, `zmiana stanu`,
  `wycofany`, `bez zmian`,
- kiedy zmiana jest **auto-zatwierdzana**, a kiedy idzie do `staging_items`,
- jak działa detekcja „czy to opona" i generowanie kodu zastępczego,
- jak wchodzi w grę `manual_overrides` (blokady pól),
- jak liczony jest `kod_importu` (grupowanie wielomagazynowe po EAN / marka|rozmiar).

Podaj to jako **pseudokod albo diagram decyzyjny** wyprowadzony z realnego kodu.

## Krok 5 — warstwa dostępu do danych `U.*`

Rdzeń ma obiekt `U` z ~47 metodami (`acceptStaging`, `addProductsBulk`,
`listProductsPaged`, `upsertOverride`, `rejectStaging`…). Wypisz **wszystkie**
metody: nazwa, argumenty, jaką operację SQL wykonuje (z kodu), którą tabelę
dotyka. To jest kontrakt warstwy danych do odtworzenia.

## Krok 6 — parsery, moduły, integracje

- **Parsery MO1–MO10** — dla każdego: format wejścia, mapowanie kolumn, reguły
  szczególne (są już czytelne, więc streść wiernie). Plus `dispatcher`, `adapter`,
  `tyre_params`, `common`.
- **MO9/Agrorami** — dlaczego idzie przez `execFileSync` i GraphQL, a nie CSV;
  jak działa `_agrorami_fetch_helper.cjs`; które pole daje stan (`in_stock_real`).
- **Moduły** — `analytics_module` (31 endpointów), `pagination_module`,
  `atrybuty_module`, `pending_module`, `bridge_ext` (wymiary, pamięci), `extensions`
  (import v6, scheduler auto-pull): co każdy rejestruje i robi.
- **Selly** (`client`/`mapper`/`routes`) — kompletna integracja, ale sprawdź:
  **czy `selly/routes.cjs` jest faktycznie rejestrowane w runtime?** (u mnie
  wychodzi, że nie — potwierdź). Opis OAuth, mappera, tabel mapowania.
- **Scheduler** — jak działa auto-pull, częstotliwości per dostawca.

## Krok 7 — konfiguracja, środowisko, przekroje

- **Zmienne środowiskowe** — TYLKO nazwy z `.env` (bez wartości). Potwierdź:
  `JWT_SECRET` (i czy jest zahardkodowany fallback w kodzie), `PORT`, `SELLY_*`,
  `AGRORAMI_*`, `BRIDGE_DB*`.
- **Klucze `config`** z bazy: `sqlite3 data.db "SELECT klucz FROM config;"`
- **CORS** — jak skonfigurowany (podejrzewam odbijanie dowolnego Origin
  z credentials — potwierdź z kodu).
- **Uruchamianie** — PM2 czy inaczej? Audyt pokazał, że `pm2` nie jest w PATH,
  mimo `ecosystem.config.cjs` — sprawdź, czym proces faktycznie chodzi
  (`ps aux | grep node`, `systemctl`, cron).
- **Uchwyty do bazy** — ile niezależnych połączeń do `data.db` otwiera runtime
  (rdzeń + moduły) i czy to problem.
- **Obsługa błędów** — gdzie jest globalny handler i czy łapie błędy z modułów
  ładowanych po nim.

## Format odpowiedzi

- **Tabela zbiorcza na początku:** MD5 rdzenia, liczba endpointów (rdzeń vs moduły),
  liczba tabel, lista obiektów dryfu, status Selly (podpięte/nie).
- **Pełny inwentarz endpointów** (Krok 2) — tabela.
- **Schemat bazy** (Krok 3) — z żywej bazy, plus tabela dryfu.
- **`tk()` jako pseudokod/diagram** (Krok 4).
- **Metody `U.*`** (Krok 5) — tabela.
- Reszta w sekcjach per obszar.

## Twarde zasady

- **Każdy endpoint — zacytowana linia z pliku.** Bez cytatu = pomijasz.
- **Schemat — z `sqlite3 .schema` na żywej bazie**, nie z pamięci.
- **Nie ujawniaj sekretów** (`.env`, `JWT_SECRET`, hasła Agrorami, klucze Selly).
- **Nie modyfikuj produkcji.** Cała praca na kopiach w `/tmp`.
- Niepewne = **„NIEZNANE"**.
- Spakuj wynik do ZIP-a do pobrania.

## Po co mi to

Odtwarzam backend jako czysty projekt (Node + Express + Drizzle/SQLite, ten sam
stack), przez stopniowe wyprowadzanie logiki z rdzenia do modułów — tak jak już
zrobiono z analityką i paginacją. Twoja dokumentacja jest wejściem do tej pracy.
**Zweryfikuję każdy zacytowany endpoint, tabelę i kolumnę względem własnego
audytu** (mam zweryfikowane 98 endpointów, 26 tabel, 71 kolumn `products`, listę
dryfu i 47 metod `U.*`) — rozbieżności i tak wyjdą, więc lepiej, żeby ich nie było.
