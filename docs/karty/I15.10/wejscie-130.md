# Wejście dla I15.10 od ticketu 130 (I15.4b) · 2026-09-23

Punkt wpięcia dostępności jest GOTOWY i czeka na Wasz moduł:

`stworzPolitykeStagingu(db, { odswiezDostepnosc })` i `silnikStagingu(db, { odswiezDostepnosc })`
(`rebuild/backend/src/import/tk.ts`) przyjmują zależność
`odswiezDostepnosc?: (dostawca: string) => void`. **Domyślnie no-op** — wiernie wobec
oryginału, który poza produkcyjną bazą (`path.resolve(db.name) ===
'/home/admin/private_apps/bridge/data.db'`) w ogóle nie woła `availability_sync`
(`staging_policy.cjs:132-134`).

Po merge'u `feature/119-selly-dostepnosc-zawor` wystarczy podać `zadajOdswiezenie` z
`src/selly/dostepnosc.ts` w miejscu montażu silnika (`src/app.ts` / `server.ts`) — jedna linia.

Importer woła szew TYLKO gdy `dostepnoscZmieniona && !reconcileOnly`
(`fabryka.ts:1010`) — czyli po realnej zmianie statusu/stanu produktu, nie przy każdym
imporcie i nie w przebiegu weryfikacyjnym.

Flaga `dostepnoscZmieniona` jest wystawiona przez fabrykę jako para helperów
`dostepnoscZmieniona()` (odczyt) / `oznaczZmianeDostepnosci()` (ustawienie) — to część
wspólnego domknięcia `install()`, dziś bez wołających poza importerem samym; nie kasować przy
porządkowaniu.
