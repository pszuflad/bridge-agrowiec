# Bridge dla Agrowca — podsumowanie techniczne frontendu

## Zakres i zasada odtworzenia

Dokument opisuje wyłącznie zachowanie potwierdzone w dostarczonym bundlu, CSS, instrukcji v5 oraz definicjach backendu. Każda informacja ma odwołanie `plik:linia`; element bez potwierdzenia oznaczono jako **NIEZNANE**. Dokumentacja nie zawiera wartości sekretów ani danych uwierzytelniających. [brief:1-18]

## Artefakty referencyjne

| Artefakt | Nazwa / suma MD5 | Zakres |
|---|---|---|
| JavaScript | `index-PRICEFMT1783512500.js`; `cc1325de9faad18a41357782e97c015f` | zdeminifikowany `fe.js`, 29 682 linii. [fe_doc_brief.md:6-9] |
| CSS | `index-BVOkSOnE.css`; `037f17118241131808d481e2ae921318` | `fe.css`, 78 053 B. [fe_doc_brief.md:9-10] |
| Wejście HTML | dokument w języku `pl`; ładuje bundle, CSS oraz trzy skrypty injection. [index.html:2,15-19] |

## Stack potwierdzony / wymagany przez brief

- React 18, Wouter v3, TanStack Query, Radix/shadcn oraz Tailwind są wskazane jako wymagany stack rekonstrukcji w briefie. [fe_doc_brief.md:55-57]
- Router ma mapę `Switch` z dwunastoma rzeczywistymi trasami. [fe.js:28644-28677]
- Dostawcą danych jest `QueryClientProvider`, z klientem skonfigurowanym globalnie. [fe.js:9064-9079,28694-28699]
- CSS importuje Inter i JetBrains Mono; pełne tokeny są w `04_DESIGN_TOKENS.md`. [fe.css:1]

## Tabela zbiorcza widoków

**Liczba endpointów** oznacza liczbę różnych szablonów ścieżek bez rozdzielania metod; liczba komponentów oznacza komponenty nazwane i rozpoznane w bezpośredniej implementacji widoku, a nie pełne drzewo komponentów bibliotecznych.

| Trasa | Widok | Endpointy | Komponenty rozpoznane | Znana rozbieżność |
|---|---:|---:|---:|---|
| `/login` | logowanie | 1 | 1 (`tM`) | brak potwierdzonej różnicy. [fe.js:26392-26512,28645] |
| `/` | Pulpit | 4 | 4 (`N2`, `mn`, `hn`, `Si`) | alerty są wyliczane lokalnie z produktów. [fe.js:16836-16860,28646] |
| `/staging` | Staging | 7 | 3 (`JP`, `mn`, `hn`) | instrukcja zakłada ręczne obsłużenie wszystkich zmian, kod deklaruje automatyczne przyjęcie ceny/stanu. [fe.js:20616-20682; instrukcja.txt:50-76] |
| `/katalog` | Katalog | 7 | 4 (`AT`, `LT`, `mn`, `hn`) | eksport jest wykonywany w przeglądarce, nie potwierdzono zadania eksportowego backendu. [fe.js:23214-23421,23909-23962] |
| `/narzuty` | Narzuty | 4 | 6 (`VT`, `WT`, `UT`, `BT`, `mn`, `hn`) | instrukcja v5 nazywa moduł przygotowawczym, kod zapisuje reguły do API i liczy symulację lokalnie. [fe.js:9208-9505,25122-25151; instrukcja.txt:222-230] |
| `/atrybuty` | Atrybuty | 6 (4 poprawne, 2 nieistniejące) | 8 | bundle zawiera dwa niezgodne endpointy; widok jest przejmowany przez injection. [fe.js:9965-10265,27495-27622; pending-injection.js:1-11] |
| `/alerty` | Alerty | 1 | 4 (`HT`, `KT`, `mn`, `hn`) | statusy/obsługa alertów są przechowywane lokalnie, mimo istnienia API alertów. [fe.js:25177-25211; be.cjs:48677-48680] |
| `/waga-gabarytowa` | Waga gabarytowa | 0 | 3 (`nM`, `mn`, `hn`) | kalkulacja jest lokalna, chociaż backend wystawia kalkulator. [fe.js:26545-26685; be.cjs:48738-48757] |
| `/analityka` | Analityka | 20 | 3 (`zM`, `mn`, `hn`) | brak rozbieżności tras: endpointy `analytics/*` istnieją w module. [fe.js:27804-27940; analytics_module.cjs:93-305] |
| `/historia` | Historia | 2 | 4 (`GT`, `QT`, `mn`, `hn`) | instrukcja v5 opisuje historię jako nieprodukcyjną/pustą, kod pobiera stronicowane dane. [fe.js:25374-25391; instrukcja.txt:231-241] |
| `/konfiguracja` | Konfiguracja | 6 | 10 (`eM`, `Qr`, `ZT`, `JT`, `qT`, `GK`, `XT`, `YT`, `mn`, `hn`) | dodatkowe rozszerzenie `freq` wstrzykuje edycję częstotliwości poza Reactem. [fe.js:25710-26282; freq-injection.js:1-115] |
| `/moje-konto` | Moje konto | 1 | 3 (`lM`, `mn`, `hn`) | brak potwierdzonej różnicy. [fe.js:27624-27801] |

## Spis rozbieżności istotnych dla rekonstrukcji

1. **Dwie rzeczywiste niezgodności klient–backend:** `/api/attributes` oraz `/api/attribute-kinds` nie mają definicji backendowej; należy je zastąpić natywnym użyciem `/api/atrybuty` i `/api/atrybuty/rodzaje`. [fe.js:9965-10155; atrybuty_module.cjs:103-125]
2. **Atrybuty:** `pending-injection.js` przejmuje ekran, nadpisuje cache Query i używa obserwatorów DOM; docelowa implementacja React nie może od niego zależeć. [pending-injection.js:1-11,1190-1276]
3. **Alerty:** komponent czyta produkty i lokalny stan, a nie potwierdzono w nim pobrania `/api/alerts`; backendowa trasa istnieje. [fe.js:25177-25211; be.cjs:48677-48680]
4. **Waga gabarytowa:** frontend liczy wynik w pamięci przeglądarki; backendowa trasa `POST /api/waga-gabarytowa/oblicz` istnieje, ale nie jest wywołana w tym komponencie. [fe.js:26545-26685; be.cjs:48738-48757]
5. **Instrukcja v5 jest starsza niż implementacja:** opisuje Narzuty i Historię jako przygotowanie, zaś bundle korzysta z API dla obu modułów. [instrukcja.txt:222-241; fe.js:9208-9429,25374-25391]
6. **Selly i częstotliwość importów:** skrypty injection są dołączane po bundlu i omijają natywne trasowanie/komponenty. [index.html:15-19; selly-injection.js:1-26; freq-injection.js:1-15]

Szczegółowa macierz wszystkich 53 znormalizowanych ścieżek znajduje się w `03_ROZBIEZNOSCI.md`. [api_fe_uniq.txt:1-53]
