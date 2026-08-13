# Prompt do Perplexity — eksport aktualnej bazy wiedzy (przez przeglądarkę)

> Wklej w Space „Budowanie mostu dla Agrowca". Cel: dostać JEDEN plik ZIP
> z bieżącą wiedzą o projekcie do pobrania przez przeglądarkę.

---

Potrzebuję **kompletnego, aktualnego eksportu całej wiedzy o projekcie Bridge
dla Agrowca** — do pobrania jako jeden plik ZIP. Zawartość:

1. **Cała wiki (Brain)** — wszystkie strony `projects/`, `learnings/`, `entities/`,
   `index.md`, `log.md`. Stan bieżący, nie kopia sprzed tygodni.
2. **Changelog zmian** — pełna historia zmian we froncie, backendzie i schemacie
   bazy, jaka jest obecnie prowadzona. Jeśli istnieje osobny `CHANGELOG.md` —
   dołącz go. Jeśli zmiany są rozproszone po sesjach — zbierz je w jeden
   chronologiczny plik `CHANGELOG.md` (data · obszar · plik · opis · powód).
3. **Inwentarz Space** — lista wszystkich plików obecnie w tym Space (nazwa,
   rozmiar, data) plus ich eksport, jeśli to możliwe.
4. **Transkrypty sesji dotyczących Bridge / Selly / Agrorami** — pełne, nie
   streszczenia (`conversation` z assetami), za okres od ostatniego eksportu.

Wymagania:
- **Nie ujawniaj sekretów** — treści `.env`, `JWT_SECRET`, haseł Agrorami,
  kluczy Selly. Tylko nazwy zmiennych, jeśli w ogóle.
- Struktura ZIP-a: `knowledge/wiki/…`, `knowledge/CHANGELOG.md`,
  `knowledge/space/…`.
- Na początku dołącz `MANIFEST.txt`: data eksportu + lista plików + liczność sesji.

Jeśli nie da się spakować wszystkiego naraz — podziel na kilka pobrań
(osobno wiki, osobno changelog, osobno sesje) i wyraźnie je ponazywaj.
