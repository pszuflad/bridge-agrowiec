# Prompt do Perplexity — pełna dokumentacja techniczna frontendu Bridge

> Skopiuj wszystko poniżej linii i wklej do Perplexity (konto/Space z agentami
> pracującymi nad Bridge, z dostępem do VPS `vpshd1242.cyber-folks.pl`).
> Zadanie wymaga **czytania rzeczywistych plików na serwerze**, nie pamięci.

---

Pracujesz nad projektem **Bridge dla Agrowca** (panel.agritires.eu). Odtwarzam
frontend od zera — kod źródłowy nie istnieje (potwierdzone audytem VPS 2026-07-24:
zero `.tsx`, zero `src/`, zero source map). Do odbudowy potrzebuję **kompletnej
dokumentacji technicznej istniejącego frontendu** — takiej, z której da się
napisać identycznie zachowującą się aplikację React.

## ⚠ Zasada nadrzędna: zero zgadywania, wszystko z plików

Poprzednia wersja dokumentacji, którą przygotowałeś, **zawierała zmyślone
endpointy**. Konkretnie były błędne: `GET /api/analytics/summary`,
`GET /api/analytics/last-sync`, `POST /api/import/run`, `GET /api/products/export`,
`GET /api/products/:id/history`, body logowania `{login, hasło}`, token w
`localStorage.bridge_token`, tabela `products_staging`, router „React Router DOM".
**Wszystkie te fakty są nieprawdziwe** — realnie jest `/api/import/from-url`,
`/api/export/shoper`, `{email, password}`, cookie `bridge_session`, tabela
`staging_items`, router **wouter**.

Dlatego tym razem **każdy fakt musi pochodzić z konkretnego pliku i być
zacytowany**. Jeśli czegoś nie da się potwierdzić w pliku — napisz „NIEZNANE",
nie zgaduj.

## Krok 0 — ustal, który bundle jest aktualny

Frontend produkcyjny to `/home/admin/domains/agritires.eu/public_html/panel/`.
Jest tam ~24 wariantów `index-*.js`. **Nie zgaduj, który** — sprawdź, który
faktycznie ładuje `index.html`:

```bash
cd /home/admin/domains/agritires.eu/public_html/panel
grep -oE 'assets/index-[A-Za-z0-9]+\.js' index.html
```

Ten plik (nie żaden `.bak`, nie starszy wariant) jest **jedynym źródłem prawdy
o zachowaniu frontendu**. Podaj jego nazwę i MD5 na początku dokumentacji.

## Krok 1 — deminifikacja obu bundli

Żeby czytać zachowanie, rozwiń oba pliki (kopiuj do `/tmp`, nie ruszaj produkcji):

```bash
mkdir -p /tmp/bridge_spec && cd /tmp/bridge_spec
cp /home/admin/domains/agritires.eu/public_html/panel/assets/index-AKTUALNY.js fe.js
cp /home/admin/private_apps/bridge/index.cjs be.cjs
npx prettier --write fe.js be.cjs 2>/dev/null || npx js-beautify -r fe.js be.cjs
```

- `fe.js` (frontend) → co panel **robi**: trasy, wywołania API, komponenty, stany.
- `be.cjs` (backend) → co API **udostępnia**: endpointy i kształty odpowiedzi.

Dokumentacja ma **łączyć te dwie warstwy** i jawnie oznaczać każdą rozbieżność
(patrz niżej — to najważniejsza część).

## Krok 2 — dokumentacja per widok (11 widoków)

Trasy do udokumentowania (potwierdź listę grepem po `fe.js` — szukaj definicji
routera wouter): `/`, `/login`, `/katalog`, `/staging`, `/narzuty`, `/alerty`,
`/historia`, `/konfiguracja`, `/atrybuty`, `/moje-konto`, `/waga-gabarytowa`.

Dla **każdego** widoku opisz:

1. **Layout** — układ, sekcje, sidebar/topbar, siatka. Odnieś się do zrzutu
   ekranu z `Instrukcja_obslugi_Bridge.docx` (są tam 17 zrzutów) i do tego, co
   renderuje `fe.js`.
2. **Dane wejściowe** — jakie pola pokazuje, z których kolumn tabeli DB.
3. **Akcje** — każde kliknięcie, submit, drawer, bulk-action, filtr, sortowanie.
4. **API — ZWERYFIKOWANE.** Dla każdego endpointu podaj:
   - ścieżkę i metodę,
   - **linię z `fe.js`** pokazującą wywołanie (`fetch(...)` / klucz query),
   - **linię z `be.cjs`** pokazującą definicję (`e.get("/api/...")` itd.),
   - kształt body żądania i odpowiedzi (z kodu, nie z wyobraźni).
5. **Stany** — pusty, ładowanie, błąd, 401, paginacja, brak wyników.
6. **Reguły biznesowe** — powiązania z logiką (np. kolejka pending przy nowej
   wartości atrybutu, przekreślona stara cena, ochrona `manual_overrides`).
7. **Komponenty** — dekompozycja na komponenty React (nazwij je).
8. **Różnice wobec instrukcji v5** — instrukcja opisuje wersję 5 z czerwca;
   produkcja jest z lipca. Wskaż, co się zmieniło (pomocniczo: katalog
   `assets/*.bak_*` i `*.backup-*` — nazwy kopii niosą opis zmian, np.
   `pre-virtualization`, `pre_filtr_brak_ean`, `BOOLEXP`, `KODIMP`, `SHIPH`).

## Krok 3 — rozbieżności kontraktu klient ↔ serwer (KLUCZOWE)

Wiem, że **widok Atrybuty jest zepsuty**: frontend woła `/api/attributes`
i `/api/attribute-kinds`, których backend nie ma (ma `/api/atrybuty*`), dlatego
działa przez wstrzykiwany skrypt `pending-injection.js`. **Znajdź wszystkie takie
rozbieżności**: przejdź po każdej ścieżce `/api/...` w `fe.js` i sprawdź, czy
istnieje w `be.cjs`. Wypisz tabelę: `ścieżka wołana przez klienta | istnieje w
backendzie? | uwaga`. To są miny dla odbudowy — muszę je znać wszystkie.

Uwzględnij też trzy skrypty injection z produkcji (`pending-injection.js`,
`selly-injection.js`, `freq-injection.js`) — co każdy przejmuje i dlaczego (to
obejścia, które w nowym froncie mają zniknąć, bo funkcja wejdzie natywnie).

## Krok 4 — warstwa wspólna i design tokens

- **Routing** — potwierdź: wouter? hash-routing (`#/katalog`) czy history? (grep
  w `fe.js` i w konfiguracji nginx).
- **Auth** — jak trzymany jest token (cookie `bridge_session`? nagłówek Bearer?),
  jak działa 401-redirect, jak wygląda `POST /api/login` (realne body).
- **Stan serwera** — jaka biblioteka (TanStack Query? SWR? własne?). Sprawdź w `fe.js`.
- **Design tokens z prawdziwego CSS** — z pliku `assets/index-*.css` wyciągnij:
  kolory (kolor akcentu wygląda na bursztynowy ~`#D97706` — potwierdź), rodziny
  fontów, promienie zaokrągleń, odstępy. To pozwoli odtworzyć wygląd 1:1.
- **i18n** — całość po polsku, `<html lang="pl">`.

## Format odpowiedzi

- **Tabela zbiorcza na początku:** 11 widoków × (liczba endpointów, komponentów,
  znanych rozbieżności). Plus nazwa i MD5 aktualnego bundla.
- Potem **jeden plik Markdown per widok** (albo jeden duży dokument z sekcjami) —
  jak Ci wygodniej, byle dało się rozdzielić.
- Osobna sekcja: **tabela rozbieżności klient↔serwer** (Krok 3).
- Osobna sekcja: **design tokens** (Krok 4).

## Twarde zasady

- **Każdy endpoint musi mieć zacytowaną linię z `be.cjs`.** Bez cytatu = pomijasz.
- **Nie ujawniaj sekretów** — treści `.env`, `JWT_SECRET`, haseł, kluczy Selly/Agrorami.
- **Nie modyfikuj produkcji.** Cała praca na kopiach w `/tmp`.
- Jeśli fakt jest niepewny — **„NIEZNANE"**, nie wersja prawdopodobna.
- Spakuj wynik do ZIP-a do pobrania.

## Po co mi to

Odtwarzam frontend jako czysty projekt React + Vite (identyczny stack: React 18,
wouter, Radix/shadcn), wdrażany równolegle pod osobnym adresem, na tym samym
backendzie, z przełączeniem dopiero po osiągnięciu parytetu. Twoja dokumentacja
jest wejściem do tej odbudowy — **im wierniejsza rzeczywistym plikom, tym mniej
błędów przepiszę.** Zweryfikuję każdy zacytowany endpoint względem własnej listy
98 endpointów i schematu bazy, więc rozbieżności i tak wyjdą — lepiej, żeby ich
nie było od początku.
