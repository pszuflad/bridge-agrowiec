# 149-DOCS-instrukcja-pelnego-testu — instrukcja pełnego testu systemu dla Ani (dokument 1 z trzech)

> Status: Draft → Approved → Implemented → Shipped
> Branch: `docs/149-instrukcja-pelnego-testu`
> Worktree: `.worktrees/149-DOCS-instrukcja-pelnego-testu`

## Ticket description
Napisz instrukcję pełnego testu systemu dla Ani — dokument 1 z trzech (karta `docs/karty/TEST.1/`).
Zakres: cały system **bez ścieżki krytycznej** (ta idzie do TEST.2 — odesłanie jednym zdaniem,
bez powtarzania scenariuszy). Podstawą jest `docs/przeglad-12-widokow.md` — odesłanie, nie przepisywanie.
Forma: polecenie Ani z 22.09 („co zmieniliśmy → polecenie → rezultat"), rozbieżności do sekcji
„Do Twojej decyzji". Plik: `docs/instrukcja-pelnego-testu.md`.

## Context

**Karta i wejścia.** `docs/karty/TEST.1/karta.md` + `wejscie-139` (bramka `SELLY_TRYB` przy dostępności),
`wejscie-141` (trzy znane defekty, które Ania zobaczy), `wejscie-144` (pułapka: niewidocznie wyłączone
odświeżanie dostępności), `wejscie-145` (priorytety wg ryzyka biznesowego), `wejscie-148` (podział na trzy
dokumenty — ścieżka krytyczna wychodzi do TEST.2, TEST.1 zostaje listą kontrolną całego systemu, 20% uwagi).

**Podstawa.** `docs/przeglad-12-widokow.md` (422 linie, 13 ekranów) został zweryfikowany punkt po punkcie
wobec `develop` @ `79cda97` przy karcie PR.6 (2026-09-22). Wszystko nowsze niż ten commit to delta,
którą musi donieść ten dokument.

**Delta wobec przeglądu — cztery zmiany frontu** (`git log 79cda97..HEAD -- rebuild/frontend/src`):
- `142` — etykieta „Braki w cenniku" zamiast „Wycofane" w podsumowaniu wgrywania
  (`konfiguracja/DialogWgrywania.tsx:220`, łatka #103 z żywego bundla `88fa31c`);
- `140` — okno „Rozstrzygnij" i okno blokady akceptacji w `/staging`
  (`staging/OknoRozstrzygniecia.tsx`, `staging/OknoBlokady.tsx`);
- `126` — pełne pliki CSV analityki (P10.5, `?limit=0`);
- `122` — kolumna „Blokowane formy płatności" w `/katalog`.

**Zmierzone samodzielnie (migawka `db/snapshot.db`, `better-sqlite3`):** `staging_items` = 3362 pozycje,
z czego **zero** ma w `snapshot_json` znacznik `_policyVersion`. Blokada nr 3 w
`rebuild/backend/src/import/polityka/blokady.ts:57-59` odmawia akceptacji każdej takiej pozycji
komunikatem „To zgłoszenie pochodzi ze starego importu. Odśwież cennik przed akceptacją."
Baza stagingu to kopia produkcji z 23.09, więc Ania zastanie w poczekalni głównie takie pozycje.

**Warunki środowiskowe — zweryfikowane w repo, nie przyjęte na słowo:**
- staging `test.agritires.eu`, backend port 5001, `NODE_ENV=production` (`tools/deploy-staging.sh:28`);
- baza = kopia produkcji z 23.09, **8329 produktów**, migracje 001–013 (`docs/cutover.md:298-300`);
- **scheduler importu włączony** — `IMPORT_SCHEDULER=true` i `IMPORT_SCHEDULER_PIERWSZY_PRZEBIEG=true`
  dopisane do `.env` stagingu przy audycie 24.09 (`docs/cutover.md:292`); montaż: `server.ts:140-143`;
- **Selly wyłączone trzema niezależnymi blokadami:** (1) `SELLY_TRYB=wylaczony`
  (`tools/deploy-staging.sh:42`) — klient odmawia operacji nawet z poprawnymi sekretami;
  (2) `SELLY_SCHEDULER` nieustawione (`server.ts:151-154`, `config/env.ts:121` — domyślnie wyłączone),
  więc Tor 1 i Tor 2 nie ruszają; (3) brak sekretów `SELLY_*` — zabezpieczenie przez nieobecność;
- `SELLY_CSV_DIR` wskazuje katalog **stagingu**, nie produkcji (`tools/deploy-staging.sh:43`) — pułapka
  z `wejscie-144` jest po stronie deployu zamknięta;
- ⚠ konsekwencja `SELLY_TRYB=wylaczony` (`wejscie-139`): moduł odświeżania dostępności jest
  **niezamontowany**, więc import, który zmienił dostępność, nie regeneruje CSV. Nie ma błędu ani
  komunikatu w UI — z perspektywy Ani wygląda to identycznie jak awaria.

**Granica z TEST.2** (`docs/karty/TEST.2/karta.md`): import → parsery → baza → eksport CSV →
porównanie ze starą wersją → przepięcie Selly. Tego dokument 1 nie dotyka.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa
**Brak (ticket nie dotyka kontraktu).** To ticket DOCS: powstaje jeden nowy plik w `docs/` plus
aktualizacja karty. Zero zmian w `rebuild/`, `contract/` i `rebuild/schema/`. GATE odbudowy nie obowiązuje.
Dokument **opisuje** zastane zachowanie — każdy fakt w nim jest weryfikowany wobec kodu na `develop`,
a nie wymyślany; to jest odpowiednik gate'u dla ticketu dokumentacyjnego.

## Decisions

**D1 (użytkownik, 2026-09-24) — stare zgłoszenia w poczekalni: uprzedzić i kazać zrobić import.**
Instrukcja mówi wprost, że odmowa akceptacji na pozycjach zastanych w poczekalni jest POPRAWNA,
i każe Ani najpierw wykonać jeden import, a dopiero świeże pozycje akceptować. Nie czyścimy
`staging_items` na serwerze. Zaleta: blokada zostaje sprawdzona zamiast obejścia, zero roboty na VPS.

**D2 (użytkownik, 2026-09-24) — granica TEST.1/TEST.2 biegnie „ekran vs. potok".**
TEST.1 bierze to, co Ania widzi i klika na `/staging`: okno „Rozstrzygnij", okna blokad akceptacji,
podgląd starej karty, etykieta „Braki w cenniku". TEST.2 bierze to, co potok importu **wytwarza**:
blokada niewiarygodnego cennika, wycofania po trzech cennikach, auto-wstrzymania. Powód: karta TEST.1
wymienia sześć mechanizmów, ale 148 przeniosło potok do TEST.2 — bez tej granicy oba dokumenty
opisywałyby to samo.

**D3 (użytkownik, 2026-09-24) — kratki ✅/❌ jak w przeglądzie.**
Ania odsyła dokument z zaznaczonymi kratkami, spójnie z `przeglad-12-widokow.md`, do którego i tak
odsyłamy. Daje namacalny wynik testu zamiast opisowej odpowiedzi.

**D4 (użytkownik, 2026-09-24) — „Do Twojej decyzji" obejmuje cztery pozycje:**
#89 (brak pola „priorytet" w formularzu reguły narzutu), brak podziału admin / zwykły użytkownik,
#137.2 (ciche nadpisywanie poprawek Marty), cztery podwójne bieżniki w `/atrybuty`.

**D5 (użytkownik, 2026-09-24) — odświeżania dostępności NIE testujemy w tej turze.**
Instrukcja mówi Ani jednym zdaniem, że jest wyłączone i że brak nowego pliku CSV po imporcie jest
**oczekiwany**. Zero zmian na środowisku (`wejscie-144`, wariant „NIE"). Bez kazania jej czytać logu
backendu — do logu nie ma dostępu w swoim trybie pracy (`wejscie-144` pkt 2).

**D6 (użytkownik, 2026-09-24) — ostrzec przed „Akceptuj wszystkie".**
Masowa akceptacja na danych z kopii produkcji potrafi mielić kilkanaście minut w jednym żądaniu
(backlog #129.1: 2502 pozycje ≈ 16 min) i panel wygląda wtedy na zawieszony. Jedno zdanie uprzedzenia,
bez odradzania — inaczej wróci jako zgłoszenie błędu krytycznego.

**D7 (użytkownik, 2026-09-24) — kolumna „Blokowane formy płatności" wchodzi jedną linijką.**
Nowa kolumna w `/katalog` (ticket 122, 23.09), liczona w przeglądarce z kodu dostawcy
(`katalog/formatowanie.tsx:23-70`). Dla MO6 i nieznanego dostawcy pokazuje „—" i to jest poprawne.
Jedna kratka „do kliknięcia" plus nota, żeby „—" nie wróciło jako zgłoszenie.

**Sprostowanie do `docs/przeglad-12-widokow.md` (nie decyzja — fakt do odnotowania).**
Przegląd w punkcie 8 i w liście zbiorczej pkt 9 mówi, że plik CSV z Analityki to „dokładnie to, co widać
w tabeli — ta sama liczba wierszy". Po karcie P10.5 (23.09) to **nieprawda dla ośmiu z dziewięciu kart
z eksportem**: tabela rysuje 300 wierszy, a plik dociąga pełny zbiór bez sufitu SQL. TEST.1 prostuje to
jedną linijką u siebie; poprawka w samym przeglądzie należy do koordynatora (karta TEST.1 nie jest
właścicielem tego pliku) — trafi do „Do koordynatora" w `docs/karty/TEST.1/karta.md`.

**Odstępstwa od zachowania oryginału:** ticket żadnych nie wprowadza. Dokument **opisuje** odstępstwa
zatwierdzone wcześniej (pełne pliki CSV z analityki — P10.5/#96; wspólna lista przewoźników i ustawienia
spedycji na serwerze; daty promocji realnie kończące promocję), zawsze jako „tak ustaliliśmy", nie jako błąd.

## Implementation plan

Jeden nowy plik `docs/instrukcja-pelnego-testu.md`. Układ:

1. **Nagłówek + warunki środowiskowe** — adres, wydanie, stan bazy (8329 produktów, kopia z 23.09),
   co jest włączone (import), co wyłączone (Selly, odświeżanie dostępności). Tabelka, nie akapit.
2. **Jedno zdanie odsyłające do TEST.2** — ścieżkę główną Ania przechodzi osobnym dokumentem i zaczyna
   od niego; tutaj jej scenariuszy nie ma.
3. **Odesłanie do `docs/przeglad-12-widokow.md`** — to jest lista kontrolna 13 ekranów i zostaje w mocy;
   ten dokument dokłada tylko to, co się od 22.09 zmieniło albo czego przegląd nie obejmuje.
4. **Zanim zaczniesz** — dwie rzeczy, które inaczej zostaną zgłoszone jako usterka:
   (a) stare zgłoszenia w poczekalni odmawiają akceptacji → najpierw jeden import (D1);
   (b) brak nowego pliku CSV po imporcie jest oczekiwany — Selly wyłączone (`wejscie-144` pkt 1,
   wariant „NIE"; bez kazania jej czytać logu backendu — `wejscie-144` pkt 2).
5. **Nowe i zmienione od 22.09** — w układzie „Co zmieniliśmy → Polecenie → Rezultat", z kratkami:
   - `/staging`: okno „Rozstrzygnij" (etykieta „Sprawdź kartę" dla starej karty),
     okna blokad akceptacji, podgląd starej karty. ⚠ Okno ma **trzy rozłączne gałęzie**
     (porównanie starej karty z ofertą / sprawdzenie dopasowania opony / sam podgląd sprzecznych
     wierszy), a napisy przychodzą z serwera — instrukcja opisuje, CO Ania ma zrobić, i nie
     przepisuje treści okna słowo w słowo;
   - `/staging`: filtr typu zmiany i odznaka mówią teraz „Braki w cenniku" / „Brak w cenniku"
     zamiast „Wycofane" / „Wycofana";
   - `/konfiguracja` → Wgrywanie ręczne: etykieta „Braki w cenniku" zamiast „Wycofane";
   - `/katalog`: kolumna „Blokowane formy płatności" — „—" przy MO6 jest poprawne (D7);
   - `/analityka`: pełne pliki CSV (P10.5) — **dziewięć kart ma przycisk „CSV"**, dwie go nie mają
     (Sezonowość 4.4, Cykl życia modeli — tak samo jak oryginał); dla ośmiu z dziewięciu plik ma
     WIĘCEJ wierszy niż tabela na ekranie (300). Tu idzie sprostowanie do punktu 8 przeglądu.
     Filtry są respektowane; błąd pobrania nie daje pliku (zatwierdzone odstępstwo).
   - `/staging`: ostrzeżenie o czasie „Akceptuj wszystkie" (D6).
6. **Lista kontrolna reszty systemu** — krótko, po ekranie, wg `wejscie-145` („wejdź, sprawdź że działa
   i wygląda sensownie"): panel administracyjny (osiem zakładek), alerty z zakładką „Katalog", atrybuty,
   analityka, waga gabarytowa, archiwum importów, konto. Bez rozpisanych scenariuszy — odesłanie
   do przeglądu po szczegóły. Przy alertach: zakładka „Katalog" liczy **cztery** rodzaje
   (marża ujemna, bardzo niska marża, nie-opona w katalogu, brak importu cennika u dostawcy) —
   liczone na żywo w przeglądarce, więc są widoczne bez żadnej akcji Ani.
7. **Czego NIE zgłaszać** — trzy znane defekty z `wejscie-141` (podwójne bieżniki, Alliance/ALLIANCE
   w karcie 4.4, EAN-y i % w karcie 4.1) opisane jako znane i odłożone po cutover, plus przypomnienie,
   że śmieci w polu marki nie wychodzą do filtrów (`wejscie-141`, „Czego NIE trzeba jej mówić").
   **Świadomie pomijane:** trzy karty MO8 wracające do kodu konstrukcji „D" (zbyt niszowe, szansa
   trafienia znikoma) oraz temat pustej marki/kategorii w promocjach — skala zmierzona to 0 produktów
   i karta 14m już zdecydowała (2026-09-19) tego Ani nie opisywać.
8. **Do Twojej decyzji** — cztery pozycje z D4, każda: problem w 1–2 zdaniach → propozycja →
   warianty do zaznaczenia.

Zasady pisania: bez tła technicznego, bez numerów wpisów backlogu i nazw plików kodu w tekście dla Ani
(reguła z PR.6 — „usunięte z tekstu numery wpisów backlogu i nazwy plików"). Etykiety UI cytowane
dosłownie z kodu, nie z pamięci.

## Testing strategy
Ticket dokumentacyjny — nie ma czego uruchomić. Weryfikacja polega na tym, że **każdy fakt w dokumencie
ma pokrycie w kodzie na `develop`**:
- etykiety UI („Rozstrzygnij", „Sprawdź kartę", „Braki w cenniku", komunikaty blokad) cytowane
  z `rebuild/frontend/src/pages/staging/polityka.ts`, `OknoBlokady.tsx`,
  `konfiguracja/DialogWgrywania.tsx` i `rebuild/backend/src/import/polityka/blokady.ts`;
- liczby (8329 produktów, 3362 pozycje w poczekalni, wiersze plików CSV z P10.5) z `docs/cutover.md`,
  własnego pomiaru na migawce i `docs/karty/P10.5/karta.md`;
- warunki środowiskowe z `tools/deploy-staging.sh`, `rebuild/backend/src/server.ts`, `config/env.ts`.
Bramki `rebuild/backend/` **nie są uruchamiane** — ticket nie dotyka `rebuild/`. Kontrola: `git diff --stat`
ma pokazać wyłącznie `docs/`.

## Out of scope
- Ścieżka krytyczna (import → parsery → baza → CSV → Selly → sklep) — TEST.2,
  `docs/instrukcja-testu-sciezki-krytycznej.md`.
- Zasady zgłaszania uwag przez Claude Code — TEST.3, `docs/instrukcja-pracy-dla-ani.md`.
- `docs/przeglad-12-widokow.md` — zostaje osobnym dokumentem, karta go NIE edytuje.
- Istniejące `docs/instrukcja-testow-*.md` — nie przepisujemy ich.
- Jakakolwiek zmiana w `rebuild/`, `contract/`, `rebuild/schema/`, `docs/rebuild-roadmap.md`.
- Naprawa czegokolwiek z sekcji „Czego NIE zgłaszać" — te rzeczy są świadomie po cutoverze.

## Definition of done
- [ ] `docs/instrukcja-pelnego-testu.md` istnieje, w układzie „co zmieniliśmy → polecenie → rezultat", z kratkami ✅/❌
- [ ] Ścieżka krytyczna odesłana do TEST.2 jednym zdaniem, bez powtórzenia jej scenariuszy
- [ ] `docs/przeglad-12-widokow.md` odesłany, nie przepisany
- [ ] Warunki środowiskowe w dokumencie zgadzają się z `tools/deploy-staging.sh` i `docs/cutover.md`; trzy blokady Selly wymienione
- [ ] Ostrzeżenie o starych zgłoszeniach w poczekalni (D1) i o braku CSV po imporcie (`wejscie-144`) — obecne
- [ ] Sekcja „Do Twojej decyzji" ma cztery pozycje z D4, każda z wariantami do zaznaczenia
- [ ] Trzy znane defekty z `wejscie-141` opisane jako „nie zgłaszaj"
- [ ] Sprostowanie do punktu 8 przeglądu (plik CSV ≠ tabela) obecne; poprawka samego przeglądu zgłoszona w „Do koordynatora"
- [ ] Etykiety UI zgodne co do znaku z kodem na `develop`
- [ ] `git diff --stat` pokazuje wyłącznie `docs/`
- [ ] `docs/karty/TEST.1/karta.md` oznaczona ✅ z sekcją „Dowiezione"
- [ ] Gałąź zsynchronizowana z `origin/develop`, PR `MERGEABLE`
