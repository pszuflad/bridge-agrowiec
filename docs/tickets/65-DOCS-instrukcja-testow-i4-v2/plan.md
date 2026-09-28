# 65-DOCS-instrukcja-testow-i4-v2 — delta dla Ani po poprawkach Iteracji 4

> Status: Draft → Approved → Implemented → Shipped
> Branch: `docs/65-instrukcja-testow-i4-v2`
> Worktree: `.worktrees/65-DOCS-instrukcja-testow-i4-v2`

## Opis ticketa

Karta 14m roadmapy — domyka FALĘ 2 Iteracji 14 i całą Iterację 4.

Powstaje JEDEN nowy plik: `docs/instrukcja-testow-I4-v2.md` — **DELTA, nie nowa instrukcja**.
Ania przeszła `docs/instrukcja-testow-I4.md` (narzuty i promocje) i zgłosiła uwagi; dokument
opisuje WYŁĄCZNIE to, co się od tamtego czasu zmieniło. Stara instrukcja dostaje **wyłącznie
banner** kierujący do v2 — treści nie przepisujemy i nie kasujemy.

Zero kodu produkcyjnego. Bramek kodu nie ruszamy.

## Kontekst

**Wzorzec:** `docs/instrukcja-testow-I3-v2.md` (664 linie, karta `56-DOCS-instrukcja-testow-i14`).
Konwencja sekcji trzymana co do joty: nagłówek `##` z numerem (+ ⭐ przy ważnych) → cytat blokowy
„Zgłosiłaś:" → akapit „Jak to naprawiliśmy." / „Jak to działa." → „Sprawdź:" (kroki) →
„Ma się stać:" → opcjonalna ramka ⚠ → cytat blokowy „Twoja ocena: ☐ OK ☐ ŹLE — uwagi: ___".

**Źródło prawdy o tym, co weszło** (raporty, nie plany):
- `docs/tickets/64-FEATURE-i14f-daty-koncza-promocje/raport.md` (14f) — pięć zmian,
- `docs/tickets/61-FEATURE-promocja-kolumna-katalog/raport.md` (14h) — kolumna „Promocja",
- `docs/rebuild-roadmap.md:2634` (blok 14m) — lista punktów do sprostowania + nota cutoverowa,
- `docs/rebuild-backlog.md` #19/#22/#25 — statusy i cytaty decyzji Ani,
- `docs/tickets/53-CHORE-i14e-diagnoza-promocji/` (14e) — diagnoza i cytaty jej zgłoszeń.

**Dosłowne brzmienia UI zweryfikowane w kodzie, nie w raportach** (żeby nie powtórzyć błędu
„raport opisał zamiar"):
- `rebuild/frontend/src/pages/narzuty/ceny.ts:171-182` — `opisLiczbyProduktow()`,
- `rebuild/frontend/src/pages/narzuty/TabelaNarzutow.tsx:113-127` — dialog usuwania narzutu,
- `rebuild/frontend/src/pages/narzuty/TabelaPromocji.tsx:127-141` — dialog usuwania promocji,
- `rebuild/frontend/src/pages/narzuty/DialogReguly.tsx:558-562` — nowa nota o datach,
- `rebuild/frontend/src/pages/katalog/formatowanie.tsx:152-165` + `kolumny.ts:26` — kolumna.

**Domiar własny (poza raportami):** `rebuild/frontend/src/pages/katalog/filtrowanie.ts:107-123`
— `sortuj()` czyta `produkt["promocja"]`, a wartość siedzi w `_reguly.promocja`, więc obie strony
porównania to `""`. **Kliknięcie nagłówka „Promocja" nic nie sortuje.** To samo w oryginale
(ta sama funkcja, `frontend-index.js:23307-23311`). Trafia do dokumentu jako ramka ⚠, bo Ania
kliknie w nagłówek i zgłosi to jako błąd.

## Kontrakt i fixtures (zakres) — siatka bezpieczeństwa

**Brak (nie dotyka kontraktu).** Ticket zmienia wyłącznie pliki `docs/**`; nie rusza
`rebuild/backend/**`, `rebuild/frontend/**` ani `contract/**`. GATE odbudowy nie obowiązuje.

Kontrakt jest tu **źródłem czytanym**, nie zmienianym: brzmienia UI i zachowania cytowane
w dokumencie muszą zgadzać się ze stanem kodu na `develop` po zmergowaniu PR #78 (14f).

## Decisions

Wszystkie cztery podjęte przez użytkownika w jednej rundzie Q&A (2026-09-19), zgodnie
z rekomendacjami:

- **D1 — sekcje bez zgłoszenia Ani dostają nagłówek „Tego nie zgłaszałaś:".** Trzy z sześciu
  zmian (promocja „zaplanowana", `status` niezapisywalny przez API, zniknięcie pomarańczowego
  znacznika) wykryliśmy sami. Zamiast zmyślać cytat — cytat blokowy zaczyna się od „Tego nie
  zgłaszałaś" + zdanie, skąd zmiana się wzięła i kiedy. Za: uczciwość (dokument i tak prostuje
  nieprawdziwy §4 pkt 6, więc nie może sam zmyślać), spójność wizualna z wzorcem, precedens
  w I3-v2 (sekcje 1.4–1.7 idą bez „Zgłosiłaś:"). Przeciw: łamie dosłowny zapis wzorca — przyjęte.
- **D2 — zgłoszenie do §3.6 cytowane jako parafraza, jawnie oznaczona.** W repo istnieje tylko
  streszczenie w roadmapie (`:2448-2450`), dosłownego tekstu jej komentarza nie mamy. Forma:
  „Zgłosiłaś (streszczenie z naszych notatek — dosłownego zapisu nie mamy): …". Za: zachowuje
  przyczynę zmiany, nie udaje cytatu. Przeciw: dłuższe — przyjęte.
- **D3 — oba skutki uboczne z noty cutoverowej wchodzą do dokumentu, jako rozdział z ⚠.**
  (1) pierwszy start procesu po 14f zamiata statusy promocji rozjechanych z datami — dziś
  realnie 0 zmian (`promotions` w `db/snapshot.db` pusta), jedno zdanie; (2) znalezisko 14e:
  samo `przeliczCenyZRegul`, bez żadnej promocji, zmienia **2050 z 7405** cen. Za: bez (2) Ania
  zapisze jedną regułę, zobaczy hurtową zmianę cen i zgłosi to jako katastrofę. Przeciw: temat
  techniczny — przyjęte, bo skutek jest w pełni widoczny z jej strony ekranu.
- **D4 — §5 poz. 4 (edycja priorytetu reguły z formularza) wypisana jako NADAL OTWARTA,
  z kratką do decyzji.** Jedyna pozycja §5 bez czyjejkolwiek decyzji. Dostaje pytanie
  „Czy to Ci przeszkadza? ☐ tak ☐ nie" — zgodnie z twardą zasadą „ani jednego pola bez pytania
  albo kratki".

**Korekty faktów wobec treści zlecenia** (zapisane jako fakty, zakresu nie zmieniają):
- `docs/pytania-do-ani-2026-09-18.md` **nie zawiera** trzech cytatów decyzji Ani — nie ma w nim
  w ogóle sekcji o Iteracji 4. Źródła rzeczywiste: (a) `docs/rebuild-backlog.md:1759`,
  (b) `docs/tickets/53-CHORE-i14e-diagnoza-promocji/raport.md:20`, (c) `docs/rebuild-roadmap.md:2453`.
- Cytat (c) brzmi w repo pełniej: *„zostawiamy tak jak obecnie działa, promocje po prostu
  się usuwa"* — cytujemy pełne brzmienie.

**Odstępstwa od zachowania oryginału:** żadnych nowych. Dokument OPISUJE dwa już zatwierdzone
odstępstwa dowiezione w 14f/14h (kolumna `_reguly.promocja` — backlog #22; daty kończące
promocję — backlog #19), ale sam ich nie wprowadza.

## Implementation plan

### Krok 1 — `docs/instrukcja-testow-I4-v2.md` (nowy plik)

Struktura, wzorowana 1:1 na I3-v2:

- **Nagłówek** — środowisko, data 2026-09-19, „Dla: Ania", „Zastępuje: [pierwszą wersję]
  z 2026-09-02 — w punktach opisanych niżej". Ramka STAGING. **Jawne zdanie, że to WERSJA 2
  ZAWIERAJĄCA TYLKO DELTĘ** i że I4 zostaje ważna dla wszystkiego, czego tu nie ma.
- **„Po co ta kartka"** — co zgłosiła, ile poprawiliśmy, czego świadomie nie ruszamy, jak
  wypełniać (wzór pola „Twoja ocena"), które punkty są ⭐.
- **§1 — ⚠ Zanim klikniesz cokolwiek: dwa skutki uboczne** (D3). Rozdział ostrzegawczy PRZED
  scenariuszami, bo (2) uderzy przy pierwszym zapisie reguły. Własne pole oceny („Widziałaś to?
  ☐ tak ☐ nie").
- **§2 — Katalog: kolumna „Promocja" ożyła** (14h).
  - 2.1 ⭐ Kolumna „Promocja" pokazuje rabat i nazwę promocji.
    „Zgłosiłaś:" = *„Rabaty nie działają mimo wprowadzenia promocji, nie zaczytała się ona ani
    w katalogu w kolumnie promocje…"* (14e) + *„tylko się nie wyświetlało, cena się oblicza
    prawidłowo"*. Mechanizm: pomarańczowa odznaka `-10%` + nazwa obok, „—" gdy brak.
    ⚠ Ramka A: **to NOWA FUNKCJA, nie powrót do stanu sprzed backupu** — wprost, bez owijania,
    z dowodem (żywy bundle, deminifikat, backend + wszystkie łatki, `git log -S`). Cytat jej
    założenia *„w starym Bridge działała… być może któryś backup to zastąpił"* i zdanie, że kod
    tego nie potwierdza w żadnej wersji, którą mamy.
    ⚠ Ramka B: **kolumna zaświeci dopiero po założeniu promocji** — dziś `promotions` = 0.
    ⚠ Ramka C: **kliknięcie nagłówka „Promocja" nic nie sortuje** (domiar własny, tak w oryginale).
- **§3 — Promocje: daty naprawdę rządzą** (14f, cztery sekcje).
  - 3.1 ⭐ Data końca naprawdę wyłącza promocję. „Zgłosiłaś:" = *„Tak, data końcowa powinna
    automatycznie wyłączać promocję. (…) Po wygaśnięciu system powinien przeliczyć ceny bez tej
    promocji"* + decyzja z 18.09 *„data ma naprawdę kończyć promocje"*. Mechanizm: wygaszacz
    przy starcie procesu / przy zapisie dowolnej reguły / cyklicznie co 5 min → stąd
    **opóźnienie do ~5 minut**, gdy nikt nic nie zapisuje. Test = wprost zaprzeczenie §3.9.
  - 3.2 ⭐ **Promocja „zaplanowana" wreszcie się włącza** (D1, „Tego nie zgłaszałaś"). Co było
    zepsute, **od kiedy** (od 4a, 2026-09-02 — od zawsze), co teraz działa. Najbardziej
    „niewidzialna" naprawa iteracji. Test dwustronny: data startu jutro → „zaplanowana", brak
    obniżki; data startu wczoraj → „aktywna", obniżka.
  - 3.3 **Rada „żeby wyłączyć promocję, zmień status" PRZESTAJE OBOWIĄZYWAĆ** (D1). `status`
    zniknął z pól edytowalnych przez API (8 → 7 pól); ciało z `status` nie daje błędu, jest po
    cichu odsiewane. **Czym zastąpić: datą końca albo usunięciem.**
  - 3.4 **Zniknął pomarańczowy znacznik rozbieżności + zmieniła się nota w dialogu** (D1).
    Znacznik stał się martwy — nie ma już czego sygnalizować. Nowa nota cytowana dosłownie:
    *„Daty rządzą promocją: przed datą początku jest «zaplanowana» i nie obniża cen, po dacie
    końca sama się wyłącza. Zmiana bywa widoczna z kilkuminutowym opóźnieniem."*
- **§4 — Usuwanie pyta o potwierdzenie i podaje liczbę produktów** (14f).
  - 4.1 ⭐ „Zgłosiłaś (streszczenie z naszych notatek…)" (D2). Dosłowne brzmienia obu dialogów
    i wszystkich trzech wariantów `opisLiczbyProduktow` (`null` / `0` / `N`). Dotyczy narzutów
    **i** promocji. ⚠ liczba jest liczona wiernym silnikiem, więc dla warunków
    `konstrukcja`/`średnica`/`VF-IF` mówi prawdę, a nie zero.
- **§5 — Czego świadomie NIE zmieniliśmy** (trzy decyzje Ani z 2026-09-18, cytowane dosłownie
  ze źródeł ustalonych wyżej). Jedno pole oceny na cały rozdział: „Czy któraś z tych trzech
  decyzji wygląda dziś inaczej, niż ją zapamiętałaś? ☐ nie ☐ tak — która: ___".
- **§6 — Co w starej instrukcji przestało być prawdą.** Punkt po punkcie z numerami:
  §3.6, §3.9, §4 pkt 1, §4 pkt 5, §4 pkt 8 (konsekwencja §3.6 — dopisane, bo mówi to samo co
  §3.6 i też jest nieprawdą), §4 pkt 6 (osobno, patrz niżej) oraz cały §5 — tabelą
  „pozycja → status → gdzie/kiedy":
  | poz. | status | gdzie |
  |---|---|---|
  | 1. kolumna „Promocja" | ✅ dowieziona | 14h · `61-…` · 2026-09-18 |
  | 2. wyłączanie promocji datą | ✅ dowiezione | 14f · `64-…` · 2026-09-19 |
  | 3. przełącznik statusu przy promocjach | ❌ świadomie nie — jej decyzja | 2026-09-18 |
  | 4. edycja priorytetu reguły z formularza | ⬜ **nadal otwarte** | brak decyzji (D4) |
  - **6.x osobno: §4 pkt 6 był NIEPRAWDZIWY, zanim cokolwiek zmieniliśmy.** Instrukcja mówiła,
    że promocja z datą startu w przyszłości od razu obniża ceny. Nie obniżała — i nigdy nie
    zaczynała. Ten sam defekt, który naprawiła 14f (sekcja 3.2). Napisane wprost: instrukcja
    podała błędną informację; oto jak było naprawdę, oto jak jest teraz. Pole oceny własne.
- **§7 — Podsumowanie**, tabela z ☐ OK / ☐ ŹLE na każdy punkt + licznik „Sprawdzonych __ / N".
- **§8 — Jak zgłosić znalezisko** — skrócone (pełne zasady zostają w I4 §7), z listą rzeczy,
  które wyglądają na błąd, a są poprawne (opóźnienie ~5 min, „—" przy braku promocji,
  nieklikalne sortowanie kolumny, 2050 przeliczonych cen).

**Twarda zasada w całym pliku: ani jednego pola bez pytania albo kratki.** Każda sekcja kończy
się `> **Twoja ocena:** ☐ OK ☐ ŹLE — uwagi: ___`; rozdziały nieklikalne (§1, §5, §6) dostają
własny wariant z kratką zamiast „miejsca na uwagi".

### Krok 2 — banner w `docs/instrukcja-testow-I4.md`

**Wyłącznie** blok cytatu wstawiony po ramce STAGING/ostrzeżeniu o przeliczaniu katalogu, nic
poza tym nie ruszamy. Wzór 1:1 z `docs/instrukcja-testow-I3.md:8-27`: nagłówek „⚠ CZĘŚCIOWO
NIEAKTUALNE od 2026-09-19 — najpierw przeczytaj [wersję 2]", zdanie „gdy coś różni się od tego,
co widzisz na ekranie, prawdą jest wersja 2", lista „co konkretnie przestało być prawdą"
(§3.6, §3.9, §4 pkt 1, §4 pkt 5, §4 pkt 6, §4 pkt 8, §5 poz. 1–2) i zdanie „dalej obowiązują"
(§3.1–§3.5, §3.7, §3.8, §3.10, §3.11, §4 pkt 2, 3, 4, 7, 9, 10).

### Krok 3 — `docs/rebuild-roadmap.md`

- podblok **14m** (`:2634`) → ✅ ZROBIONE, data 2026-09-19, ID `65-DOCS-instrukcja-testow-i4-v2`,
  opis zakresu **faktycznie dowiezionego** (w tym: §4 pkt 8 dołożony do listy sprostowań,
  §5 poz. 4 wyciągnięta jako otwarte pytanie do Ani, domiar sortowania kolumny);
- wiersz **Iteracja 14** w tablicy postępu §4 → 🔨 na ✅ (fala 2 domknięta, 14m zamknięte);
- wiersz **Iteracja 4** → dopisek, że domykają ją karty 14e/14f/14h + 14m z I14;
- usunąć z bloku 14m to, co karta obaliła: zdanie o `docs/pytania-do-ani-2026-09-18.md` jako
  źródle cytatów (jeśli tam jest) i wszystko, co ten ticket rozstrzygnął.

### Krok 4 — `docs/rebuild-backlog.md`

Statusy wpisów dotkniętych: **#19** (daty — zamknięte 14f, odnotować, że instrukcja sprostowana),
**#22** (kolumna — zrobione 14h, sprostowane w instrukcji), **#25** (Reguła globalna — pułapka
ZOSTAJE, teraz opisana Ani także w v2). Dopisać, gdzie Ania została o tym poinformowana.

## Testing strategy

Ticket **nie dotyka kodu** — bramek `lint/typecheck/build/test` nie uruchamiamy i nie ma czego
gate'ować (GATE odbudowy: N/D, uzasadnienie w sekcji „Kontrakt i fixtures").

Weryfikacja jest dokumentacyjna i sprowadza się do pięciu sprawdzeń:
1. **Każde brzmienie UI cytowane w v2 zgadza się ze stanem kodu na `develop`** — porównanie
   `grep`em z plikami wymienionymi w „Kontekst" (nie z raportami: raport bywa zamiarem).
2. **Każdy cytat decyzji/zgłoszenia Ani ma wskazane źródło z numerem linii** i zgadza się z nim
   co do znaku; parafraza jest jawnie oznaczona (D2).
3. **Ani jednego pola bez pytania albo kratki** — przelot `grep -n "uwagi:\|☐"` po całym pliku
   i ręczne sprawdzenie, że każda sekcja `##` ma pole oceny.
4. **Każda pozycja §5 starej instrukcji rozliczona** wobec tablicy postępu §4 roadmapy — cztery
   pozycje, cztery statusy, żadna nie zostaje bez odpowiedzi.
5. **Linki wewnętrzne działają** — kotwice do I4 i z I4 do v2 (nazwy plików, nie `#kotwice`
   po polsku, bo te bywają kruche).

## Out of scope

- **Kod produkcyjny** — `rebuild/backend/**`, `rebuild/frontend/**`, `contract/**` nietknięte.
- **Przepisywanie `docs/instrukcja-testow-I4.md`** — dostaje wyłącznie banner.
- **`docs/instrukcja-testow-I3-v2.md`** — czytany jako wzorzec, nietknięty.
- **`docs/instrukcja-testow-I5.md`** — pliku nie ma na `develop` (leży na niezmergowanej gałęzi
  `origin/docs/instrukcja-testow-i5`); nie zakładamy go, to osobny temat.
- **Rozstrzyganie §5 poz. 4** (priorytet reguły) — dokument zadaje pytanie, decyzji nie podejmuje.
- **Backlog #88** (`promocjaPasuje` a produkt z pustą marką I kategorią) — ⬜ do decyzji, zero
  produktów w bazie, nie wchodzi do instrukcji dla Ani.

## Definition of done

- [ ] `docs/instrukcja-testow-I4-v2.md` istnieje, trzyma konwencję I3-v2 i ma w nagłówku wprost
      napisane, że to WERSJA 2 zawierająca TYLKO DELTĘ
- [ ] Sześć zmian opisanych (1 × 14h + 5 × 14f), każda z CO / DLACZEGO (z datą i źródłem) / JAK
      TO DZIAŁA (klikalnie)
- [ ] Kolumna „Promocja" opisana wprost jako **nowa funkcja, nie powrót do stanu sprzed backupu**
- [ ] Promocja „zaplanowana" ma osobną sekcję: co było zepsute, od kiedy, co teraz działa
- [ ] Rada „zmień status, żeby wyłączyć promocję" unieważniona, z podanym zamiennikiem
- [ ] Rozdział „czego świadomie nie zmieniliśmy" z trzema decyzjami Ani cytowanymi dosłownie
- [ ] Rozdział „co przestało być prawdą" z numerami punktów starej instrukcji i tabelą rozliczenia
      wszystkich czterech pozycji §5
- [ ] §4 pkt 6 opisany uczciwie jako nieprawdziwy JESZCZE PRZED zmianami
- [ ] **Każda** sekcja kończy się polem „Twoja ocena" z kratkami; zero pól typu „miejsce na uwagi"
- [ ] `docs/instrukcja-testow-I4.md` ma banner i **nic poza tym** nie zmienione (`git diff` = 1 blok)
- [ ] Roadmapa: 14m ✅ z datą i ID, wiersz Iteracji 14 ✅, wiersz Iteracji 4 domknięty
- [ ] Backlog: statusy #19/#22/#25 aktualne
