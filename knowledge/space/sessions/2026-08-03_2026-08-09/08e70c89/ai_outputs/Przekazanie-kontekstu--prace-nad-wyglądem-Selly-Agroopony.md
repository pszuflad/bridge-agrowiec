# Przekazanie kontekstu — prace nad wyglądem sklepu Agroopony (Selly)

**Data przekazania:** 5 sierpnia 2026
**Poprzedni czat:** budowanie layoutu strony głównej sklepu agroopony.selly24.pl
**Cel dokumentu:** przekazać innemu LLM pełny kontekst tak, żeby mógł kontynuować pracę bez powtarzania błędów

---

## 1. Co to jest i dla kogo

Klient: **Agrowiec / Agroopony** — sklep internetowy z oponami rolniczymi, leśnymi, przemysłowymi i ciężarowymi.

Sklep działa na platformie **Selly** (silnik e-commerce SaaS, polski, panel admin w PHP).

Adres produkcyjny: **https://agroopony.selly24.pl/**
Admin: **https://agroopony.selly24.pl/adm/** — login `admin` / hasło `Agrowiec2026`

Anna (użytkowniczka, Wrocław) jest osobą techniczną, ale nie developerem. Wprowadza zmiany przez panel Selly (kopiuj-wklej). Pisze po polsku, bez ceregieli, oczekuje bardzo konkretnych instrukcji krok po kroku. Frustruje się gdy agent gubi wątek albo dodaje rzeczy nieuzgodnione.

**KRYTYCZNE zasady współpracy** (z instrukcji projektu):
- Zawsze pytaj PRZED wykonaniem zmiany
- Po każdej poprawce zaproponuj podsumowanie + backup do space
- Bez wyraźnej zgody nie ruszaj innych obszarów, nawet jeśli znajdziesz błąd — tylko opisz błąd, zaproponuj rozwiązanie, czekaj na decyzję
- Podsumowanie max 5 zdań, krótko rzeczowo
- Backup na KONIEC DNIA, nie po każdej mikro-zmianie
- Język: polski, zawsze
- Frontend: używaj konwencji Bootstrap 5.3 (https://getbootstrap.com/docs/5.3/) jako referencji stylistycznej

**Ustalenia są w pliku:** `USTALENIA_agroopony.md` w folderze projektu. **Zawsze skonsultuj go przed jakąkolwiek zmianą kodu.** Nie wymyślaj nic poza ustaleniami.

---

## 2. Architektura szablonu Selly — jak to działa

Selly udostępnia w panelu admin **Edytor szablonów** (Wygląd i treści → Edytor szablonów). Kategorie plików:

| Sekcja w panelu | Zawartość | Nasz odpowiednik |
|---|---|---|
| **Pliki SCSS** | pliki .scss (source), kompilowane do CSS | `variables.scss` (zmienne motywu), `base/utils.scss` (nasze customowe style) |
| **Arkusze stylów** | skompilowany CSS (read-only?) | — |
| **Podstawowe szablony stron** | pliki .tpl HTML dla layoutu | `B01. Strona główna` = `startPage.tpl` |
| **Komponenty nagłówka i stopki** | .tpl HTML | `D01. Nagłówek` = `portal.tpl` |
| **Komponenty strony głównej** | E01-E13, komponenty modułowe strony głównej | patrz niżej |

### Komponenty strony głównej (E01-E13)

Selly ma **natywne komponenty** które renderują się przez placeholdery `{#NAZWA#}` w `startPage.tpl`. Zamiast pisać własny HTML dla producentów/banerów, używamy tych natywnych i tylko stylujemy CSS:

- **E06 Promowani producenci** = placeholder `{#PRODUCENCI#}` — natywny Swiper, autoplay 2500ms, loop, breakpointy 3/5/7/13 slajdów. Loga producentów wciąga się z Asortyment → Producenci (oznaczenie „promowany")
- **E08 Menu kategorii głównych** — SlickNav sidebar menu, NIE ruszać
- **E12 Banery kategorii** = placeholder `{#BANNER_KATEGORIE#}` — kafelki kategorii z banerami. Aktualnie w `startPage.tpl` w linii 74, wewnątrz pierwszego `.container-max`
- Pełna lista E01-E13 widoczna w panelu

### SCSS — kompilacja

Pliki .scss trzeba **ręcznie skompilować** przyciskiem „Kompiluj SCSS" w edytorze. Dopiero po tym zmiany są widoczne. Dodatkowo Selly ma **wersjonowanie CSS** — dla natychmiastowego odświeżenia u klientów trzeba podnieść wersję o +1.

**Uwaga: SCSS w Selly jest wrażliwy na składnię.** Kilka razy złapaliśmy błędy kompilacji z powodu:
- Wklejenia bloku razem z markdownowymi „\`\`\`" (backticki) z odpowiedzi LLM — zawsze podaj kod bez otoczki markdown
- Wklejenia komentarzy `/* ... */` które kolidowały z parserem — bezpieczniej dawać goły CSS bez komentarzy
- Zagnieżdżeń SCSS `&::after` / `&:hover` — działa, ale w razie błędu lepiej rozwijać do płaskiego CSS

**Gdy kompilacja się wywala**, Selly pokazuje modal z długą listą błędów typu „`sass.Exception [Error]: expected "{"`" — zawsze zawierają numer linii pliku źródłowego. Sprawdź co jest w tej linii.

### Zapisywanie plików

Po każdej edycji pliku .tpl / .scss trzeba kliknąć przycisk **„Zapisz"** na dole ekranu. To nie jest automatyczne. Anna dwa razy myślała że zapisała a nie kliknęła przycisku.

### Zaszłości Selly które nas ograniczają

- **Klasy CSS motywu Selly są w BEM-podobnej konwencji** (`.header-top__contact`, `.categories-banners__item`, `.header-search__form`) — trzymamy się jej dla spójności
- **Kontener `container-max`** — główna szerokość treści. Sekcje muszą być wewnątrz niego, inaczej lądują poza ograniczeniem szerokości
- **Selly wstawia własne UI** które nie są w szablonach — np. „Darmowa dostawa dla zamówień powyżej 200 zł" pojawiła się z ustawień sklepu (nie z `portal.tpl`). Anna wyłączyła to ręcznie w konfiguracji
- **Selly ma osobny Edytor tłumaczeń** (Wygląd i treści → Edytor tłumaczeń) do zmiany tekstów natywnych sekcji, np. tytułu „Popularne kategorie"
- **Manager plików** (do wgrywania grafik) jest pod URL `.../adm/pliki/...`. Ścieżka na serwerze: `/img/bannery/`. Anna utworzyła podfolder `img/bannery/Maszyny zdjecia/`

---

## 3. Co jest ZROBIONE (produkcja, działa)

### ✅ Etap 1 — Kolory brand
- `variables.scss`: `$color-secondary`, `$color-ui-bg`, `$color-border-hl` ustawione na czarny `#000000` + żółty `#FFC709` + biały `#ffffff`

### ✅ Etap 2 — Topbar (czarny pasek na górze)
- **portal.tpl**: sekcja `<div class="header-top">` z blokiem `header-top__contact` po lewej (2 telefony + godziny) i `<nav class="header-top__menu">` po prawej (Blog / Nasze marki / Kontakt)
- **Usunięte:** mail `marta.bieguniak@agrowiec.eu` (Anna wcześniej rozkazała: „jaka kurwa darmowa wysyłka przeciez tego nie ma w ustaleniach" — analogiczny brak akceptacji dla maila)
- **utils.scss**: klasy `.header-top`, `.header-top__contact`, `.header-top__menu--tel`, `.header-top__menu--hours`, `.header-top__menu` — czarne tło, biały tekst, żółte ikony `\260E` (☎) i `\29D6` (⧖), hover żółty `#FFC709`
- **Media query mobile** (`max-width: 767px`): ukryte godziny, wyśrodkowane menu, wymuszony biały kolor `!important`

**Znany bug (odłożony):** Na niektórych urządzeniach mobilnych cyfry telefonu wyświetlają się w kolorze czarnym mimo `!important`. Anna powiedziała „to jakiś problem u mnie, nieważne" i przeszła dalej. Do wyjaśnienia później.

### ✅ Etap 3 — Menu główne
- Menu renderuje: **Rolnicze / Leśne / Przemysłowe / Ciężarowe / Nowości / Promocje / Producenci**
- Nazwy KRÓTKIE (nie „Opony rolnicze") — decyzja Anny: „zostaw tak jka jest bo to wymaga tworzenia podkategorii"
- Kategoria „Rolnicze małe" (ID 5) jest w drzewie kategorii ale ma się nie wyświetlać w menu — nadal wisi jako otwarte zadanie

### ✅ Etap 3B — Kafelki maszyn (Popularne kategorie)
- Rezygnacja z pierwszej wersji („hardcoded `.machines-grid`") na rzecz **natywnego komponentu E12 `{#BANNER_KATEGORIE#}`**
- 4 kafelki z banerami:
  - **Rolnicze** (ID 1) → `Ciągnik.png`
  - **Leśne** (ID 2) → `Harwester.png`
  - **Przemysłowe** (ID 3) → `Koparka.png`
  - **Ciężarowe** (ID 4) → `Ciężarówka.png`
- Pliki w `img/bannery/Maszyny zdjecia/`, przypisane w panelu kategorii jako „Baner kategorii" (nie „Obrazek menu")
- **Style A (utils.scss):**
  - `.categories-banners__item` — `border-radius: 12px`, `aspect-ratio: 4/3`, `box-shadow`, gradient overlay (rgba(0,0,0,0.75) → 0 od dołu)
  - Tytuł u dołu, biały, `text-shadow`, żółte podkreślenie `#FFC709` 40px×3px → 100% na hover
  - Hover: `scale(1.06)` na obrazku, mocniejszy `box-shadow`
- **Swiper breakpointy (E12 template)**: `slidesPerView: 1.2, spaceBetween: 12` → `479px: 2/12` → `768px: 4/20` → `981px: 4/24`
- Media queries responsywne (`980px`, `767px`, `478px`) — mniejsze fonty, `aspect-ratio: 16/10` na tablecie

### ✅ Grafiki maszyn (regeneracja v3)
- Zapisane na serwerze produkcyjnym Selly:
  - `Ciężarówka.png` — europejska Volvo-style, tablica EU S-456-TH, złota godzina (v3 po skardze że „ma być bardziej europejsko")
  - `Koparka.png` — żółta koparka, **NIE ma ludzi** (Anna: „koło koparki ma nie być żadnych ludzi") (v3)
  - `Harwester.png` — leśny, **NIE leci para** („z harwestera ma nie lecieć para") (v3)
  - `Ciągnik.png` — 1 tylne koło (v2 — po skardze „czemu ten ciągnik ma dwie tylne opony?")

---

## 4. Co jest DO ZROBIENIA (kolejność)

### Priorytet natychmiastowy
1. **Fix koloru cyfr telefonu w topbarze na mobile** — cyfry są czarne mimo `!important`. Wymaga sprawdzenia w DevTools która reguła nadpisuje. Może wymagać podniesienia specyficzności selektora albo dodania stylu do innego media query (nie tylko `max-width: 767px`)
2. **Zmiana nazwy sekcji „Popularne kategorie" → „Opony do Twojej maszyny"** — przez Edytor tłumaczeń, nie przez SCSS
3. **Ukrycie kategorii „Rolnicze małe" (ID 5)** w drzewie menu — do zbadania czy przez ustawienie widoczności w panelu kategorii, czy CSS

### Priorytet następny
4. **E06 Promowani producenci** — 41 marek do oznaczenia jako „promowani" w Asortyment → Producenci. Slider już działa (natywny), potrzebne tylko oznaczenie loga
5. **USP pas** — 4 kafelki: Wysyłka 24h / Bezproblemowe zwroty / Bezpieczne zakupy / Profesjonalna obsługa. Ikony żółte `#FFC709`. Miejsce w `startPage.tpl` do ustalenia
6. **Stopka (Etap 5)** — 5 kolumn, aktualnie nie ruszana
7. **Doradca** (osoba: Arkadiusz Mielczarek), **Blog** (3 startowe teksty), **Newsletter** — sekcje w środku strony głównej

### Priorytet finalny
8. **Weryfikacja produkcyjna** (screenshoty desktop + mobile)
9. **Backup końca dnia** — podsumowanie + paczka kodu produkcyjnego do space

---

## 5. Pliki referencyjne w folderze projektu

W folderze `projects/budowanie-mostu-dla-agrowca-66T_zcugRE20vcBqkNB2nA/files/`:

- **`USTALENIA_agroopony.md`** ← KLUCZOWY, konsultować przed każdą zmianą — wszystkie zatwierdzone decyzje UX/UI
- `INSTRUKCJA_ETAP_3B_2026-07-29.md` — kafelki maszyn (archiwum, już wdrożone)
- `INSTRUKCJA_wklejania_ETAP_2_2026-07-29.md` — pierwsza wersja topbara
- `BACKUP_szablony_selly_agroopony_2026-07-29.md` — backup pełny z 29 lipca
- `DO_WKLEJENIA_E12_banery_kategorii.txt` — kod E12 z Swiper breakpointami (wdrożony)
- `DO_WKLEJENIA_ETAP_3B_categories_banners_scss.txt` — CSS Style A (wdrożony)
- `DO_WKLEJENIA_portal_tpl.txt` (13353 B) — kopia zapasowa portal.tpl
- `DO_WKLEJENIA_variables_scss.txt` (13991 B) — kopia zapasowa variables.scss
- Kilka `podsumowanie_*.md` z wcześniejszych poprawek Bridge (nie dotyczą wyglądu Selly)

---

## 6. Instrukcje dla następnego LLM — sposób komunikacji z Anną

**Anna oczekuje:**
- **Krok po kroku, po polsku**, jak do przedszkola — konkretne kliknięcia w panelu Selly z nazwami pozycji menu
- **Zrzuty ekranu** proś o nie zawsze gdy nie masz pewności co jest w danym pliku
- **Diagnozuj PRZED kodem** — jeśli sekcja jest za wąska, spytaj o DevTools zamiast pisać patch od razu (wcześniej agent kilka razy uderzał w niewłaściwe miejsce)
- **Jeden fragment kodu naraz** — nie duże bloki. Jak duży kod to wklej goły, bez otoczki markdown `\`\`\`` (Anna kopiuje razem z otoczką i wywala kompilację)
- **Nie sugeruj rzeczy które nie są w ustaleniach** — Anna wybucha przy własnowolnie dodanych elementach („darmowa dostawa" ją wkurzyła)
- **Ograniczenie 5 zdań na podsumowanie** po każdej wdrożonej poprawce

**Uważaj na:**
- Anna czasem cofa zmiany do stanu wcześniejszego — zawsze potwierdź „w jakim jesteś stanie" zanim wyślesz kolejny kod
- Jak zapyta „daj mi cały gotowy kod", chodzi jej o cały plik do Ctrl+A → Delete → wklej — nie fragment
- Backup NIE po każdym mikro-kroku — tylko na koniec dnia albo na wyraźną prośbę
- Anna zna Bootstrap 5.3 — jak proponujesz nowy komponent, referencja do docsów Bootstrapa pomaga

**Pytaj o zgodę na każdą zmianę zanim ją wprowadzisz. Zawsze proponuj podsumowanie + backup po wdrożeniu.**

---

## 7. Environment / dostępy

- **Panel:** https://agroopony.selly24.pl/adm/ — admin / Agrowiec2026
- **Sklep:** https://agroopony.selly24.pl/
- **Manager plików** (wgrywanie grafik): sekcja w panelu, ścieżka serwerowa `/img/bannery/`
- **Nasze grafiki maszyn:** `/img/bannery/Maszyny zdjecia/` (Ciągnik.png, Harwester.png, Koparka.png, Ciężarówka.png)

**Nie ma dostępu do serwera przez SSH / API Selly do szablonów.** Wszystkie zmiany przez panel admin, kopiuj-wklej.

---

## 8. Skróconą wersję wklej do nowego czatu

Do wklejenia jako pierwsza wiadomość w nowym czacie:

```
Kontynuuję pracę nad wyglądem sklepu Agroopony (Selly).
Panel: https://agroopony.selly24.pl/adm/ — admin / Agrowiec2026

Przed jakąkolwiek zmianą przeczytaj z projektu:
1. USTALENIA_agroopony.md (wszystkie zatwierdzone decyzje UX/UI)
2. PRZEKAZANIE_selly_agroopony_wyglad.md (pełen kontekst prac)

Stan na 5.08.2026:
GOTOWE: kolory brand, topbar (czarny, telefony po lewej, menu po prawej, bez maila),
menu główne (Rolnicze/Leśne/Przemysłowe/Ciężarowe/Nowości/Promocje/Producenci),
kafelki maszyn (E12 z żółtym podkreśleniem #FFC709, Style A).

DO ZROBIENIA (kolejność):
1. Fix cyfr telefonu w topbarze na mobile (są czarne zamiast białych)
2. Zmiana "Popularne kategorie" → "Opony do Twojej maszyny" (Edytor tłumaczeń)
3. Ukrycie kategorii "Rolnicze małe" (ID 5) w menu
4. Konfiguracja E06 Promowani producenci (41 marek)
5. USP pas (Wysyłka 24h / Zwroty / Bezpieczne zakupy / Obsługa)
6. Stopka (5 kolumn)
7. Doradca, Blog, Newsletter
8. Weryfikacja + backup końca dnia

Zasady:
- Jeden krok na raz, pytaj przed zmianą
- Kod wysyłaj goły, bez otoczki ```
- Frontend: Bootstrap 5.3 jako referencja
- Backup + podsumowanie na koniec dnia
- Polski język, konkretne instrukcje krok po kroku

Zacznij od pytania od czego chcę zacząć.
```
