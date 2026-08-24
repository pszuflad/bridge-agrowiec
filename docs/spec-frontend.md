# Specyfikacja frontendu Bridge — ZWERYFIKOWANA

Werdykt weryfikacji dokumentacji frontendu od Perplexity
(`docs/incoming/frontend-perplexity/dokumentacja/`), skonfrontowanej z naszym
`deminified/frontend-index.js`, kontraktem `contract/openapi.yaml` (2.3) oraz
instrukcją z 17 zrzutami.

> **Werdykt: dokumentacja RZETELNA i przyjęta jako referencja.** W przeciwieństwie
> do wcześniejszej „specyfikacji UI" (która miała **zmyślone** endpointy), ta
> cytuje `plik:linia`, oznacza NIEZNANE, sama zawiera plik `03_ROZBIEZNOSCI.md`
> z macierzą wszystkich 53 ścieżek klienta skonfrontowanych z backendem, i podaje
> MD5 analizowanego bundla (`index-PRICEFMT1783512500.js`). Moja niezależna
> krzyżowa kontrola potwierdziła jej rdzeń.

**Kanoniczna referencja (przyjęta):**
`docs/incoming/frontend-perplexity/dokumentacja/` — `00_PODSUMOWANIE`,
`01_WARSTWA_WSPOLNA`, `02_WIDOKI`, `03_ROZBIEZNOSCI`, `04_DESIGN_TOKENS`,
`_mapy_api/` (mapy wywołań FE vs BE).

---

## 1. ⭐ Krzyżowa kontrola kontraktu — POTWIERDZONE niezależnie

Skonfrontowałem 53 wywołania frontendu (`_mapy_api/api_fe_uniq.txt`) z moim
kontraktem `openapi.yaml` (2.3). **Jedyne dwie ścieżki, których backend NIE ma:**

```
❌ /api/attributes        (frontend woła 8×)   → backend ma: /api/atrybuty
❌ /api/attribute-kinds   (frontend woła 6×)   → backend ma: /api/atrybuty/rodzaje
```

Wszystkie pozostałe 51 ścieżek FE istnieje w kontrakcie (w tym całe
`/api/analytics/*`). To jest ten sam rozjazd, który podejrzewałem w lipcu —
teraz **potrójnie potwierdzony**: mój audyt → dokumentacja Perplexity → moja
krzyżowa kontrola z kontraktem. Zweryfikowane też w naszym `deminified`:
`/api/attributes` 8 trafień, `/api/attribute-kinds` 6.

## 2. ⭐ Mapa do naprawy przy odbudowie (konkretna lista)

**A. Dwie martwe ścieżki → zamiana na natywne API:**
| Frontend woła (błędnie) | Ma być | Backend |
|---|---|---|
| `/api/attributes` | `/api/atrybuty` | `atrybuty_module.cjs:103` |
| `/api/attribute-kinds` | `/api/atrybuty/rodzaje` | `atrybuty_module.cjs:114` |

**B. Trzy skrypty injection → wchłonąć do natywnego Reacta** (dziś łatają UI
poza aplikacją; nowy frontend nie może od nich zależeć):
| Skrypt | Co robi teraz | Co ma wejść natywnie |
|---|---|---|
| `pending-injection.js` (57 KB) | przejmuje ekran `/atrybuty` przez React Fiber + MutationObserver, nadpisuje cache Query | komponenty CRUD rodzajów/wartości + lista pending, jeden Query key `/api/atrybuty`, mutacje+invalidacje. **Bez Fiber/MutationObserver.** |
| `selly-injection.js` (26 KB) | overlay panelu Selly na `/panel/api/selly`, routing przez hash | trasa Wouter `/selly` + komponenty w React/TanStack Query |
| `freq-injection.js` (12 KB) | dokłada kontrolkę częstotliwości importu poza Reactem (PATCH) | pole `czestotliwoscMinuty` w edycji dostawcy |

## 3. Korekty do MOICH dokumentów

Weryfikacja frontendu koryguje dwie rzeczy z `audit-delta.md`:

- 🔴 **UI analityki ISTNIEJE.** Pisałem „31 endpointów analityki, zero UI". Fałsz —
  jest trasa **`/analityka`** wołająca 20 endpointów `analytics/*` (`fe.js:27804`,
  `01_WARSTWA_WSPOLNA.md`). Do usunięcia z listy „bez UI".
- **12 tras** (nie 11): `/login`, `/`, `/staging`, `/katalog`, `/narzuty`,
  `/alerty`, `/analityka`, `/historia`, `/konfiguracja`, `/waga-gabarytowa`,
  `/atrybuty`, `/moje-konto`. Router **Wouter v3**, `Switch`, `fe.js:28644-28677`.

## 4. Zachowania „lokalne vs API" — do świadomej decyzji przy odbudowie

Dokument wyłapał miejsca, gdzie frontend liczy coś **lokalnie**, mimo że backend
ma endpoint:
- **Alerty** (`/alerty`) — status/obsługa trzymane lokalnie, choć `/api/alerts` istnieje.
- **Waga gabarytowa** — liczona w przeglądarce, choć `POST /api/waga-gabarytowa/oblicz` istnieje.
- **Staging** — instrukcja v5 zakłada ręczną obsługę, kod auto-przyjmuje zmiany ceny/stanu.
- Instrukcja v5 opisuje **Narzuty i Historię jako „w przygotowaniu"**, a kod ich API używa (potwierdza deltę: te moduły dojrzały po czerwcu).

## 5. Blueprint odbudowy (potwierdzony w kodzie)

**Stack:** React 18 · **Wouter v3** · TanStack Query · Radix/shadcn · Tailwind.

**Przepływ auth (do wiernego odtworzenia, `01_WARSTWA_WSPOLNA.md`):**
- `POST /api/login` z `{email: email.trim(), password}` → oczekuje `{ok, user, token}`.
- Nagłówki: `Authorization: Bearer <token>` **tylko gdy token jest** + `credentials:"include"` (cookie `bridge_session`) — **równolegle**.
- Dane użytkownika pod `localStorage.bridge_user`; „remember me" → token w `localStorage`/`sessionStorage`.
- Query: `on401:"returnNull"`, `staleTime:Infinity`, `retry:false`, `refetchOnWindowFocus:false`. Klucz = `queryKey.join("/")`.
- Po mutacjach stagingu invalidacja: `staging`, `products`, `history`, `alerts`.

> **Odbudowa (I1a, `1-FEATURE-backend-fundament-logowanie`):** strona serwerowa tego
> przepływu już działa — `POST /api/login`/`/api/logout`/`GET /api/me` w `rebuild/backend`
> zwracają dokładnie ten kształt (`{ok,user,token}`), akceptują Bearer i cookie
> `bridge_session` równolegle. **Ważne dla 1b:** backend dopasowuje e-mail **dokładnie**,
> bez `trim()` po swojej stronie — `.trim()` musi zostać po stronie frontendu, tak jak
> tu opisano, inaczej logowanie z białymi znakami się rozjedzie. Widok `/login` (React)
> przychodzi dopiero w sesji 1b.

**Design tokens** (`04_DESIGN_TOKENS.md`) — komplet do wiernego wyglądu:
- Fonty: **Inter** (UI), **JetBrains Mono** (kod/EAN).
- Primary `hsl(35 70% 45%)` (bursztyn), sidebar ciemny `hsl(215 28% 12%)`,
  tło `hsl(210 20% 98%)` — pełne HSL w pliku.

## 6. Widoki

12 widoków opisanych w `02_WIDOKI.md` (widok/dane/akcje/API/komponenty) +
tabela zbiorcza w `00_PODSUMOWANIE.md`. Do wiernego UX służą też **17 zrzytów**
z `docs/reference/Instrukcja_obslugi_Bridge.docx` (uwaga: instrukcja to wersja 5,
starsza niż bundle — patrz §4).

---

## Do propagacji

- `audit-delta.md`: dopisać — **UI analityki istnieje** (`/analityka`); 12 tras.
- Faza 3 (odbudowa frontendu): punktem wyjścia jest §2 (mapa napraw) + §5 (blueprint)
  + `02_WIDOKI.md` + zrzuty. Kontrakt `openapi.yaml` mówi, na jakie API wołać.

*Weryfikacja Krok 2.2 (Faza 2) — 2026-08-17. Krzyżowa kontrola tez Perplexity
z naszym kodem i kontraktem 2.3. Dokumentacja przyjęta jako kanoniczna referencja
frontendu; ten plik to warstwa weryfikacji i mapa napraw.*
