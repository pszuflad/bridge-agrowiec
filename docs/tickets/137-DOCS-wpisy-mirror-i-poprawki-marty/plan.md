# 137-DOCS-wpisy-mirror-i-poprawki-marty — dwa ustalenia z I15.4b dostają dom w backlogu

> Status: Approved → **Implemented**
> Branch: `docs/137-wpisy-mirror-i-poprawki-marty`

## Opis ticketa

Dwa ustalenia z ticketu **130** (karta I15.4b) po zamknięciu tamtej karty zostały bez domu:
siedziały wyłącznie w sekcji „Do koordynatora" zamkniętego `karta.md`. Backlog jest przeglądany
rutynowo, „Do koordynatora" zamkniętej karty — nie. Ten ticket przenosi je tam, gdzie będą widoczne.

## Kontekst — dlaczego akurat te dwa

Przegląd po merge'u PR #150 pokazał, że z sześciu punktów „Do koordynatora" karty I15.4b:

- **montaż modułu dostępności** ma już własną kartę `I15.10b` i gotowy plan ticketu 136 — nic nie trzeba;
- **odwrócona kolejność fal / wspólna warstwa z ticketu 129** jest tam, gdzie być powinna: koordynator
  czyta „Do koordynatora" przy planowaniu fali i przenosi do roadmapy (CLAUDE.md);
- **rozszerzenie zakresu D-130.3** i **wydajność** są rozliczone w backlogu przy `#104` i `#107`/`#129.1`;
- **flake `alerty-katalogu`** rozwiązał ticket 132;
- **nieaktualny `mirror/backend/index.cjs`** i **ciche poprawki Marty** — zero trafień w backlogu
  (sprawdzone `grep`em). To są te dwa.

## Zmiany

- **Nowy** `docs/rebuild-backlog/wpis-137.md` — wpisy `#137.1` i `#137.2`, wg szablonu
  z `docs/rebuild-backlog/README.md` (reguła „jeden plik na ticket", ticket 128).
- `docs/karty/I15.4b/karta.md` — przy punktach 1 i 2 sekcji „Do koordynatora" odsyłacz do wpisów,
  żeby nie powstały dwa niezależne opisy tej samej rzeczy.

## Poza zakresem

Nie rozstrzygam żadnego z wpisów — oba wychodzą jako `⬜ do decyzji`. `#137.2` to **decyzja Ani**
(zachowanie jest odtworzone 1:1 z produkcji, więc zmiana byłaby odstępstwem, nie naprawą).
Nie dotykam kodu ani `docs/rebuild-backlog.md`.

## Definition of done

- [x] Oba ustalenia mają wpis w backlogu z rekomendacją i powiązaniami
- [x] Karta I15.4b odsyła do wpisów zamiast być jedynym ich nośnikiem
- [x] Zero zmian w kodzie; `docs/rebuild-backlog.md` nietknięty
