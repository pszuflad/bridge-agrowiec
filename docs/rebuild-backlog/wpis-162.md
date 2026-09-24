# Backlog — wpisy ticketu 162 (`162-DOCS-proces-po-cutoverze`) · 2026-09-24

Nie triaż. Wpis własny: dług procesowy wykryty przy pytaniu użytkownika o `/feature` po cutoverze.

### #162.1 · 2026-09-24 · [ORGANIZACYJNE] · `/feature` i trzy agenty są napisane pod odbudowę — po cutoverze kłamią

| Pole | Wartość |
|---|---|
| **Data** | 2026-09-24 (pytanie użytkownika w trakcie planowania cutoveru) |
| **Kategoria** | ORGANIZACYJNE (proces / instrukcje dla agentów) |
| **Pliki** | `.claude/commands/feature.md`, `.claude/commands/triaz-zmian.md`, `.claude/agents/{researcher,reviewer,doc-checker}.md`, `CLAUDE.md`, `docs/rebuild-backlog.md`, `docs/rebuild-roadmap.md` |
| **Commit** | — |
| **Do nowej wersji?** | ✅ **TAK — decyzja użytkownika 2026-09-24**, jako karta `PO.0`, **pierwsza po przełączeniu domeny** |
| **Status** | ⬜ czeka na cutover (warunek wstępny: stare środowisko zatrzymane) |

**Opis.** Komenda `/feature` i trzej agenci (`researcher`, `reviewer`, `doc-checker`) zostały
napisane pod **wierną odbudowę**: każą traktować `contract/fixtures/` jako wzorzec „co produkcja
realnie zwraca", `deminified/` i `mirror/` jako „ostateczne źródło prawdy, gdy specyfikacja
milczy", `contract/openapi.yaml` jako **zamrożony** kontrakt, a rozbieżność z fixture jako
**STOP**. Po przełączeniu domeny i wyłączeniu starego Bridge te zdania przestają być prawdziwe:
nowy stos **jest** produkcją, wzorca nie ma, a fixtures nagrane z oryginału są już tylko baseline'em
regresji. Osobno: cała komenda `/triaz-zmian` traci przedmiot (żywi się commitami `sync(vps)`
od Ani do `mirror/`), a mechanika kart i roadmapy opisuje falę kilkudziesięciu równoległych
worktree, której po cutoverze nie będzie.

Skutek zaniechania nie jest kosmetyczny: sesja, która po cutoverze dostanie zgłoszenie od Ani,
pójdzie szukać „jak to robi oryginał" w kodzie wyłączonego systemu i zablokuje się na gate'cie
wobec fixture, którego nikt już nie ma prawa uznawać za wzorzec.

**Szczegół techniczny.** Pełny audyt — co dokładnie zmienić, w których liniach, i **co zostawić
bez zmian** (szkielet 19 kroków, rezerwacja numeru, worktree, bramki, sync z `develop`, cały
`doc-checker` poza jedną sekcją, cały `reviewer` poza jedną linią): `docs/po-cutoverze-proces.md`.
Tam też trzy decyzje do postawienia użytkownikowi (archiwizacja `mirror/`/`deminified/` wbrew D9,
przenagranie fixtures z nowego backendu, naprawa schematu flag `'Tak'`) oraz rozdzielenie
`CLAUDE.md` na pułapki naszego kodu (zostają) i archeologię oryginału (odchodzi).

**Rekomendacja (moja).** ✅ nanieść jako **pierwszą kartę po cutoverze** — zgodnie z decyzją
użytkownika. Uzasadnienie kolejności: każda następna karta (PO.1…PO.7, zgłoszenia Ani) jest
realizowana **tą komendą**, więc im później przestrojenie, tym więcej ticketów przejdzie przez
instrukcję, która każe im szukać prawdy w wyłączonym systemie. Koszt ~0,5 dnia, ryzyko runtime
**zerowe** (zmiany wyłącznie w `.claude/**`, `CLAUDE.md` i `docs/`).

⚠ **Nie wykonywać PRZED cutoverem.** Dopóki chodzi stary Bridge i mogą powstawać karty odbudowy,
`feature.md` musi mówić o wiernym odtwarzaniu — przestrojenie wcześniej zepsułoby tickety w toku.

**Powiązania.** `#154.1` (nienaprawiony bliźniak błędu flag `'Tak'` w `src/selly/mapper.ts` —
przy okazji §1.5 trzeba potwierdzić, że nie zginął), `#137.1` (polityka `mirror/` — ten wpis
może go rozstrzygnąć), `#143.1`/`#143.2` (higiena backlogu i kart, ta sama rodzina długu
procesowego), `#143.3` (plan fali PO — PO.0 wchodzi przed PO.1).
