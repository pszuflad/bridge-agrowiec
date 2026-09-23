# Wejście dla TEST.1 od ticketu 144 · 2026-09-24 — co musi być ustawione, zanim Ania zacznie testować dostępność

Uzupełnienie do `docs/karty/TEST.1/wejscie-139.md` (tam jest sama delta zachowania dla Ani).
Tu jest to, co musi się wydarzyć **przed** wydaniem jej instrukcji. Pełna lista do rozliczenia
przy domknięciu I15: `docs/karty/I15.9/wejscie-144.md`.

## Pułapka, na którą trzeba uważać pisząc instrukcję testów

Odświeżanie dostępności po imporcie jest **niewidocznie wyłączone** przy `SELLY_TRYB=wylaczony`
(domyślka i dzisiejszy staging). Nie ma błędu, nie ma komunikatu w UI, nie ma pustej listy —
po prostu nic się nie dzieje. Jedyny ślad to linia w logu startu backendu:

```
[dostepnosc] niezamontowana (SELLY_TRYB=wylaczony) — zgłoszenia odświeżenia są no-opem
```

Jeśli instrukcja każe Ani sprawdzić, że „po imporcie plik CSV się odświeżył", a środowisko ma
`wylaczony`, to **Ania zgłosi usterkę, której nie ma** — i będzie miała rację, bo z jej strony
wygląda to identycznie jak awaria. Dlatego:

1. **Zanim wyjdzie instrukcja:** ustal, czy testy mają obejmować odświeżanie dostępności.
   - **Jeśli TAK** — środowisko testowe musi mieć `SELLY_TRYB=tylko-odczyt` albo `pelny`,
     **oraz** `SELLY_CSV_DIR` wskazujący katalog testowy, nie produkcyjny (domyślka jest
     produkcyjna — `docs/karty/I15.9/wejscie-144.md` punkt 1). Bez tego drugiego warunku test
     zapisze plik do produkcji.
   - **Jeśli NIE** — napisz Ani wprost jednym zdaniem, że odświeżanie dostępności jest w tej
     turze wyłączone i że brak nowego CSV po imporcie jest **oczekiwany**. Inaczej i tak to
     zgłosi.
2. **Nie każ jej czytać logu backendu** — nie ma do niego dostępu w swoim trybie pracy.
   Stan bramki ustala się po stronie deployu, nie w instrukcji.

## Obserwowalna różnica (do przepisania w układzie „Zgłosiłaś → Jest teraz → Sprawdź")

| `SELLY_TRYB` | Co robi import, który zmienił dostępność |
|---|---|
| `wylaczony` | nic — brak nowego CSV, brak ruchu w Selly. Zachowanie identyczne jak przed ticketem 139 |
| `tylko-odczyt` / `pelny` | regeneruje plik CSV pod `SELLY_CSV_DIR` i woła Tor 1 |
