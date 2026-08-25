# Bridge — frontend (odbudowa)

Szkielet nowego panelu „Bridge dla Agrowca": React 18 · Wouter v3 · TanStack Query ·
Radix/shadcn · Tailwind, budowany Vite. Powstał w **Iteracji 1b** (`docs/rebuild-roadmap.md` §5)
i dostarcza logowanie oraz ramę aplikacji; treść pozostałych widoków dokładają kolejne iteracje.

## Wymagania

- Node **20** (patrz `.nvmrc`; ta sama wersja co backend i CI).

## Uruchomienie lokalne

Frontend woła `/api/...` na własnym origin, a Vite proxuje to na backend — tak samo, jak
Apache robi to na stagingu. Dzięki temu lokalnie nie ma żadnych wyjątków na CORS,
a cookie `bridge_session` działa normalnie.

```bash
# 1) backend (w drugim terminalu)
cd ../backend
npm ci
cp .env.example .env          # uzupełnij JWT_SECRET
DB_PATH=./data/bridge.db npm run seed:dev -- dev@bridge.local dev12345 "Konto Deweloperskie"
npm run dev                   # 127.0.0.1:5001

# 2) frontend
npm ci
npm run dev                   # http://localhost:5173
```

Bez backendu widok `/login` się otworzy, ale logowanie zwróci błąd sieci.

## Skrypty

| Polecenie | Co robi |
|---|---|
| `npm run dev` | serwer deweloperski Vite (port 5173, proxy `/api` → `127.0.0.1:5001`) |
| `npm run build` | typecheck + build produkcyjny do `dist/` |
| `npm run preview` | podgląd zbudowanego `dist/` |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript dla `src/`, `test/` i plików konfiguracyjnych |
| `npm test` | testy jednostkowe i komponentowe (Vitest + Testing Library + MSW) |
| `npm run test:integracja` | testy przeciw ŻYWEMU backendowi — patrz niżej |

## Testy

`npm test` (44 testy) działa bez backendu. Żądania przechwytuje MSW, a użytkownik
w mockach jest czytany wprost z `contract/fixtures/GET_me.json` — nagranej odpowiedzi
produkcji. Zmiana kontraktu wywala test, zamiast przejść niezauważona.

`test/tokeny.test.ts` to **strażnik wyglądu**: porównuje efektywne wartości wszystkich
design tokenów (osobno motyw jasny i ciemny) z produkcyjnym arkuszem
`mirror/frontend/assets/index-BVOkSOnE.css`. Jeśli padnie — albo ktoś ruszył token bez
powodu, albo produkcja się zmieniła; w drugim przypadku zmiana idzie przez triaż
(`docs/rebuild-backlog.md`), nie przez cichą edycję pliku.

`npm run test:integracja` uruchamia **prawdziwy backend** z `rebuild/backend` na wolnym
porcie, ze świeżą bazą tymczasową i zasianym użytkownikiem, i przepuszcza przez niego
prawdziwego klienta frontendu (logowanie → `/api/me` → wylogowanie). Zero mocków.
Wymaga `npm ci` w `rebuild/backend`. **Nie jest wpięty w CI**, bo job `frontend`
(`.github/workflows/ci.yml`) instaluje wyłącznie ten katalog.

## Kontrakt z wdrożeniem

`tools/deploy-staging.sh` wymaga dokładnie tego:

- `npm ci && npm run build` → katalog `dist/`,
- `base: "/"` — build ląduje w korzeniu docroota `test.agritires.eu`,
- `/api` **nie jest** częścią buildu; proxuje je `.htaccess` (`deploy/staging/htaccess:12`)
  na `127.0.0.1:5001`.

## Struktura

```
src/
  lib/api.ts          warstwa HTTP: nagłówki, token, „zapamiętaj mnie", błędy
  lib/auth.ts         sesja: zaloguj / wyloguj / pobierzUzytkownika
  lib/queryClient.ts  TanStack Query — klucz zapytania JEST ścieżką
  components/         AppShell (rama + sidebar), AuthGate, ThemeProvider, Logo, ui/
  pages/              Login, NotFound, placeholdery pozostałych 11 tras
  styles/index.css    design tokens przepisane z arkusza produkcji
```

## Zasady, o które łatwo się potknąć

1. **Klucz zapytania jest ścieżką.** `queryFn` skleja `queryKey.join("/")` z bazą API,
   więc klucz `["/api/staging", id]` woła `/api/staging/<id>`. Wszystkie invalidacje
   w kolejnych iteracjach na tym stoją — nie zmieniać konwencji punktowo.
2. **Bearer i cookie działają RÓWNOLEGLE.** Nagłówek `Authorization` leci tylko gdy token
   istnieje, `credentials:"include"` zawsze. Backend przyjmuje jedno albo drugie.
3. **„Zapamiętaj mnie" przełącza cały magazyn**, a nie osobną flagę przy tokenie:
   zaznaczone → `localStorage`, inaczej `sessionStorage` (klucze `bridge_auth_token`,
   `bridge_user`, `bridge_remember`).
4. **401 w zapytaniu odczytowym zwraca `null`**, nie rzuca — i nie ma globalnego
   auto-wylogowania. To wierne oryginałowi; wygasła sesja objawia się pustym widokiem.
5. **Sidebar ma 10 pozycji, router 12 tras.** `/moje-konto` jest linkiem w stopce
   sidebara, `/login` nie występuje w żadnym menu.

## Świadome odstępstwa od oryginału

Zatwierdzone w `docs/tickets/2-FEATURE-frontend-shell-logowanie/plan.md`; reszta
zachowania jest odtworzona 1:1 z `deminified/frontend-index.js`.

| # | Odstępstwo | Powód |
|---|---|---|
| O1 | routing po ścieżkach zamiast po hashu (`/katalog`, nie `/#/katalog`) | hash był obejściem Replita; Apache ma poprawny SPA fallback |
| O2 | zapis wybranego motywu w `localStorage.bridge_theme` | oryginał nie zapisywał — wybór ginął po odświeżeniu |
| O3 | ekran 404 po polsku i na design tokenach | oryginał miał angielski tekst na `bg-gray-50`, jedyny ekran poza tokenami |
| O4 | pominięte konta testowe z hasłami w kodzie i martwy `list="konta-testowe-email"` | wyciek danych logowania; atrybut wskazywał na nieistniejącą `<datalist>` |
| O5 | stan „Ładowanie…" w `AuthGate` zamiast `null` | oryginał migał białym ekranem przed przekierowaniem na `/login` |
| O6 | `aria-label` na przycisku menu mobilnego | oryginał (`:16348-16357`) miał tam samą ikonę, bez nazwy dostępnej dla czytnika ekranu |
