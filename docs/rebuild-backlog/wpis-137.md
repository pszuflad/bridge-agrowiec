# Backlog — wpisy ticketu 137 (`137-DOCS-wpisy-mirror-i-poprawki-marty`) · 2026-09-23

To NIE jest triaż produkcji. Oba wpisy to ustalenia z ticketu **130** (karta I15.4b), które
po zamknięciu tamtej karty zostały **bez domu**: siedziały wyłącznie w sekcji „Do koordynatora"
zamkniętego `docs/karty/I15.4b/karta.md`, czyli w miejscu, do którego zagląda się tylko celowo.
Backlog jest przeglądany rutynowo — stąd ten ticket.

---

### #137.1 · 2026-09-23 · [BACKEND] · `mirror/backend/index.cjs` w repo jest starszy niż reszta mirrora

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-23 (wykryte w tickecie 130) |
| **Kategoria** | BACKEND — wierność kopii produkcji, nie kod odbudowy |
| **Pliki** | `mirror/backend/index.cjs` |
| **Commit** | plik stoi na `86d9090`; reszta mirrora stagingu na `88fa31c` |
| **Do nowej wersji?** | ⬜ **do decyzji** |
| **Status** | — |

**Opis biznesowy.** `mirror/` ma być wierną kopią tego, co działa na produkcji. Dziś nie jest
spójny sam ze sobą: `staging_policy.cjs` i `bridge_ext.cjs` są na `88fa31c`, a `index.cjs` został
na `86d9090`. Resync z ticketu 120 (I15.2) objął wybrane pliki parserów i polityki, ale nie bundel.

**Szczegół techniczny (dla rebuildu).** Najważniejsza różnica: wersja z `88fa31c` zawiera linię

```js
tk = require("./staging_policy.cjs").install({U, db:Qi, normalize:Hq, classify:Zc,
                                              badName:Kq, ext:__BRIDGE_EXT});
```

której wersja `86d9090` **nie ma**. To ona czyni `tk = function` z bundla martwym — czyli jest
dowodem na to, że silnik importu to dziś `install()`, a nie funkcja z bundla (patrz
`docs/spec-backend/wpis-130.md`, punkt A).

Ticket 130 sprawdził bajtowo, że **blok helperów** wycinany przez charakteryzację
(`function mm` … `function tk`, 11 598 znaków) jest między `86d9090` a `88fa31c` IDENTYCZNY,
więc wycięcie oryginału do wzorców jest wiarygodne i nieaktualność pliku **nie zafałszowała**
gate'ów tamtego ticketa. Ryzyko jest na przyszłość: kolejna karta może wyciąć z tego pliku
fragment, który już się rozjechał, i nie zorientować się.

**Rekomendacja (moja).** ✅ **dosynchronizować** `mirror/backend/index.cjs` do `88fa31c` —
osobnym ticketem CHORE albo przy najbliższym triażu, razem z kontrolą, czy inne pliki `mirror/`
nie zostały w tyle po selektywnych resyncach. Tanie i zdejmuje pułapkę: plik, który wygląda
na źródło prawdy, a nim nie jest. Wzorzec kontroli jest już w repo — gate sha256 w
`test/charakteryzacja.test.ts` porównuje `legacy/**` z `mirror/**`; warto rozważyć analogiczne
sprawdzenie dla samego mirrora względem `origin/main`.

---

### #137.2 · 2026-09-23 · [BACKEND] · poprawki Marty nakładane CICHO — import nie zgłasza już sprzecznego pliku

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-22 (Staging v2, `staging_policy.cjs`); wykryte przy porcie w tickecie 130 |
| **Kategoria** | BACKEND — zmiana widoczna dla użytkownika panelu |
| **Pliki** | `staging_policy.cjs:158-162` (`protect`); w odbudowie `src/import/polityka/kontekst.ts` (`chron`) |
| **Commit** | `3f00533` (Staging v2) |
| **Do nowej wersji?** | ⬜ **do decyzji Ani** — zachowanie JEST już odtworzone 1:1; pytanie brzmi, czy produkcja ma tak zostać |
| **Status** | ⚠ odtworzone wiernie w I15.4b (ticket 130); **decyzja merytoryczna otwarta** |

**Opis biznesowy.** Ręczna poprawka Marty nadal **wygrywa** z plikiem dostawcy — ta reguła się
nie zmieniła. Zmieniło się to, że gdy plik przynosi wartość sprzeczną z jej decyzją, **nikt się
o tym nie dowiaduje**. Stary silnik wystawiał wtedy zgłoszenie `blad` z ostrzeżeniem
„plik nadpisuje poprawke Marty: <pole>" i **blokował auto-zatwierdzenie** całej pozycji — nawet
jeśli jedyną realną zmianą była cena. Po Staging v2 pozycja wygląda na niezmienioną, cena wchodzi
bez pytania, a sprzeczność z plikiem przepada bez śladu.

**Szczegół techniczny (dla rebuildu).** `protect()` to trzy linijki: kopia snapshotu, pętla
`d[o.fieldName] = o.overrideValue` po `getOverridesFor(dostawca, kod)`, zwrot. Nie ma tu
`naruszono`, nie ma `_srcConflict`, nie ma nic, co trafiłoby do `ostrzezenie` albo `powod`.
Stary odpowiednik (`Gq()`, `deminified/backend-index.cjs:47319-47348`) raportował konflikt
i wypełniał `snapshotJson._srcConflict`, a `tk()` używał tego do wymuszenia `typZmiany: 'blad'`.

Skutek uboczny, który łatwo przeoczyć: po nałożeniu poprawki pozycja jest IDENTYCZNA z kartą
katalogową, więc silnik liczy ją jako „bez zmian" — nie powstaje żadne zgłoszenie. Pokryte
testami w `test/silnik.decyzje.test.ts`, sekcja 3 („plik przynosi inny model → wygrywa Marta,
ale konflikt NIE jest już zgłaszany", „naruszenie poprawki NIE blokuje już auto-zatwierdzenia").

**Rekomendacja (moja).** 🕒 **zapytać Anię, nie naprawiać z własnej inicjatywy.** To jest
zachowanie PRODUKCJI po Staging v2 i odbudowa odtwarza je wiernie — cofnięcie byłoby
odstępstwem, nie naprawą. Ale jest to realna utrata sygnału dla Marty: dostawca może tygodniami
przysyłać inny model czy inną kategorię i nikt tego nie zobaczy, bo poprawka po cichu wygrywa
przy każdym imporcie. Warianty do przedstawienia Ani:

- **(a) zostaw jak jest** — zgodnie z produkcją, zero pracy, sygnał nie wraca;
- **(b) przywróć sam meldunek, bez blokady** — ostrzeżenie w zgłoszeniu („plik chciał X"),
  ale cena nadal wchodzi automatycznie; kompromis między ciszą a dawnym zachowaniem;
- **(c) przywróć meldunek i blokadę** — powrót do zachowania sprzed Staging v2; najgłośniejszy,
  ale wraca też dawny koszt: każda taka pozycja wymaga kliknięcia człowieka.

Powiązania: `docs/spec-backend/wpis-130.md` punkt J (opis zachowania),
`docs/karty/I15.4b/karta.md` → „Do koordynatora" punkt 2, `#103` (Staging v2 / „Braki w cenniku").
