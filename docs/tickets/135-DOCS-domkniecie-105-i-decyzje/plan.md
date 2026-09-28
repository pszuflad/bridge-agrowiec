# 135-DOCS-domkniecie-105-i-decyzje — domknięcie #105 i #129.1, wystawienie rundy decyzyjnej

> Status: Implemented
> Branch: `docs/135-domkniecie-105-i-decyzje`
> Zakres: **wyłącznie dokumentacja** — zero zmian w `rebuild/`, zero zmian w kontrakcie.

## Opis

Porządki po fali I15.4, zlecone przez użytkownika 2026-09-23 w rozmowie po merge'u PR #145.

## Co robi

1. **`#105` → ✅ dowiezione w całości.** Status mówił „edycja modelu w stagingu → I15.4 (otwarte)",
   a rzecz jest na `develop` od ticketu 129: `zaktualizujZgloszenie`
   (`rebuild/backend/src/import/polityka/zgloszenia.ts:81-83`, port `staging_policy.cjs:172-176`)
   synchronizuje bieżnik z modelem, gdy bieżnik był jego automatyczną kopią. Zweryfikowane na
   `develop`, nie z pamięci.
2. **`#129.1` → ❌ nie zmieniamy** (decyzja użytkownika). Koszt grupowania `kod_importu`
   (386 ms/pozycja) jest **identyczny jak w produkcji**, więc reguła 1:1 jest spełniona i nie ma
   od czego odstępować. Wraca dopiero, gdy Ania zgłosi, że panel stoi.
3. **Nowy wpis `#135.1`** — jedenaście wpisów backlogu wisi bez decyzji (najstarszy od 24.08).
   Decyzją użytkownika mają być rozstrzygnięte **osobną kartą**, a nie przy okazji innych.
   Wpis jest po to, żeby zadanie było widoczne w `tools/stan-backlogu.sh --do-decyzji`, gdy
   koordynator pyta „co jeszcze zostało".

## Czego NIE robi

- Nie rozstrzyga tych jedenastu wpisów — to jest właśnie treść przyszłej karty.
- Nie rusza `docs/rebuild-roadmap.md` (wyłączna własność koordynatora) ani żadnej `karta.md`.
- Nie dotyka kodu, więc bramki backendu nie mają czego sprawdzać (zmiany wyłącznie w `docs/`).

## Definition of done

- [x] `#105` zamknięty z dowodem (plik:linia na `develop`)
- [x] `#129.1` zamknięty decyzją użytkownika, z warunkiem powrotu
- [x] `#135.1` widoczny w `tools/stan-backlogu.sh --do-decyzji`
