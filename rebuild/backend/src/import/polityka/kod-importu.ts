// `assignKodImportu` nadpisane przez Staging v2 — `staging_policy.cjs:141-157` (#99).
//
// W oryginale `install()` PODMIENIA `ext.assignKodImportu` na tę wersję, więc dostają ją
// wszyscy wołający: importer, `acceptStaging` i `addProductsBulk`. Dlatego nasz odpowiednik
// też zastępuje starą funkcję z `legacy/bridge_ext.cjs:156-176` we wszystkich miejscach
// wywołania, a nie tylko w rdzeniu importu.
//
// ⚠⚠ GAŁĄŹ PIERWSZA JEST DOSŁOWNA I NIE JEST BŁĘDEM DO NAPRAWY.
//
//   if (retained && /^\d{6}$/.test(retained)) { product.kodImportu = String(retained); return; }
//
// Istniejący sześciocyfrowy `kod_importu` produktu jest ZACHOWYWANY, a nowa reguła grupowania
// go nie rusza. To jest powód, dla którego kolizje `kod_importu` przeżyły Staging v2 —
// **80 grup / 174 produkty na kopii produkcji z 23.09** (backlog #108). Zmiana tej gałęzi
// przepisałaby klucze grupowania całego katalogu, czyli inne produkty i warianty w Selly.
// Rozstrzygnięcie kolizji to osobna decyzja Ani (wariant (a) w #108), a doraźne raportowanie
// dowiozła karta I15.10 (`grupyKolizyjne()`). Patrz `docs/karty/I15.4b/wejscie-116.md`.

import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";

import type { Baza } from "../../db/index.js";
import { products } from "../../db/schema.js";
import { compatibility, norm, validateEan } from "./podstawy.js";

/** Ile razy losujemy numer, zanim uznamy pulę za wyczerpaną — `:150` (`n<100000`). */
const PROB_LOSOWANIA = 100000;

/**
 * Nadaje `kodImportu` — sześciocyfrowy numer wspólny dla grupy produktów.
 *
 * MUTUJE przekazany obiekt `produkt`, dokładnie jak oryginał.
 *
 * Trzy gałęzie, w tej kolejności:
 *  1. istniejący sześciocyfrowy numer karty jest ZACHOWYWANY (patrz ostrzeżenie w nagłówku);
 *  2. jeśli wszystkie zgodne produkty należą do DOKŁADNIE JEDNEJ grupy — dołączamy do niej;
 *  3. w przeciwnym razie losujemy wolny numer.
 *
 * ⚠ Reguła zgodności w gałęzi 2 jest ostrzejsza niż w starej wersji: liczy się `compatibility()`
 * (marka, model, rozmiar + pola opcjonalne + wariant DEMO) ORAZ zgodność EAN-u — a gdy produkt
 * nie ma poprawnego EAN-u, zgodność nazwy przy obustronnym braku EAN-u. Stara wersja szukała
 * surowym SQL-em po `ean` albo `marka+rozmiar+bieznik+nazwa`.
 *
 * ⚠ Numer z gałęzi 3 jest LOSOWY (`crypto.randomInt`), więc charakteryzacja porównuje go
 * po kształcie, nie po wartości.
 */
export function assignKodImportu(
  db: Baza,
  produkt: Record<string, unknown>,
  istniejacy: unknown,
): void {
  const stary = istniejacy as Record<string, unknown> | null | undefined;
  const zachowany = stary?.kodImportu ?? stary?.kod_importu;

  // ——— Gałąź 1: zachowanie istniejącego numeru (`:142-143`) ———
  if (zachowany && /^\d{6}$/.test(String(zachowany))) {
    produkt.kodImportu = String(zachowany);
    return;
  }

  // ——— Gałąź 2: dołączenie do jednoznacznej grupy (`:144-149`) ———
  const ev = validateEan(produkt.ean);
  const wszystkie = db.select().from(products).all();
  const zgodne = wszystkie.filter(
    (p) =>
      p.kod !== produkt.kod &&
      compatibility(produkt, p as unknown as Record<string, unknown>).ok &&
      (ev.valid ? p.ean === ev.value : !p.ean && norm(p.nazwa) === norm(produkt.nazwa)),
  );
  const grupy = new Set(
    zgodne.map((p) => String(p.kodImportu ?? "")).filter((v) => /^\d{6}$/.test(v)),
  );
  if (grupy.size === 1) {
    produkt.kodImportu = [...grupy][0];
    return;
  }

  // ——— Gałąź 3: wolny numer losowy (`:150-155`) ———
  for (let n = 0; n < PROB_LOSOWANIA; n += 1) {
    const kandydat = String(randomInt(100000, 1000000));
    const zajety = db
      .select({ jeden: products.id })
      .from(products)
      .where(eq(products.kodImportu, kandydat))
      .limit(1)
      .get();
    if (!zajety) {
      produkt.kodImportu = kandydat;
      return;
    }
  }
  throw new Error("Brak wolnych numerów grup produktów");
}
