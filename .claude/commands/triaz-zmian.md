Przetwórz nowe zmiany produkcji (commity `sync(vps)` od Ani) w kontrolowany,
wsadowy sposób: opisz je, oceń, dopisz do backlogu, zaproponuj aktualizacje docs.
NIE podejmuj decyzji „do nowej wersji?" — to decyzja użytkownika.

Wykonaj dokładnie:

## 1. Pobierz i ustal zakres
- `cd ~/apinfo/projects/bridge && git pull --rebase --autostash`
- Odczytaj `docs/triage-state.txt` — zawiera SHA ostatnio przetworzonego commita.
- Znajdź NOWE commity producenta:
  `git log <SHA_z_markera>..HEAD --format='%H|%s' | grep 'sync(vps)'`
- Jeśli brak nowych — powiedz to userowi i zakończ (nie rób pustych commitów).

## 2. Dla KAŻDEGO nowego commita `sync(vps)`
a. Odczytaj zmianę (bez zbędnych bajtów):
   - `git show <sha> --stat`
   - diff czytelnych plików: `git diff <sha>^ <sha> -- mirror/backend deminified db/schema.sql ':(exclude)*.bak_*' ':(exclude)mirror/backend/index.cjs' ':(exclude)*/CHANGELOG.md'`
   - wpis changelog Ani jest w treści commita (`git show <sha> -s`) — użyj go jako „dlaczego".
b. Zaklasyfikuj:
   - **kod / schemat / parser** → wpis do backlogu (krok 3),
   - **tylko dane** (np. regeneracja `sellycsv-*.csv`, odświeżenie eksportu) → dopisz jedną linijkę do sekcji „Pominięte" w backlogu, bez pełnego wpisu.

## 3. Wpis do `docs/rebuild-backlog.md` (dla zmian kodu/schematu)
Dopisz kolejny numerowany wpis `#N` w formacie jak istniejące (#1, #2):
- nagłówek: `### #N · DATA · [KATEGORIE] · etykieta`
- tabela: Data, Kategoria, Pliki (+ nazwy `.bak`), Commit (skrót), „Do nowej wersji?" = **⬜ do decyzji**, Status = —
- **Opis biznesowy** — językiem biznesowym, co realnie się zmieniło i po co (z diffa + wpisu Ani, NIE z pamięci).
- **Szczegół techniczny (dla rebuildu)** — nazwy funkcji/plików, gdzie i jak.
- **Rekomendacja (moja)** — ✅ nanieść / ❌ pominąć / 🕒 później, z krótkim uzasadnieniem. Zwróć uwagę na **wzorce** (np. normalizacja w `adapter.recordToSurowe()`) i powiązania z wcześniejszymi wpisami.

## 4. Oceń, czy zmiana wymaga aktualizacji dokumentacji
- `docs/prompts/mapa-kodu-do-wiki.md` — jeśli doszła nowa funkcja/lokalizacja (np. nowa funkcja w common/adapter, nowy endpoint, nowy plik). Dopisz do właściwej sekcji.
- `docs/spec-backend.md` / `docs/spec-frontend.md` — jeśli zmienił się endpoint, zachowanie, schemat lub kontrakt. Odnotuj (i ewentualnie do `contract/openapi.yaml`, jeśli nowy/zmieniony endpoint).
- Jeśli nic z powyższych — pomiń, ale zaznacz to w podsumowaniu.

## 5. Zapisz stan i commituj
- Zaktualizuj `docs/triage-state.txt` na SHA NAJNOWSZEGO przetworzonego commita (pełny SHA + linia komentarza z datą/etykietą).
- `git add docs/ contract/ 2>/dev/null; git commit -m "triaż: N nowych zmian → backlog (<etykiety>)"`
- **NIE pushuj automatycznie.** Push zostaw userowi (chyba że wprost poprosi).

## 6. Podsumuj userowi (zwięźle)
- ile commitów przetworzono, ile trafiło do backlogu, ile pominięto (dane),
- lista nowych wpisów backlogu z jednozdaniowym opisem + Twoją rekomendacją,
- które dokumenty zaktualizowałeś,
- **co wymaga jego decyzji** („do nowej wersji?" dla nowych wpisów),
- przypomnij: `git push` gdy zechce wypchnąć.

## Zasady
- Kolumna „Do nowej wersji?" ZAWSZE ⬜ — decyzja usera, nie Twoja.
- Oszczędność kredytów: przetwarzaj wszystkie nowe naraz, jeden przebieg. Nie analizuj `.bak` ani surowego `index.cjs`.
- Zero zmyślania — opis wyłącznie z realnego diffa + wpisu Ani. Czego nie wiadomo → „NIEZNANE".
