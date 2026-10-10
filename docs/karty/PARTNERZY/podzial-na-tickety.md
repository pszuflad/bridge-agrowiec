# PARTNERZY — podział na tickety wg hierarchii budowy

> **Stan:** plan podziału, 2026-10-10 · właściciel: koordynator · źródło zakresu: `karta.md` (ten sam katalog)
> **Nie mają jeszcze numerów ticketów.** Numer rezerwuje się atomowo przy starcie każdego ticketu
> (`feature.md`, Krok 4). Do tego czasu tickety nazywa się identyfikatorem `PRT-…` z tego pliku. Przydzielone: PRT-1.1 = ticket 208, PRT-1.3 = ticket 209 (trasy poza `openapi.yaml`, jak `/api/ean-pary`), PRT-2.1 = ticket 210, PRT-2.3 = ticket 211, PRT-2.2 = ticket 212, PRT-2.4 = ticket 213, PRT-3.1 = ticket 214, PRT-3.2 = ticket 215, PRT-3.3 = ticket 216, PRT-3.4 = ticket 217, PRT-3.5 = ticket 218, PRT-4.2 = ticket 219, PRT-4.1 = ticket 220, PRT-5.1 = ticket 221, PRT-5.2 = ticket 222, PRT-5.3a = ticket 223, PRT-5.3 = ticket 224, PRT-5.4 = ticket 225, PRT-9.1 (krok wdrożenia) = ticket 226, PRT-9.2+9.3 = ticket 227.

## Zasady układu

0. **Decyzje otwarte i spike’i nie są osobnymi ticketami** (zmiana 2026-10-10). Każdy ticket zaczyna od krótkiej listy „Pytań na start” do użytkownika i dopiero potem koduje. Gdzie to dotyczy: PRT-1.2 (numeracja `KK PP NNNNN`, Optima/Selly), PRT-2.4 (rentowność, opcjonalnie), PRT-3.4 i 6.2 i 8.2 (schematy nazw plików), PRT-6.1 (protokół FTP, konta; wymaga odczytu z serwera), PRT-7.4 (tolerancja cenowa, zasada dla ceny wyższej, błędy bez powiadomienia), PRT-7.5 (tworzenie zamówień w Selly przez API; wymaga dokumentacji/testu Selly; NO-GO zmienia poziom 7–8).
1. **Budujemy od fundamentu do góry:** dane → silnik obliczeń → pliki → automat → panel → kanały zewnętrzne → zamówienia → tracking → wdrożenie. Ticket nie startuje, dopóki nie są zamknięte jego zależności (kolumna „Zależy od”).
2. **Pierwsza wartość = poziomy 1–4 + panel minimalny (5.1–5.2):** pliki cenników dla obu partnerów. Zamówienia i tracking (poziomy 7–8) niosą największe ryzyko, więc idą po tym, jak pliki działają na produkcji.
3. **Jeden ticket = jedna zmiana weryfikowalna osobno** (własny PR do `develop`, bramki `lint/typecheck/build/test`, kontrakt `openapi.yaml` + fixtures tam, gdzie dotyka API).
4. **Nowy moduł obok istniejącego kodu** — nie ruszamy `src/import/legacy/` ani odtwarzanych tras. Kod: `rebuild/backend/src/partnerzy/` (+ `repos/partnerzy*.ts`, `routes/partnerzy*.ts`), front: `rebuild/frontend/src/pages/partnerzy/`.
5. **Dane i konta na produkcji tylko krokiem wdrożenia** (`src/kroki/rejestr.ts`), nigdy ręcznie na serwerze (`CLAUDE.md`). Sekrety (hasła FTP, skrzynka e-mail, klucze Selly) wpisywane raz do `$PROD_ROOT/.env`; krok zależny od sekretu pomija się z wpisem w logu, gdy go brak.
6. **Wspólne pliki nie dostają dopisków:** każdy ticket pisze `docs/spec-backend/wpis-<N>.md`; stan kart w `docs/karty/…`.

## Mapa hierarchii

```
POZIOM 1  Fundament danych: model partnera, numer katalogowy, CRUD
POZIOM 2  Silnik obliczeń: kurs NBP, GEIS, formuły, kalkulator ceny
POZIOM 3  Generator plików: selekcja pozycji, CSV, XML, zapis atomowy
POZIOM 4  Automat: scheduler per partner, logi, retencja         ◄── PIERWSZA WARTOŚĆ (pliki)
POZIOM 5  Panel: lista, konfiguracja, kolumny/formuły, podgląd, logi
POZIOM 6  Serwer plików: konta FTP, katalogi, publikacja
POZIOM 7  Zamówienia: odbiór (FTP, e-mail), walidacja, Selly API, panel
POZIOM 8  Tracking: numer przewoźnika → Selly + plik dla partnera
POZIOM 9  Wdrożenie i zamknięcie: partnerzy startowi, test na środowisku testowym, docs
```

## Fale (kolejność realizacji i to, co idzie równolegle)

| Fala | Tickety | Uwagi |
|---|---|---|
| **F1** | PRT-1.1 → PRT-1.3 | 1.1 (**ticket 208**) najpierw; 1.2 po odpowiedzi na pytania startowe numeracji |
| **F2** | PRT-2.1, 2.2, 2.3 równolegle → PRT-2.4 | 2.1/2.2/2.3 są niezależne od siebie; 2.4 scala je |
| **F3** | PRT-3.1 → 3.2 ‖ 3.3 → 3.4 → 3.5 | 3.2 i 3.3 równolegle (dwa formaty) |
| **F4** | PRT-4.1 ‖ PRT-4.2 | po 3.4 |
| **F5** | PRT-5.1 → 5.2 → 5.3 → 5.4 | 5.1/5.2 mogą ruszyć już po 1.3 (równolegle z F2–F4); 5.3/5.4 po F3–F4 |
| **Wdrożenie I** | PRT-9.1 | pliki cenników dla obu partnerów na produkcji (bez FTP: ręczne pobranie/podgląd) |
| **F6** | PRT-6.1 → 6.2 | po odpowiedziach na pytania o FTP; po wdrożeniu I partner może już pobierać pliki |
| **F7** | PRT-7.1 → 7.2 ‖ 7.3 → 7.4 → 7.5 → 7.6 | 7.5 zależy od wyniku spike’a Selly (na starcie ticketu) |
| **F8** | PRT-8.1 → 8.2 → 8.3 | po 7.5 |
| **Wdrożenie II** | PRT-9.2, 9.3 | instrukcja testów, synchronizacja dokumentacji |

---

## POZIOM 1 — Fundament danych

| ID | Tytuł | Zakres | Zależy od | Dotyka |
|---|---|---|---|---|
| **PRT-1.1** | Model danych partnera | Migracja (`rebuild/schema/024_…`) + model Drizzle: `partnerzy` (nazwa, aktywny, stan_min domyślnie 2, zaokrąglanie, harmonogram w minutach, kanały zamówień, tolerancja ceny), `partner_magazyny`, `partner_wykluczenia` (produkty), `partner_kraje` (narzut, źródło kursu NBP/ręczny + wartość, koszty dodatkowe, przesyłka), `partner_kolumny` i `partner_pola_obliczeniowe`, `partner_paliwo_historia`, `partner_kursy` (użyty kurs per plik). Bez logiki. Kopia bazy przed migracją. | — | `schema/`, `db/schema.ts` |
| **PRT-1.2** | Numer katalogowy pozycji | Kolumna numeru katalogowego w `products` (unikalna per pozycja), generator `KK PP NNNNN`, słowniki kategorii i producentów, backfill jako **krok wdrożenia** (zachowanie istniejących numerów; reguła „najniższa cena zachowuje stary”). Reguła `nazwa_pamiec`/`manual_overrides` nie dotyczy (numer ≠ nazwa), ale sprawdzić. Uwaga na pułapkę typów INTEGER/boolean przy odczycie. | 1.1 + pytania na start | `db/schema.ts`, `kroki/rejestr.ts`, import (nadawanie dla nowych) |
| **PRT-1.3** | Repo i REST: CRUD partnera | `repos/partnerzy.ts`, `routes/partnerzy.ts`: lista, szczegół, dodanie/edycja, aktywacja/dezaktywacja bez usuwania, magazyny, wykluczenia, kraje (dodawanie/usuwanie dowolnej liczby). Wpis w `openapi.yaml` + fixtures, autoryzacja jak reszta panelu. | 1.1 | `routes/`, `contract/` |

## POZIOM 2 — Silnik obliczeń

| ID | Tytuł | Zakres | Zależy od |
|---|---|---|---|
| **PRT-2.1** | Kurs EUR z NBP | Klient NBP tabela A; weekend/święta = ostatni znany; awaria NBP = ostatni zapisany kurs + ostrzeżenie w logu; kurs ręczny per partner/kraj; zapis użytego kursu przy każdym pliku. Klient za interfejsem, atrapa w testach (nigdy prawdziwy NBP). | 1.1 |
| **PRT-2.2** | Tabele transportowe GEIS i paliwo | Import `GEIS_tabele_13_krajow.xlsx` do tabel (V1: tylko kolumna 1 = stawka kraju), progi wagowe per kraj, współczynnik gabarytowy, maks. wymiary; **waga rozliczeniowa = max(rzeczywista, gabarytowa)**; koszt dla 1 sztuki; opłata paliwowa ręczna w %, z historią okresów (bez przeliczania wstecz). Dane początkowe jako krok wdrożenia. Test z wyceną wzorcową (półpaleta 56 kg, FR → 181 EUR ze współczynnikiem). Sprawdzić reuse `src/waga-gabarytowa/`. | 1.1 |
| **PRT-2.3** | Parser formuł pól obliczeniowych | Bezpieczny parser wyrażeń (bez `eval`): zmienne z katalogu i konfiguracji partnera/kraju (`zakup`, `narzut_FR`, `przesylka_FR`, `koszty_dodatkowe_FR`, `kurs_EUR`), walidacja przy zapisie, czytelne błędy. Sprawdzić reuse `src/waga-gabarytowa/formula.ts`. Obliczenia pośrednie w pełnej precyzji. | 1.1 |
| **PRT-2.4** | Kalkulator ceny partnera | Scala 2.1–2.3: `(zakup × (1+narzut) + przesyłka + koszty dodatkowe) / kurs`, zaokrąglanie dopiero wynik (reguła per partner), pozycja bez wagi pomijana i logowana jako błąd kalkulacji (nigdy zero), waga szacowana/auto oznaczona w logu. Testy tabelaryczne na przypadkach z plików wzorcowych. | 2.1, 2.2, 2.3 |

## POZIOM 3 — Generator plików

| ID | Tytuł | Zakres | Zależy od |
|---|---|---|---|
| **PRT-3.1** | Selekcja pozycji eksportu | Jedna pozycja katalogu = jeden wiersz (bez agregacji magazynów); filtr magazynów partnera, wykluczenia produktów, stan minimalny (domyślnie ≥2); czyszczenie danych (bez spacji w nazwach, bez pustych numerów — defekty z plików wzorcowych nie wracają). Odczyt z pominięciem mappera boolean tam, gdzie potrzebne surowe flagi. | 1.1, 1.2, 2.4 |
| **PRT-3.2** | Szablon CSV | Separator, nazwy i kolejność kolumn, UTF-8/LF/bez BOM, kolumny z katalogu + pola obliczeniowe, układ „jeden plik, kolumny krajów” (TyreWorld) i „plik na kraj” (Adtyres). | 3.1 |
| **PRT-3.3** | Szablon XML (wzorzec Ceneo) | Domyślny wzorzec Ceneo, konfigurowalny przez zarządcę; zmiana kolumn/kolejności bez zmian w kodzie. | 3.1 |
| **PRT-3.4** | Zapis atomowy, archiwum, metadane | Zapis do pliku tymczasowego + rename; `pricelist/` = aktualny, `archive/` do 30 dni z automatycznym czyszczeniem; zapis użytego kursu i liczby pozycji. Katalog docelowy na dysku konfigurowalny (do czasu FTP w poziomie 6). | 3.2, 3.3 |
| **PRT-3.5** | Test zgodności z plikami wzorcowymi | GATE porównawczy: wygenerowany cennik vs `tyreworld_agrowiec.csv` / `adtyres_agrowiec_at.csv` (cena AT identyczna dla 3428 EAN-ów z jednym magazynem; różnice w agregacji magazynów świadome). Raport rozbieżności dla użytkownika. | 3.4 |

## POZIOM 4 — Automat

| ID | Tytuł | Zakres | Zależy od |
|---|---|---|---|
| **PRT-4.1** | Scheduler per partner | Harmonogram w minutach, osobny na partnera, wzór: `src/import/scheduler.ts`; ochrona przed nakładaniem się uruchomień, wyłączony dla partnera nieaktywnego, ręczne „generuj teraz”. | 3.4 |
| **PRT-4.2** | Logi operacji i retencja | Jedna linia na operację (np. „wygenerowano plik, 3000 pozycji”), osobny `error_log` ze szczegółami (błędy kalkulacji, brak wagi, awaria NBP), retencja 30 dni z czyszczeniem, odczyt przez REST. | 1.1, 4.1 |

## POZIOM 5 — Panel

| ID | Tytuł | Zakres | Zależy od |
|---|---|---|---|
| **PRT-5.1** | Panel: lista partnerów i aktywacja | Strona `pages/partnerzy/`, dodanie partnera, aktywacja/dezaktywacja, stan ostatniego generowania. Zgodnie ze `standardy-ui-ux.md`; handlery MSW dopisane do współdzielonych mocków. | 1.3 |
| **PRT-5.2** | Panel: konfiguracja partnera | Magazyny, wykluczenia, stan minimalny, zaokrąglanie, kraje (dodaj/usuń), narzut/kurs/koszty/przesyłka per kraj, paliwo z historią, harmonogram. | 5.1, 2.1, 2.2 |
| **PRT-5.3** | Panel: kolumny, pola obliczeniowe, podgląd | Wybór i kolejność kolumn, edytor pól obliczeniowych z walidacją (2.3), **podgląd bez zapisu** (próbka wierszy z wyliczonymi cenami). | 5.2, 2.3, 3.2 |
| **PRT-5.4** | Panel: logi i pliki | Podgląd logu operacji i `error_log`, lista archiwum plików (30 dni), pobranie pliku, „generuj teraz”. | 5.1, 4.2 |

## Wdrożenie I — pliki dla obu partnerów

| ID | Tytuł | Zakres | Zależy od |
|---|---|---|---|
| **PRT-9.1** | Konfiguracja startowa partnerów + wdrożenie | Krok wdrożenia zakładający partnerów TyreWorld i Adtyres z ustawieniami startowymi (wyłączonych do czasu akceptacji), merge `develop` → `main` po zielonych sprawdzeniach i „tak” użytkownika; weryfikacja na środowisku testowym (`training.agroopony.eu`) przed produkcją. | 3.5, 4.2, 5.1–5.4 |

## POZIOM 6 — Serwer plików

| ID | Tytuł | Zakres | Zależy od |
|---|---|---|---|
| **PRT-6.1** | Konta i katalogi partnerów | Struktura `NAZWAPARTNERA_<16 znaków>/public/{orders,tracking,pricelist}` i `private/{archive,conf}`, konta z izolacją do własnego katalogu, tworzenie jako krok wdrożenia; hasła z `.env`, nigdy w repo. | 1.3 + pytania na start |
| **PRT-6.2** | Publikacja plików na serwer partnera | Generator zapisuje do `public/pricelist`, archiwum do `private/archive`, retencja 30 dni; test, że partner widzi tylko swój katalog. | 6.1, 3.4 |

## POZIOM 7 — Zamówienia

| ID | Tytuł | Zakres | Zależy od |
|---|---|---|---|
| **PRT-7.1** | Model zamówień i parser XML | Tabele zamówień (numer partnera + nasz numer, powiązanie), parser `DOCUMENTORDER` (przykład w `karta.md`), idempotencja po `NUMBER`, adres dostawy klienta końcowego. | 1.1 |
| **PRT-7.2** | Odbiór zamówień przez FTP | Pobieranie z `orders/`, przeniesienie do przetworzonych, obsługa uszkodzonych plików. | 7.1, 6.1 |
| **PRT-7.3** | Odbiór zamówień przez e-mail | Osobna skrzynka partnera (IMAP), załącznik XML, sekret w `.env`, pominięcie z logiem gdy brak konfiguracji. | 7.1 |
| **PRT-7.4** | Walidacja zamówienia | `CODE` = numer katalogowy (1.2), nieznany kod, brak stanu, cena poza tolerancją względem ostatniego cennika partnera → zamówienie idzie do Selly ze statusem „błąd importu”, **bez powiadomienia do partnera**. | 7.1, 1.2 + pytania na start |
| **PRT-7.5** | Wysyłka zamówień do Selly | Rozszerzenie `src/selly/klient.ts` o tworzenie zamówień (za interfejsem, atrapa w testach — testy NIGDY nie wołają prawdziwego Selly), mapowanie pól, ponowienia, idempotencja. Zależy od wyniku spike’a Selly na starcie ticketu. | 7.4 + spike Selly na start |
| **PRT-7.6** | Panel zamówień | Lista zamówień partnera, statusy, błędy importu do rozwiązania przez człowieka, powiązanie numeru partnera z naszym. | 7.5, 5.1 |

## POZIOM 8 — Tracking

| ID | Tytuł | Zakres | Zależy od |
|---|---|---|---|
| **PRT-8.1** | Wpis numeru przewoźnika | Operator wpisuje numer w Bridge; przekazanie do Selly; zamówienie ze statusem „błąd importu” nie dostaje trackingu, dopóki człowiek go nie rozwiąże. | 7.5 |
| **PRT-8.2** | Generator pliku trackingu | Plik dla partnera w konfigurowalnym formacie (numer zamówienia partnera + numer przewoźnika), zapis do `public/tracking`. | 8.1, 6.2 |
| **PRT-8.3** | Panel trackingu | Wprowadzanie numerów, podgląd wygenerowanych plików. | 8.1, 7.6 |

## Zamknięcie

| ID | Tytuł | Zakres | Zależy od |
|---|---|---|---|
| **PRT-9.2** | Instrukcja testów modułu | `docs/instrukcja-testow-PARTNERZY.md` dla Ani: pliki, kurs, zamówienie testowe, tracking, na środowisku testowym. | 8.3 |
| **PRT-9.3** | Synchronizacja dokumentacji | Aktualizacja `karta.md` (Stan/Dowiezione), spec-backend/frontend (wpisy per ticket), `openapi.yaml`, `docs/rebuild-backlog/` — przez doc-checkera. | 9.2 |

---

## Ryzyka, które mogą zmienić podział

- **Selly NO-GO** (Selly nie tworzy zamówień przez API) → poziom 7.5–8 do przeprojektowania; poziomy 1–6 niezmienione.
- **FTP** (FTP na serwerze Bridge niemożliwy lub bez izolacji) → 6.1 zmienia się na inny kanał; 3.4 nadal działa na dysku, więc pliki można dostarczyć inaczej.
- **PRT-1.2 dotyka Optimy i Selly** — numery katalogowe wychodzą poza Bridge; wdrażać dopiero po jawnej zgodzie użytkownika.
- **Nazwy produktów:** żaden z ticketów nie zmienia nazw w katalogu; gdyby tak się stało, obowiązuje reguła `nazwa_pamiec`/`manual_overrides` z `CLAUDE.md`.
- **Brak planu rentowności** (otwarta pozycja 5 karty) — jeśli wejdzie do V1, dodać ticket po 2.4 (blokada/ostrzeżenie poniżej minimum).
- **V2 transportu** (strefy 2–N, kody pocztowe) — poza tym podziałem; osobny ticket po wdrożeniu I.

## Liczba i rozmiar

32 tickety: P1 — 3, P2 — 4, P3 — 5, P4 — 2, P5 — 4, wdrożenie I — 1, P6 — 2, P7 — 6, P8 — 3, zamknięcie — 2. Największe: 2.2 (GEIS), 7.5 (Selly), 1.2 (numeracja).
