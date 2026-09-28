import { createHash } from "node:crypto";

/**
 * Identyfikator techniczny pozycji bez kodu dostawcy i bez EAN-u — port `Lq()`
 * (`deminified/backend-index.cjs:47312`).
 *
 * ⚠ To DRUGA definicja `Lq` w oryginale. Pierwsza (`:46965`) liczy cyfry znaczące zapisu
 * naukowego, ale obie siedzą w TYM SAMYM zakresie zminifikowanego bundla, więc późniejsza
 * nadpisuje wcześniejszą i licznik cyfr jest kodem martwym — sprawdzone: w całym
 * `mirror/backend/index.cjs` są dokładnie dwa miejsca wywołania i oba trafiają tutaj.
 * Konsekwencje dla komunikatu o EAN-ie: patrz `normalizujEan()` w `ean.ts`.
 *
 * Kolejność składników klucza (`ean|nazwa|rozmiar|marka|model`) jest częścią kontraktu —
 * od niej zależy wartość skrótu, a ten trafia do `staging_items.kod` i dalej do
 * `products.kod`. Zmiana kolejności zerwałaby ciągłość identyfikatorów w bazie.
 *
 * @param kodDostawcy prefiks identyfikatora, np. `MO5`
 * @param pozycja źródło składników klucza; wywołanie z jednym argumentem jest legalne
 *   i zawsze zwraca `null` — patrz uwaga wyżej
 * @returns `MO5_<14 znaków hex UPPERCASE>` albo `null`, gdy nie ma z czego zbudować klucza
 */
export function identyfikatorTechniczny(
  kodDostawcy: string,
  pozycja?: {
    ean?: string | null;
    nazwa?: string | null;
    rozmiar?: string | null;
    marka?: string | null;
    model?: string | null;
  },
): string | null {
  const klucz = [pozycja?.ean, pozycja?.nazwa, pozycja?.rozmiar, pozycja?.marka, pozycja?.model]
    .filter(Boolean)
    .join("|")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");

  if (!klucz) return null;

  const skrot = createHash("sha1")
    .update(`${kodDostawcy}|${klucz}`)
    .digest("hex")
    .slice(0, 14)
    .toUpperCase();

  return `${kodDostawcy}_${skrot}`;
}
