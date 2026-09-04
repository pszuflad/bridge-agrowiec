/**
 * Klient `POST /api/products/clear` — zakładka „Katalog" w `/konfiguracja`.
 * Port `:26101-26134` (`deminified/frontend-index.js`).
 */
import { BAZA_API, naglowki } from "@/lib/api";

/**
 * Backend porównuje tę wartość ŚCIŚLE (`c.body?.potwierdzenie !== "WYCZYSC"`, `:48316`),
 * więc jest częścią kontraktu, a nie etykietą do przetłumaczenia.
 */
export const POTWIERDZENIE_CZYSZCZENIA = "WYCZYSC";

/** Treść `window.confirm` — dosłownie z oryginału (`:26103`). */
export const TEKST_POTWIERDZENIA =
  "Usunąć wszystko z katalogu? Ta operacja usuwa wszystkie produkty i służy tylko do testów parsera.";

/**
 * ⚠ NIE używa `zadanie()` z `lib/api` — z tego samego powodu co zmiana hasła: oryginał czyta
 * `error` z CIAŁA odpowiedzi (`t?.error || "Nie udało się wyczyścić katalogu"`, `:26113`),
 * a `rzucGdyBlad` skleiłby komunikat ze statusem i surowym JSON-em.
 */
export async function wyczyscKatalog(): Promise<void> {
  const odpowiedz = await fetch(`${BAZA_API}/api/products/clear`, {
    method: "POST",
    headers: naglowki(true),
    body: JSON.stringify({ potwierdzenie: POTWIERDZENIE_CZYSZCZENIA }),
    credentials: "include",
  });

  if (!odpowiedz.ok) {
    const cialo = (await odpowiedz.json().catch(() => ({}))) as { error?: string };
    throw new Error(cialo.error || "Nie udało się wyczyścić katalogu");
  }
}
