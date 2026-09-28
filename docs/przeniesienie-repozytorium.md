# Przeniesienie repozytorium na konto Ani — plan

**Cel (decyzja użytkownika 2026-09-28):** właścicielem `bridge-agrowiec` zostaje Ania
(`Devilian07`), razem z kosztem planu GitHub. Historia, gałęzie, tagi, issues i PR-y mają
przejść 1:1.

⚠ **Nie wykonujemy tego w trakcie cutoveru.** Transfer zabiera na jakiś czas działający CD
(sekrety nie przechodzą), a właśnie na nim stoi wdrażanie produkcji. Termin: gdy produkcja
pochodzi stabilnie kilka dni. Kolejność całości — rozdział „Kiedy" na końcu.

---

## 1. Narzędzie

GitHub ma wbudowany transfer — nic nie klonujemy ręcznie, nic nie ginie.

```
https://github.com/pszuflad/bridge-agrowiec/settings
```
→ **Danger Zone** → **Transfer ownership** → konto odbiorcy `Devilian07` + nazwa repo dla
potwierdzenia. Ania dostaje zaproszenie i **musi je zaakceptować**.

**Warunki wstępne:** przenoszący ma `admin` (Paweł ma), odbiorca ma konto (ma), i **nie ma
u siebie repozytorium o tej samej nazwie**.

## 2. Co przechodzi automatycznie

- cała **historia**, wszystkie gałęzie i tagi (w tym `lustro-produkcji-2026-09-28`)
- issues, pull requesty z komentarzami i recenzjami, releases, wiki
- gwiazdki i obserwujący
- **przekierowania starych adresów** — `github.com/pszuflad/bridge-agrowiec` oraz
  `git@github.com:pszuflad/…` dalej działają i prowadzą do nowej lokalizacji. Klony na VPS-ie
  nie padną w chwili transferu; adresy poprawiamy spokojnie (krok 5).

## 3. Co trzeba odtworzyć ręcznie — lista kontrolna

Stan zinwentaryzowany 2026-09-28.

| # | Rzecz | Stan przed transferem | Po transferze |
|---|---|---|---|
| 3.1 | **Sekrety Actions** | 10: `PROD_SSH_{HOST,KEY,KNOWN_HOSTS,PORT,USER}`, `STAGING_SSH_{HOST,KEY,KNOWN_HOSTS,PORT,USER}` | ⬜ **nie przechodzą** — Ania wprowadza od nowa |
| 3.2 | **Środowisko `produkcja`** | istnieje, required reviewers | ⬜ do ustawienia od nowa; działa tylko przy odpowiednim planie |
| 3.3 | **Ruleset na `develop`** | id `21299243`, aktywny, wymaga PR + `backend`/`frontend`/`synchronizacja` | ⬜ jw. — zależy od planu **Ani**, nie Pawła |
| 3.4 | **Aplikacja Claude GitHub App** | zainstalowana na koncie `pszuflad` | ⬜ instalacje są **per-konto** — Ania instaluje u siebie i nadaje dostęp do repo; bez tego jej sesje w `claude.ai/code` wracają do **403 przy pushu** |
| 3.5 | **Klucz deploy** | `bridge-vps-syncer`, prawo zapisu | ⬜ powinien przejść — **zweryfikuj**, bo z niego korzystają klony na VPS |
| 3.6 | **Uprawnienia Pawła** | właściciel | ⬜ Ania musi nadać `admin`, inaczej nie ruszysz ustawień, sekretów ani rulesetów |

### ⚠ 3.1 — nie przekazujcie kluczy prywatnych z rąk do rąk

Wartości `PROD_SSH_KEY` i `STAGING_SSH_KEY` to klucze prywatne. Zamiast je kopiować i przesyłać,
**wygenerujcie przy okazji nowe pary** i podmieńcie wpisy w `~/.ssh/authorized_keys` na VPS-ie:

```bash
# na VPS, dla każdego z dwóch deployów
ssh-keygen -t ed25519 -N '' -C 'deploy-<produkcja|staging>-bridge' -f ~/.ssh/deploy_<nazwa>_ed25519_v2
```

Stary wpis w `authorized_keys` kasujecie, nowy dopisujecie z tym samym `command="…"`. Klucz
prywatny zna wtedy wyłącznie Ania, a stary przestaje cokolwiek otwierać. Wzór linii i procedura
weryfikacji: `docs/wdrozenie-produkcji.md`, rozdział „Grupa C".

## 4. Konsekwencje, które trzeba przyjąć świadomie

**Prywatność i bramki zależą od planu ANI.** Jeśli repo ma być prywatne z rulesetami
i zatwierdzaniem wdrożeń, **ona** potrzebuje GitHub Pro. Plan jest per-konto i obejmuje wszystkie
prywatne repozytoria tego konta; współpracownicy nie płacą nic. Przy planie darmowym i repo
prywatnym tracicie trzy rzeczy:

1. ruleset na `develop` (**zmierzone na tym repo 2026-09-23: HTTP 403**,
   `docs/tickets/134-CHORE-praca-w-chmurze/plan.md:5-6`) — czyli PR i zielone CI przestają być
   wymagane, a stają się dobrą praktyką;
2. required reviewers na środowisku `produkcja` — każdy merge do `main` wdraża się natychmiast;
3. nielimitowane minuty Actions (prywatne na Free: 2000/mies.; przy naszej skali bez znaczenia).

**Paweł przestaje być właścicielem.** Do dalszej pracy potrzebuje `admin` nadanego przez Anię —
punkt 3.6. Warto zrobić to od razu po akceptacji transferu, a nie „przy okazji".

**Będzie okno bez CD.** Od transferu do wprowadzenia sekretów workflow-y padają na SSH.
Nieszkodliwe (nic się nie wdraża, nic się nie psuje), ale zaplanujcie to na spokojny dzień.

## 5. Po transferze — poprawki w repo i na serwerze

Odwołania do `pszuflad/…` zaszyte w plikach (stan 2026-09-28):

| Plik | Co |
|---|---|
| `tools/przygotuj-produkcje.sh` | `REPO_URL` — adres klonu produkcji |
| `tools/vps-sync.sh:120` | link do commita w mailu syncera (skrypt i tak wygaszony) |
| `docs/` (6 plików) | odsyłacze w dokumentacji — kosmetyka |

Na VPS-ie adresy zdalne w trzech klonach (`bridge-staging/repo`, `bridge-prod/repo`,
`bridge-sync` jeśli zostaje):

```bash
git -C ~/private_apps/bridge-staging/repo remote set-url origin git@github.com:Devilian07/bridge-agrowiec.git
git -C ~/private_apps/bridge-prod/repo    remote set-url origin git@github.com:Devilian07/bridge-agrowiec.git
```

Przekierowania GitHuba działają, więc to nie jest pilne — ale zostawianie starych adresów
maskuje problem do dnia, w którym przekierowanie zniknie.

## 6. Weryfikacja po transferze

- [ ] `git push` z VPS-a przechodzi (klucz deploy działa)
- [ ] workflow „Deploy staging" przechodzi po merge'u do `develop`
- [ ] workflow „Deploy produkcja" przechodzi po merge'u do `main` i **zatrzymuje się** na
      zatwierdzeniu środowiska (jeśli reguła jest ustawiona)
- [ ] sesja Ani w `claude.ai/code` robi `git push` bez 403 i tworzy PR narzędziami MCP
- [ ] ruleset na `develop` odbija push bezpośredni (jeśli plan pozwala go założyć)
- [ ] Paweł ma `admin` i widzi `Settings`

## 7. Kiedy — kolejność

1. **cutover dokończony**, produkcja chodzi stabilnie kilka dni
2. **Ania bierze GitHub Pro** (jeśli repo ma być prywatne z bramkami)
3. **transfer** + odtworzenie punktów 3.1–3.6, z **nowymi** kluczami SSH
4. **zmiana widoczności na prywatną**
5. **poprawki zaszytych odwołań** (rozdział 5)

⚠ Punkt 4 dopiero po 2 i 3 — zmiana widoczności przy planie darmowym zdejmuje bramki od razu,
a wtedy przez chwilę nie ma ani rulesetu, ani zatwierdzania wdrożeń.

## 8. Czego ten dokument nie rozstrzyga

- **Czy czyścić historię.** Publiczne repo zawiera dziś ceny zakupu:
  `mirror/frontend/ex-port-files/sellycsv-*.csv` (5340 wierszy, kolumna `Cena-zakupu`,
  82 commity historii), 10 fixtures z `cena_zakupu` i arkusze w `knowledge/`. Zmiana widoczności
  działa naprzód — historia zostaje, a to, co już skopiowano, zostaje skopiowane. Decyzja
  o przepisaniu historii (`git filter-repo`) to osobny temat: unieważnia wszystkie klony
  i gałęzie. Sekretów w repo **nie ma** — `.env` nigdy nie był commitowany.
- **Co zrobić z tokenem w adresie feedu** `sellycsv-vDsrvHnz7jmyqlvtubo4g3JA.csv` — jest
  w repo i w dokumentacji; chroni go biała lista IP, ale sam token jest publiczny.
