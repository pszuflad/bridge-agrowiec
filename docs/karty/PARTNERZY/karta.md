# PARTNERZY — moduł partnerów B2B (cenniki EUR, zamówienia, tracking)

> **Stan:** 🟡 w trakcie (2026-10-10) — zrobione poziomy 1–5 (bez numeracji katalogowej) + krok wdrożenia (tickety 208–226); zostają numeracja, serwer plików, zamówienia, tracking — czekają na decyzje użytkownika (sekcja „Do koordynatora”)
> **Iteracja:** poza planem odbudowy — NOWA funkcjonalność · **Wpisy backlogu:** — · **Zależy od:** —
> **Tickety:** 208–227 (plan podziału: `podzial-na-tickety.md`; instrukcja testów: `docs/instrukcja-testow-PARTNERZY.md`)

**To NIE jest odtworzenie produkcji.** Moduł jest świadomym odstępstwem od reguły „wierna
odbudowa 1:1" (`CLAUDE.md`) — decyzja użytkownika, 2026-10-06. Nie zmienia niczego z
odtwarzanego zachowania; dokłada nowy obiekt „partner" obok istniejącego kodu.

Pierwsi dwaj partnerzy (Furman i Adtyres w nazewnictwie użytkownika; w plikach: TyreWorld
i Adtyres). Docelowo ich będzie więcej — każdy z indywidualnymi warunkami, konfigurowanymi
w panelu przez użytkownika, nie przez partnera.

## Zakres

Dla KAŻDEGO partnera, osobno:

- dodawanie/edycja w panelu; aktywacja i dezaktywacja bez usuwania;
- wybór magazynów, z których eksportujemy, i wykluczanie pojedynczych produktów;
- minimalny stan eksportu (domyślnie: nie eksportujemy stanu 0 i 1, od 2 w górę);
- narzut od ceny zakupu (NARZUT `zakup × (1+x)`, nie marża), per partner i per kraj;
- kurs EUR: NBP tabela A albo ręczny, per partner i per kraj;
- koszty przesyłki per kraj (dowolna liczba krajów, dodawanie/usuwanie; każdy kraj to osobne
  koszty), przeliczane na EUR po kursie NBP albo ręcznym;
- koszty dodatkowe doliczane do każdej opony (per partner/kraj);
- wybór kolumn z katalogu budujących plik oraz **własne pola obliczeniowe** z danych katalogu, np.
  `CenaDAP-Francja = (zakup + zakup×narzut_FR + przesyłka_FR + koszty_dodatkowe_FR) / kurs_EUR`;
- eksport CSV (separator, nazwy kolumn, kolejność) i XML (domyślnie wzorzec Ceneo);
- harmonogram generowania w minutach, osobny na partnera;
- odbiór zamówień przez FTP (katalog `orders`) i e-mail (osobna skrzynka partnera) — oba kanały
  od pierwszego wdrożenia, ustawiane per partner;
- wysyłka zamówień do sklepu (Selly) przez API, do jednego miejsca;
- generowanie trackingu dla partnera w dowolnym formacie po wprowadzeniu zamówienia do sklepu;
- logi: jedna linia na operację (np. „wygenerowano plik, 3000 pozycji"), błędy w osobnym
  `error_log` ze szczegółami; retencja 30 dni; archiwum plików 30 dni z automatycznym czyszczeniem.

### Katalogi na serwerze plików (na FTP istniejącego serwera Bridge)

```
NAZWAPARTNERA_<16 losowych znaków>/public/{orders,tracking,pricelist}
NAZWAPARTNERA_<16 losowych znaków>/private/{archive,conf}
```

`orders` — skąd Bridge pobiera zamówienia; `tracking` — dane trackingu dla partnera;
`pricelist` — aktualny cennik; `archive` — cenniki do 30 dni wstecz; `conf` — pliki konfiguracyjne
(jeśli będą potrzebne). Schematy nazw plików: ustalimy później.

## Decyzje (użytkownik, 2026-10-05/06)

| Obszar | Decyzja |
|---|---|
| Wiersz pliku | Jedna pozycja katalogu = jeden wiersz, BEZ agregacji magazynów. Pozycje tego samego produktu w różnych magazynach mają wspólny `kod_importu`, ale zostają osobnymi wierszami. Partner dostaje pozycje z wybranych magazynów. |
| Cena zakupu w formułach | `cenaZakupu` danej pozycji katalogu (czyli magazynowa). |
| Stan minimalny | Pomijamy pozycje ze stanem 0 i 1; eksport od stanu 2. Ustawienie partnera (dla obu obecnych = 2). |
| Numer katalogowy | UNIKALNY dla każdej pozycji katalogu (także per magazyn) — to bezpiecznik, po którym odróżniamy pozycje; nawet przy tym samym `kod_importu`. System własny: `KK PP NNNNN` — kategoria (01 rolnicze, 02 leśne, 03 przemysłowe, 04 ciężarowe; lista może rosnąć), producent 01–63 alfabetycznie (01 Alliance, 02 Annaite…), numer porządkowy opony u producenta. Numer trafia do Optimy jako nasz numer katalogowy. |
| Istniejące numery | Zachowujemy. Nowy system obejmuje opony dodane od teraz oraz pozycje bez numeru. Dla produktu w kilku magazynach stary numer zostaje przy pozycji z NAJNIŻSZĄ ceną; pozostałe magazyny dostają nowe, unikalne numery. |
| Kurs EUR | NBP tabela A; w weekend/święta ostatni znany; gdy NBP nie odpowiada — ostatni zapisany kurs i ostrzeżenie w logu. Każdy wygenerowany plik zapisuje użyty kurs. |
| Zaokrąglanie | Do 2 miejsc po przecinku; ustawienie per partner (inne reguły: pełne EUR, w górę do 5/10). Obliczenia pośrednie w pełnej precyzji, zaokrąglamy dopiero wynik. |
| Transport V1 | Tabele GEIS: **kolumna 1 = stawka całego kraju** (jedyna wypełniona). Waga rozliczeniowa = większa z rzeczywistej i gabarytowej (wymiary × współczynnik kraju). Koszt liczony dla **1 sztuki** (przesyłka pojedyncza) i w całości wchodzi do ceny tej opony. |
| Paliwo | Opłata paliwowa to orientacyjna wartość wpisywana RĘCZNIE (zmienia się), wyświetlana jako procent (np. 11%), nie współczynnik 1,11; z historią zmian (okres → wartość); zmiana nie przelicza wstecz już wygenerowanych plików. |
| Brak wagi | Pozycja bez wagi pomijana i logowana jako błąd kalkulacji (NIGDY zero). Waga uzupełniona automatycznie/szacowana (`wagaAutoUzupelniona`, `wagaSzacowana`) jest używana, ale oznaczona w logu jako mniej pewna. |
| Struktura pliku | Ustawia ją zarządca Bridge, nie partner. Docelowo wzorzec Ceneo (XML); gdy partner zażąda innych kolumn lub innej kolejności — musimy móc to wprowadzić i zmienić w konfiguracji. |
| Serwer plików | NIE stawiamy nowego: partnerzy dostają własne dane logowania do FTP na serwerze, na którym działa Bridge (do weryfikacji: protokół FTP/FTPS/SFTP, sposób zakładania kont, izolacja do własnego katalogu). |
| Sklep docelowy zamówień | Selly. Użytkownik potwierdza, że Selly pozwala tworzyć zamówienia przez API (NIE zweryfikowane tu — dokumentacja Selly niedostępna z sesji; klient w `src/selly/klient.ts` ma dziś tylko odczyt: `listOrders`, `getOrder`). |
| Klucz produktu w zamówieniu | `CODE` z pliku zamówienia = numer katalogowy pozycji (jednoznaczny, więc Bridge nie wybiera magazynu sam). |
| Cena w zamówieniu | Tolerancja/bufor cenowy PER PARTNER (w walucie innej niż PLN), porównywana z ceną z ostatnio wygenerowanego dla partnera cennika. Poza tolerancją: zamówienie wpada do Selly normalnie, ze statusem „błąd importu", i **NIE wychodzi żadne powiadomienie do partnera**. Zakładane: ta sama zasada dla innych błędów (nieznany kod, brak stanu) — do potwierdzenia. |
| Numery zamówień | Dwa numery: partnera (np. `A01UF90224`) i nasz. Bridge trzyma powiązanie; plik trackingu używa numeru partnera. |
| Tracking | Operator wpisuje numer przewoźnika w Bridge; Bridge wysyła go do Selly i generuje plik trackingu dla partnera. Zamówienie ze statusem „błąd importu" nie dostaje trackingu, dopóki człowiek go nie rozwiąże. |

## Otwarte (do planu / dalszych decyzji)

1. **Tworzenie zamówień w Selly przez API** — potwierdzone przez użytkownika, ale do zweryfikowania w dokumentacji i na teście (endpoint, pola, adres dostawy klienta końcowego, numer zewnętrzny).
2. **Wartość tolerancji cenowej** (w %) i zasada dla zamówień z ceną WYŻSZĄ niż w cenniku.
3. **Strefy GEIS 2–N i kody pocztowe** — w arkuszu puste; V1 używa wyłącznie kolumny 1. V2 (z bieżących wycen, kraj+strefa+próg, ręcznie zatwierdzane) — poza pierwszym zakresem.
4. **Schematy nazw plików** — ustalimy później (decyzja użytkownika).
5. **Hierarchia reguł cen i minimalna rentowność** — w poprzedniej specyfikacji (cena specjalna produktu → produkt → producent → kategoria → domyślna; bez sumowania; ostrzeżenie/blokada poniżej minimum) — niepotwierdzone w tej rozmowie.
6. **Protokół i konta FTP** na serwerze Bridge (weryfikacja na serwerze, nie z sesji chmurowej).
7. **Dokładna nazwa kolumn** nowych cenników — wyjdą z konfiguracji partnera; wzorce poniżej.

## Pliki (wyłączna własność)

Dokument specyfikacyjny. Kod: do ustalenia w planie (nowy moduł obok istniejącego; nie ruszać
`src/import/legacy/` ani odtwarzanych tras).

---

## Załącznik: dane z plików wzorcowych (2026-10-05)

### TyreWorld (`tyreworld_agrowiec.csv`) — jeden plik, kolumny krajów

- 4013 wierszy, **jeden wiersz na EAN**; separator `;`, UTF-8, LF, bez BOM.
- Kolumny: `CatNumber;EAN;ProductName;ProductBrand;ProductModel;ProductSize;StockQty;DOT;MfrCode;`
  `FR euro nett ;DE euro nett ;NL euro nett ;BE euro nett ;AT euro nett ;IT euro nett ` (spacje na końcu nazw).
- Cena kraju = gotowa cena netto EUR produktu **z transportem do kraju**.
- Mediana ceny względem FR: DE 0,71 · NL 0,74 · AT 0,77 · IT 0,81 · BE 0,84 (różnice = transport).
- Defekty do NIEpowtarzania: 30 pustych `CatNumber`; 12 wierszy z `-` w `AT euro nett`;
  spacje na końcu nazw produktów (3089 wierszy) i kolumn.

### Adtyres (`adtyres_agrowiec_at.csv`) — osobny plik na kraj (tu: AT)

- 4635 wierszy + pusty wiersz końcowy (jedna spacja); **jeden wiersz na EAN × magazyn**
  (573 EAN-y w 2–4 magazynach; magazyny MO1–MO5, MO7, MO11).
- Kolumny: `CatNumber;EAN;ProductName;ProductBrand;ProductModel;ProductSize;PriceEurNet;StockQty;DOT;Warehouse `.
- Defekty: spacja przed KAŻDYM `CatNumber`; spacje w nazwie kolumny `Warehouse ` i w wartościach;
  31 pustych `CatNumber`; 29 powtórzonych par EAN×magazyn; 60 wierszy ze stanem 0; `DOT` pusta.
- **Cena AT w obu plikach identyczna** dla 3428 EAN-ów z jednym magazynem (cena i stan co do grosza):
  jeden silnik kalkulacji, różni się tylko układ wyjścia. Dla 573 EAN-ów wielomagazynowych TyreWorld
  pokazuje najniższą cenę w 96% przypadków (549/573); stan ≠ suma magazynów (44), ≈ maksimum (454).
  **Ta agregacja jest historyczna** — nowy moduł jej nie odtwarza (decyzja wyżej).

### Numery katalogowe a system użytkownika

Zmierzone na obu plikach: 3435 numerów 9-cyfrowych (zgodne), **548 10-cyfrowych** (głównie marka Gri),
30/31 pustych; kategoria `05` (5 pozycji) poza listą 01–04; marka `Gri` pod 24 kodami producenta,
Alliance 01 i 94, Michelin 36 i 37, Ceat 10/11/12, Deli 67 (>63); prefiks 4-cyfrowy bywa wspólny dla
kilku marek (`0112` = Ceat i Gri). Numery są unikalne względem EAN i identyczne w obu plikach.
W Adtyres numer powtarza się między magazynami (ok. 630 wierszy współdzieli numer) — sprzeczne z zasadą
unikalności; stąd decyzja „stary numer przy najtańszej pozycji, reszta nowe".

### Przykład zamówienia partnera (XML, 2024-02-02)

```xml
<DOCUMENTORDER>
  <INVOICE><NUMBER>A01UF90224</NUMBER><FROM>04358</FROM><NAME>AD TYRES INTERNATIONAL SLU</NAME>
    <TAXID>ATU71690869</TAXID> … <COUNTRY>AD</COUNTRY></INVOICE>
  <DATE>2024-02-02 11:27:11</DATE><DELIVERYDATE>2024-02-02</DELIVERYDATE>
  <ORDERCURRENCY>EUR</ORDERCURRENCY><NUMBER>A01UF90224</NUMBER>
  <PRODUCTS><PRODUCT><CODE>011200284</CODE><NAME>Ceat Farmax R70 280/70 R18 114A8/B</NAME>
    <ORDERQUANTITY>2</ORDERQUANTITY><SELL_PRICE>202.00</SELL_PRICE></PRODUCT></PRODUCTS>
  <DELIVERY><MODEOFTRANSPORT>1</MODEOFTRANSPORT><CODCOST>0</CODCOST><DELIVERY_COST>0.00</DELIVERY_COST>
    <CUSTOMERNAME>…</CUSTOMERNAME> … <COUNTRY>AT</COUNTRY><PHONE>…</PHONE></DELIVERY>
</DOCUMENTORDER>
```

- Brak EAN i magazynu; produkt wskazuje `CODE` (format numeru katalogowego).
- Wysyłka bezpośrednio do klienta końcowego (adres w `DELIVERY`).
- Kod `011200284` nie istnieje w dzisiejszych plikach (ani jako numer, ani EAN); podobny produkt ma
  teraz `011200612` — **kody mogą wygasać**, potrzebna obsługa „nieznany kod" (status „błąd importu").
- Klucz idempotencji: `NUMBER` (numer zamówienia partnera).

### Tabele transportowe GEIS (`GEIS_tabele_13_krajow.xlsx`, odczyt z panelu 2026-10-05)

Źródło: panel `agroopony.eu`, `dzial=conf_cenniki_geis`. Panel nie określa jednostek, waluty ani
netto/brutto (zakładamy EUR netto — zgodne z wyceną FR 175 EUR). Parametry per kraj: opłata paliwowa
(współczynnik 1,11 wszędzie), koszt pakowania (0), współczynnik wagi gabarytowej (200 lub 250),
maks. L×W×H. Kolumny = strefy 1–N; **wypełniona tylko strefa 1**, „Średnia" w panelu = kopia strefy 1.

| Kraj | Stref | Progi wagowe | Wsp. gab. | Maks. wymiary | Stawka kol. 1 @100 / @500 / @2500 |
|---|---|---|---|---|---|
| Francja | 20 | 100…2500 (co 100) | 250 | brak | 103 / 369 / 1135 |
| Niemcy | 14 | 50…2500 (21 progów) | 200 | brak | 42 / 128 / 461 |
| Holandia | 1 | 100…2500 | 250 | brak | 46 / 155 / 516 |
| Belgia | 2 | 100…2500 | 200 | brak | 84 / 209 / 883 |
| Austria | 5 | 50…2500 | 200 | 240×240×220 | 61 / 187 / 676 |
| Czechy | 4 | 50…2500 | 250 | 240×240×220 | 46 / 113 / 396 |
| Słowacja | 2 | 50…2500 | 250 | 240×240×220 | 44 / 106 / 340 |
| Litwa | 1 | 50…2000 | 250 | 200×200×200 | 49 / 82 / — |
| Łotwa | 1 | 50…2000 | 250 | 200×200×200 | 70 / 141 / — |
| Rumunia | 13 | 50…2500 | 250 | 120×120×220 | 129 / 239 / 876 |
| Węgry | 5 | 50…2500 | 250 | brak | 63 / 190 / 654 |
| Włochy | 8 | 100…2500 | 250 | brak | 71 / 222 / 1004 |
| Luksemburg | 1 | 100…2500 | 200 | brak | 68 / 194 / 754 |

Wnioski dla projektu: progi wagowe są **per kraj** (nie jednakowe); trzeba liczyć wagę rozliczeniową
jako większą z rzeczywistej i gabarytowej. Sprawdzian na prawdziwej wycenie: półpaleta 80×60×85 cm,
56 kg, FR 66500, **175 EUR**. Waga gabarytowa 0,408 m³ × 250 = 102 kg → próg 200 kg → stawka 163 →
z paliwem 163 × 1,11 = 181 EUR (bez gabarytów: próg 100 kg → 103 × 1,11 = 114 EUR, ~35% poniżej
rzeczywistej ceny). To jedna obserwacja, nie dowód, że strefa 1 obejmuje 66500.

Katalog ma pola do wagi gabarytowej: `waga`, `dlugosc`, `szerokoscPaczki`, `wysokosc`
(`src/db/schema.ts:82-92`); część wag jest szacowana (`wagaAutoUzupelniona`, `wagaSzacowana`).

## Co jest w Bridge, a czego nie ma (stan kodu 2026-10-06)

- **Jest:** `products` (`cenaZakupu`, `magazyn`, `stan`, `vat`, `ean`, `kodImportu`, `waga`, wymiary),
  scheduler importu (`src/import/scheduler.ts`) i Selly (`src/selly/rest/scheduler.ts`), generator
  CSV Selly (`src/selly/generator-csv.ts`), tabele `suppliers`, `config`.
- **Brak:** obiektu „partner", kursów NBP, FTP/SFTP, odbioru zamówień (plik/e-mail), tworzenia
  zamówień w Selly (klient tylko czyta), trackingu, parsera formuł, szablonów CSV/XML per odbiorca,
  walut, kosztów przesyłki per kraj, tabel GEIS.

## Dowiezione

Stan na 2026-10-10 (wszystko na `develop`, PR-y #323–#342; **nic nie jest jeszcze na produkcji** — wymaga merge'u `develop` → `main`):

| Poziom | Co jest | Ticket |
|---|---|---|
| 1 | model danych partnera (migracja 024), REST ustawień partnera (`/api/partnerzy`) | 208, 209 |
| 2 | kurs EUR (NBP tabela A / ręczny, rezerwa przy awarii), parser formuł pól obliczeniowych, tabele GEIS + paliwo z historią (migracje 025–026), kalkulator ceny | 210–213 |
| 3 | selekcja pozycji (magazyny, wykluczenia, stan min.), szablony CSV i XML (Ceneo), generator z zapisem atomowym i archiwum 30 dni, test zgodności z układem plików wzorcowych (dane syntetyczne) | 214–218 |
| 4 | logi operacji i błędów z retencją 30 dni (migracja 027), harmonogram per partner (domyślnie wyłączony) i ręczne „generuj teraz” | 219, 220 |
| 5 | panel: lista, konfiguracja, kolumny i pola obliczeniowe z podglądem, logi i „Generuj teraz” | 221–225 |
| 9 | krok wdrożenia: partnerzy TyreWorld i Adtyres jako nieaktywni | 226 |

Założenia wykonawcze do potwierdzenia: przesyłka GEIS w EUR (nie dzielona przez kurs), narzut w %, koszty dodatkowe w PLN; do pliku tylko produkty `status='aktywny'`; nazwy plików robocze; struktura XML wg publicznego formatu Ceneo.
Trasy `/api/partnerzy*` są poza `contract/openapi.yaml` (jak `/api/ean-pary`).

## Do koordynatora

- Karta spoza planu odbudowy: wymaga decyzji o miejscu w roadmapie (nowa iteracja/blok) i podziale
  na tickety. Propozycja bloków (z rozmowy 2026-10-06): (1) model danych partnera, kraje, koszty,
  reguły cen, harmonogram; (2) kurs NBP i formuły; (3) generator CSV/XML, szablony, zapis atomowy;
  (4) scheduler w minutach, logi, retencja 30 dni; (5) katalogi i dostęp FTP; (6) zamówienia:
  odbiór, mapowanie, API do Selly; (7) tracking; (8) panel (lista partnerów, konfiguracja,
  aktywacja, podgląd bez zapisu). Bloki 1–4 dają pierwszą wartość (pliki dla obu partnerów);
  5–7 niosą największe ryzyko.
- Numeracja katalogowa (`KK PP NNNNN`, unikalność per pozycja) dotyka też Optimy i Selly —
  osobna decyzja, jak ją nadawać w Bridge i kto jest właścicielem generatora numerów.

### Stan na 2026-10-10 — co zostaje i pytania do użytkownika

**Niezrobione tickety** (kolejność wg `podzial-na-tickety.md`): PRT-1.2 (numer katalogowy `KK PP NNNNN`), poziom 6 (konta FTP i publikacja plików), poziom 7 (zamówienia: odbiór FTP/e-mail, walidacja, wysyłka do Selly, panel), poziom 8 (tracking). Każdy zaczyna od pytań poniżej.

**Pytania, które blokują dalsze tickety:**
1. **Numeracja `KK PP NNNNN`** (PRT-1.2): kto ma generator, wpływ na Optimę i Selly, reguła „stary numer przy najtańszej pozycji", 10-cyfrowe numery marki Gri, kategoria 05, producenci > 63.
2. **Serwer plików** (poziom 6): protokół (FTP/FTPS/SFTP), zakładanie kont, izolacja do własnego katalogu — wymaga odczytu z serwera Bridge.
3. **Zamówienia** (PRT-7.4): wartość tolerancji cenowej (%), zasada dla ceny wyższej niż w cenniku, potwierdzenie „bez powiadomienia partnera" także dla nieznanego kodu i braku stanu.
4. **Selly — tworzenie zamówień przez API** (PRT-7.5): endpoint, pola, adres dostawy klienta końcowego, numer zewnętrzny; wymaga dokumentacji Selly lub konta testowego. Tracking (poziom 8) zależy od tego wyniku.
5. **Dane do wgrania:** `GEIS_tabele_13_krajow.xlsx` (importer przyjmuje JSON, `npm run importuj-geis`), pliki wzorcowe `tyreworld_agrowiec.csv` i `adtyres_agrowiec_at.csv` (do porównania liczbowego), wzorzec XML od partnera.
6. **Schematy nazw plików** (cennik, archiwum, tracking) — dziś robocze.
7. **Potwierdzenie założeń kalkulatora** (rozdział 2 instrukcji testów) i statusu `aktywny`.
8. **Harmonogram:** czy i kiedy włączyć `PARTNERZY_SCHEDULER` (krok wdrożenia zmieniający `.env`, tylko za zgodą).
9. **Wdrożenie:** zgoda na `develop` → `main` (opis w PR #342: dwa puste, nieaktywne wiersze partnerów, puste tabele, nowa pozycja menu, harmonogram wyłączony).
