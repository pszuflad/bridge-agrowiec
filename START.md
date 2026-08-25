# Bridge — bootstrap projektu od zera (runbook)

Procedura pierwszego uruchomienia: z pustego katalogu `bridge/` do repozytorium
Git, które jest wiernym lustrem produkcji i od tego momentu śledzi każdą zmianę Ani.

**Założenia:** pusty katalog `bridge/`, dostęp do Perplexity przez przeglądarkę,
dostęp SSH do VPS `admin@vpshd1242.cyber-folks.pl` (port 222).

**Legenda właściciela kroku:**
🤖 robi Claude (lokalnie) · 🧑 robisz Ty (terminal/SSH) · 🌐 robisz Ty (przeglądarka)

Zakładana ścieżka repo: `~/apinfo/projects/bridge` — podmień, jeśli inna.

---

## Krok 0 — 🧑 Czysty katalog

Jeśli w katalogu jest jeszcze stary materiał z 22 lipca, **nie kasuj go w ciemno** —
zawiera naszą pracę (audyt, plan, prompty, skrypt). Odłóż całość na bok:

```bash
cd ~/apinfo/projects
mv bridge bridge_stare_2026-07-22      # archiwum, użyjemy z niego 6 plików
mkdir bridge
cd bridge
```

Jeśli katalog jest faktycznie pusty — po prostu:

```bash
cd ~/apinfo/projects/bridge
```

---

## Krok 1 — 🤖 Szkielet repozytorium

Powiedz mi „rób krok 1", a utworzę strukturę i pliki startowe:

```
bridge/
├── mirror/{backend,frontend}/   ← lustro produkcji (auto)
├── knowledge/                    ← eksport wiedzy Perplexity
├── db/                           ← schemat + snapshot bazy
├── docs/                         ← nasza praca (audyt, plan, kontrakt, prompty)
├── tools/{acquire.sh,sync.sh}    ← skrypty pobierania i synchronizacji
├── rebuild/                      ← nowe źródła (w kroku 1 puste; dziś backend/, frontend/, schema/)
├── .gitignore
└── START.md                      ← ten plik
```

Przy okazji przeniosę z `bridge_stare_2026-07-22/` sześć plików naszej pracy do
`docs/`: `README.md`→`docs/audit-2026-07-22.md`, `PLAN.md`, `PROMPT-*.md`,
`audyt-vps.sh`. **Nie przenoszę** `backend/`, `frontend/`, `knowledge/`,
`data_snapshot.db` — te pobierzemy świeże (są z 22 lipca).

**Na koniec kroku — `git init` i pierwszy commit** (🧑). Repo powstaje **teraz**,
zanim cokolwiek pobierzemy z serwera. Dzięki temu nasza praca jest zabezpieczona,
a pobranie w Kroku 2 będzie sprawdzalne (`git status` pokaże, co dokładnie
produkcja dołożyła).

```bash
cd ~/apinfo/projects/bridge
git init
git add .
git commit -m "Scaffold + nasza praca (tooling, docs, plan)"
```

`.gitignore` trzyma poza repo `db/snapshot.db` (za duży), `.env`, `node_modules/`,
logi. Wersjonowane: bundle w `mirror/`, `db/schema.sql`, wiki, nasza praca.

---

## Krok 2 — 🧑 Pobranie kodu i bazy z VPS

Skrypt `tools/acquire.sh` (utworzony w kroku 1) robi to jednym poleceniem:

```bash
cd ~/apinfo/projects/bridge
bash tools/acquire.sh
```

Co robi, w kolejności:
1. **`VACUUM INTO`** na serwerze → spójny snapshot bazy ~25 MB (nie rozdęty 209 MB).
2. `scp` snapshotu → `db/snapshot.db`.
3. `sqlite3 .schema` → `db/schema.sql` (tekstowy, wersjonowany).
4. `rsync` backendu → `mirror/backend/` (bez `node_modules`, bez `.env`, bez logów).
5. `rsync` frontendu → `mirror/frontend/` (**z łańcuchem `.bak`** = historia zmian).

Sekrety (`.env`) **celowo zostają tylko na serwerze** — skrypt ich nie ściąga.

> Jeśli `acquire.sh` zgłosi problem ze ścieżką, sprawdź na serwerze, gdzie jest
> backend: `ssh -p 222 admin@vpshd1242.cyber-folks.pl "ls -d /home/admin/private_apps/bridge"`.

Weryfikacja po pobraniu:

```bash
ls -la mirror/backend/index.cjs db/snapshot.db db/schema.sql
du -sh mirror/                      # powinno być kilkanaście MB
```

---

## Krok 3 — 🌐 Eksport wiedzy z Perplexity (przez przeglądarkę)

Wiki i Space też są z 22 lipca — potrzebny świeży eksport. Przez przeglądarkę
robimy to tak, że **prosimy agenta w Space, żeby spakował aktualną wiedzę do
pliku do pobrania.**

1. Otwórz Space **„Budowanie mostu dla Agrowca"** w perplexity.ai.
2. Wklej prompt (utworzę go w `docs/prompts/eksport-wiedzy.md` w kroku 1 — poproś
   „napisz prompt eksportu wiedzy"). W skrócie prosi o ZIP zawierający:
   - całą wiki (`projects/`, `learnings/`, `index.md`, `log.md`),
   - bieżący **changelog zmian Ani**,
   - listę i eksport plików ze Space,
   - transkrypty sesji dotyczących Bridge.
3. Pobierz wygenerowany ZIP przez przeglądarkę (przycisk pobierania przy
   odpowiedzi).
4. Rozpakuj do `knowledge/`:

```bash
cd ~/apinfo/projects/bridge
unzip -o ~/Pobrane/*wiedza*.zip -d knowledge/
ls knowledge/
```

> Jeśli agent nie potrafi spakować wszystkiego naraz — pobierz partiami
> (osobno wiki, osobno changelog) i wrzuć do `knowledge/`. Grunt, żeby był to
> stan **bieżący**, nie kopia z 22 lipca.

---

## Krok 4 — 🌐 Włączenie ciągłego changelogu Ani

Żeby od teraz każda zmiana była zapisywana u źródła:

1. W tym samym Space wklej prompt konfiguracyjny changelogu (utworzę go w
   `docs/prompts/changelog-config.md` — poproś „napisz prompt konfiguracji
   changelogu"). Ustawia zasadę: każda zmiana we froncie / backendzie / schemacie
   bazy → wpis do `CHANGELOG.md` na serwerze (data, obszar, plik, opis, powód).
2. Od tej chwili `CHANGELOG.md` z serwera będzie się pobierał razem z resztą
   przez `sync.sh` (krok 6).

---

## Krok 5 — 🧑 Baseline: oznaczony commit = stan produkcji

Repo już istnieje (od Kroku 1). Teraz — gdy `mirror/` i `db/schema.sql` są
wypełnione świeżym stanem z VPS oraz `knowledge/` z Perplexity — robimy **drugi,
oznaczony commit**: punkt odniesienia dla całej odbudowy.

```bash
cd ~/apinfo/projects/bridge
git add .
git commit -m "Baseline: stan produkcji i wiedzy na $(date +%F)"
git tag baseline-$(date +%Y%m%d)      # łatwy powrót do punktu zerowego
```

Model commitów:

```
commit 1  "scaffold + nasza praca"      (Krok 1)
commit 2  "baseline: stan produkcji"    ← tu, tag baseline-YYYYMMDD
commit 3+ "sync: ..."                    każdy = delta = zmiany Ani
```

Od tego commita **każdy kolejny diff to zmiana Ani** — widoczna nawet
w zminifikowanym bundlu przez `git show --stat`.

---

## Krok 6 — 🧑 Włączenie synchronizacji

`tools/sync.sh` = `acquire.sh` + auto-commit różnicy:

```bash
bash tools/sync.sh            # pobiera świeży stan i commituje, jeśli coś się zmieniło
```

Uruchamiaj przed każdą sesją pracy, a docelowo z crona (np. co godzinę):

```bash
crontab -e
# dopisz:
0 * * * * cd ~/apinfo/projects/bridge && bash tools/sync.sh >> tools/sync.log 2>&1
```

Podgląd, co Ania zmieniła od ostatniego razu:

```bash
git log --oneline -10
git show --stat HEAD           # które pliki bundla się ruszyły
```

---

## Krok 7 — 🤖 Ponowny audyt: delta względem 22 lipca

Gdy baseline jest w repo, powiedz „zrób re-audyt". Przepuszczę świeży stan przez
te same sprawdzenia co poprzednio i wpiszę **różnice** do `docs/audit-delta.md`:
- schemat bazy (czy nadal 26 tabel / 71 kolumn `products`),
- nowe endpointy (warianty bundla `RULESYNC`/`PROMOCOL`/`ROUTE` z lipca sugerują nowe trasy),
- nowe kopie `.bak` = nowe zmiany do udokumentowania,
- przyrost dryfu schematu.

Stary audyt zostaje jako punkt odniesienia — „co się zmieniło" bywa cenniejsze
niż sam stan bieżący.

---

## Po bootstrapie

Masz wtedy: repo Git będące żywym lustrem produkcji, świeżą wiedzę, baseline
i działającą synchronizację. To domyka **Fazę 1** z [PLAN.md](PLAN.md). Dalej:
zamrożenie kontraktu API (Faza 2) i odbudowa (Fazy 3–4).

**Stan odbudowy: Iteracja 1 zamknięta** — `rebuild/backend/` (API + logowanie, sesja 1a),
`rebuild/frontend/` (rama panelu, `/login`, 12 tras routera — sesja 1b) i `rebuild/schema/`.
Podział na iteracje: `docs/rebuild-roadmap.md`; deploy stagingu: `docs/deploy-setup.md`.
Uruchomienie lokalne (Node 20; dev frontendu proxuje `/api` na backend, więc backend musi
działać osobno — szczegóły w README obu pakietów):

```bash
cd rebuild/backend  && npm ci && npm run dev    # terminal 1 → 127.0.0.1:5001 (wymaga .env z JWT_SECRET)
cd rebuild/frontend && npm ci && npm run dev    # terminal 2 → http://localhost:5173
```

Niezależnie, natychmiast (produkcja cierpi): feed MO3 nie działa od 2026-07-06,
alertów nikt nie czyta.

---

### Skrót — cała procedura w pigułce

| Krok | Kto | Co |
|---|---|---|
| 0 | 🧑 | odłóż stary materiał, przygotuj pusty katalog |
| 1 | 🤖🧑 | szkielet + skrypty + migracja + **`git init` + commit 1** |
| 2 | 🧑 | `bash tools/acquire.sh` — kod + baza z VPS |
| 3 | 🌐 | eksport wiki+Space+changelog z Perplexity → `knowledge/` |
| 4 | 🌐 | włącz changelog Ani na produkcji |
| 5 | 🧑 | **baseline commit + tag** (stan produkcji) |
| 6 | 🧑 | `sync.sh` + cron |
| 7 | 🤖 | re-audyt: delta od 22 lipca |
