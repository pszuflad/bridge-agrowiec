# {{NAZWA PROJEKTU}} — zasady stałe dla każdej sesji

{{2-3 zdania: czym jest projekt, jaki stack, jakie są źródła prawdy.}}

Proces pracy nad zadaniami: `.claude/commands/feature.md` (skill `/feature`).

## Przed każdym PR — synchronizacja z `{{BAZA}}` (dotyczy KAŻDEJ sesji)

Kilka zadań idzie równolegle, więc `{{BAZA}}` przesuwa się w trakcie roboty. **Gałąź musi zawierać
całe `origin/{{BAZA}}`, zanim ją wypchniesz i otworzysz PR.** Użytkownik ma dostać PR gotowy do
merge'a — rozwiązywanie konfliktów w GitHubie nie jest jego robotą.

```bash
tools/sync-z-bazy.sh {{BAZA}}    # merge (nie rebase); kody: 0 aktualna · 10 weszły zmiany · 2 konflikty · 1 warunek wstępny · 3 auth
```

- **Konflikty rozwiązuje sesja, która je wywołała** — łącz OBIE strony, nie „wygrywaj" plikiem.
  Konflikt merytoryczny, którego nie umiesz rozstrzygnąć → **STOP i pytanie do użytkownika**.
- **Po scaleniu bramki lecą od nowa:** `tools/bramki.sh`. Czerwone po merge'u = naprawa **przed** pushem.
- PR-y idą **do `{{BAZA}}`**, baza podawana jawnie (`--base {{BAZA}}`).
- Push i PR jednym poleceniem: `tools/push-i-pr.sh --tytul "<ID>: tytuł" --tresc-plik docs/tickets/<ID>/pr-body.md`.
- Sprawdzając scalalność czytaj OBA pola: `mergeable` (brak konfliktów) i `mergeStateStatus`
  (`BLOCKED` = sprawdzenia jeszcze lecą / nie przeszły). `MERGEABLE` samo nie znaczy „gotowe".

**Gdy push/PR się blokuje — najpierw rozpoznaj blokadę.** Ponawiać ma sens tylko:
- blokadę `.git` od równoległego zadania (`index.lock`, `cannot lock ref`) — mija samo; plik starszy
  niż 10 min to pozostałość po zabitym procesie, usuwa go użytkownik, nie sesja,
- limit/awarię GitHuba (429/5xx).

`[rejected] (non-fast-forward)` to nieaktualna gałąź (sync i push). **Uwierzytelnienie** — nie
zapętlaj się, zgłoś użytkownikowi.

**Egzekwowane mechanicznie (trzy poziomy):**
1. hook `pre-push` (`.githooks/pre-push`) — odbija gałąź bez całego `origin/{{BAZA}}`; na nowym
   klonie raz: `tools/wlacz-hooki.sh`; obejście: `POMIN_SYNC=1 git push`;
2. ruleset/branch protection na `{{BAZA}}` + joby CI (`synchronizacja`, `bramki`) — realny zamek;
3. skrypty `tools/sync-z-bazy.sh` i `tools/push-i-pr.sh`.

## Własność plików współdzielonych (równoległe zadania)

Oś podziału = **PLIK**. Każda linia, którą edytują dwa zadania, kończy się konfliktem, więc:
- **Nie dopisuj akapitów na końcu wspólnych dokumentów** ({{roadmapa, spec, backlog…}}). Nowe
  ustalenie idzie do NOWEGO pliku `docs/wpisy/<kategoria>/wpis-<numer ticketu>.md`.
- Wolno poprawić w miejscu zdanie, które ticket obalił.
- Fałsz w cudzym pliku → zapisz go w `raport.md` w sekcji „Do koordynatora".
- Szczegóły i szablon wpisu: `docs/wpisy/README.md`.

## Środowisko

- {{wymagana wersja runtime, np. Node ≥ 20}}
- Bramki: `tools/bramki.sh` ({{lint, typecheck, build, testy}}).
- Nowy klon repo — raz: `tools/wlacz-hooki.sh` (ustawia `core.hooksPath=.githooks`).
- **Sesja w przeglądarce (`claude.ai/code`) nie ma `gh`.** `tools/push-i-pr.sh` nie zadziała;
  sync i `git push` działają, PR i odczyt scalalności — narzędziami MCP GitHub. `403` przy pushu =
  zwykle brak zainstalowanej aplikacji Claude GitHub App na repo (https://github.com/apps/claude/installations/select_target).
  Stan PR-a przez MCP to `mergeable_state` (`blocked`/`clean`/`dirty`); `blocked` zaraz po
  utworzeniu PR-a jest normalne (sprawdzenia lecą).
- Zakładaj, że projekt może być uruchomiony i że równolegle pracuje ktoś inny — testy używają
  bazy w katalogu tymczasowym i portów efemerycznych.
- Testy NIGDY nie wołają prawdziwych usług zewnętrznych; klient stoi za interfejsem i jest wstrzykiwany.

## Pułapki tego projektu (dopisuj, gdy odkryjesz)

{{Każda pułapka: objaw → przyczyna → dowód (plik:linia / pomiar) → co robić. Przykład formy:
„`safeAll()` zamienia błąd SQL w pustą listę — nie ufaj `rows: []`, sprawdź dane w bazie."}}
