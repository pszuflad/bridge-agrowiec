# Warstwa wspólna

## Router i wejście aplikacji

- Aplikacja ma dwanaście tras w `Switch`: `/login`, `/`, `/staging`, `/katalog`, `/narzuty`, `/alerty`, `/analityka`, `/historia`, `/konfiguracja`, `/waga-gabarytowa`, `/atrybuty` i `/moje-konto`; trasa nieznana prowadzi do `p2`. [fe.js:28644-28677]
- Nazwa biblioteki routera w mapie faktów to Wouter v3. [fe_doc_brief.md:22-24]
- Na starcie bundle ustawia `window.location.hash` tylko wtedy, gdy hash jest pusty. Jednocześnie mapa tras używa ścieżek bez `#`; dokładny tryb integracji Woutera należy odtworzyć z tym zachowaniem, a nie zakładać go. [fe.js:28644-28677,28699]
- `QueryClientProvider` obejmuje router i pozostałych providerów w komponencie głównym. [fe.js:28694-28699]

## Uwierzytelnianie

| Element | Zachowanie potwierdzone |
|---|---|
| Nagłówki | Pomocnik JSON dodaje `Content-Type: application/json` i `Authorization: Bearer <token>` tylko, gdy token istnieje. [fe.js:9039-9044] |
| Cookie | Helper `fetch` zawsze używa `credentials: "include"`; backend login ustawia sesję cookie przez `R4`. Nazwę cookie `bridge_session` podaje mapa faktów. [fe.js:9045-9053; be.cjs:48156-48178; fe_facts.txt:1-9] |
| Logowanie | `POST /api/login` wysyła `{email: email.trim(), password}`. Klient oczekuje `ok` i `user`, opcjonalnie obsługuje `token`; backend odpowiada `{ok:true,user,token}` przy powodzeniu. [fe.js:9085-9097; be.cjs:48156-48174] |
| Sesja klienta | Dane użytkownika są trzymane pod kluczem `bridge_user`; przy logout są usuwane. [fe.js:9080-9084,9098-9107] |
| Wylogowanie | `POST /api/logout`, następnie czyszczenie stanu użytkownika i cache Query oraz przejście do `/login`. [fe.js:9098-9107,16431-16441; be.cjs:48175-48190] |
| Zmiana hasła | Konto wysyła `POST /api/password/change` z `{oldPassword,newPassword}`; backend odpowiada `{ok:true}` albo błędem. [fe.js:27682-27695; be.cjs:48191-48215] |
| Brak autoryzacji | Wspólny `queryFn` zwraca `null` dla HTTP 401; konfiguracja Query ma `on401: "returnNull"`. [fe.js:9054-9079] |
| Ochrona widoków | Wrapper konta kieruje użytkownika bez danych sesji do `/login`. Zakres ochrony pozostałych tras w samym frontendzie jest **NIEZNANY**; backend chroni trasy middlewarem `we`/`requireAuth`. [fe.js:27789-27801; extensions.cjs:381-396] |

**Reguła odtworzenia:** wysyłaj cookie i Bearer równolegle, zachowaj `email.trim()`, a 401 w zapytaniu odczytowym zamieniaj na `null`, zamiast od razu rzucać błąd. [fe.js:9039-9079,9085-9097]

## TanStack Query

- Klucz URL jest składany jako `queryKey.join("/")`; zapytanie korzysta z `fetch` i `credentials: "include"`. [fe.js:9054-9063]
- Wartości domyślne: `refetchOnWindowFocus:false`, `refetchOnReconnect:false`, `staleTime:Infinity`, `retry:false`; mutacje także mają `retry:false`. [fe.js:9064-9079]
- Po mutacjach stagingu kod unieważnia klucze m.in. `staging`, `products`, `history` i `alerts`. [fe.js:9113-9145]
- Wylogowanie czyści cały cache klienta Query. [fe.js:16431-16441]

## Layout aplikacji

- `mn` buduje pełnoekranową ramę: mobilny nagłówek, boczny panel, obszar główny oraz widok dzieci. [fe.js:16329-16443]
- Nawigacja `l2` zawiera kolejno: Pulpit, Staging, Katalog, Narzuty, Atrybuty, Alerty, Waga, Analityka, Historia i Konfiguracja. [fe.js:16287-16327]
- Dolna część sidebara ma przełącznik ciemnego trybu. [fe.js:16394-16404]
- Avatar jest inicjałem wyliczonym z `imieNazwisko`; obok renderowane są imię/nazwisko i e-mail. [fe.js:16406-16420]
- Link konta prowadzi do `/moje-konto`; przycisk wylogowania czyści Query Cache i nawiguję do `/login`. [fe.js:16423-16441]
- Wymiary, dokładna wysokość topbara i pełny zestaw breakpointów są **NIEZNANE** w kodzie komponentu; wartości wizualne trzeba odtworzyć z CSS. [fe.js:16329-16443; fe.css:1]

## Język i formaty

- Dokument HTML deklaruje `lang="pl"`, a etykiety menu i komunikaty widoków są po polsku. [index.html:2; fe.js:16287-16327,20678-20682]
- Mechanizm przełączania języka lub słownik i18n jest **NIEZNANY**; nie potwierdzono osobnego providera tłumaczeń w mapie wejścia aplikacji. [fe.js:28694-28699]
