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

/**
 * Wynik `POST /api/products/dziedzicz-wage` — ticket 156 (NOWA logika, nie port). Kształt = pola
 * `WynikDziedziczeniaWstecznego` z backendu (`src/import/dziedziczenieWagi.ts`) plus `ok`.
 */
export type WynikDziedziczeniaWagi = {
  ok: true;
  wszystkichKandydatow: number;
  zaktualizowano: number;
  pominietoOverride: number;
  pominietoBrakDanych: number;
  pominietoBrakDopasowania: number;
};

/**
 * Klient `POST /api/products/dziedzicz-wage` — przycisk „Dociągnij wagę" w zakładce „Katalog".
 * Nie jest destrukcyjne (tylko uzupełnia braki), więc bez `window.confirm` i bez ciała żądania.
 *
 * ⚠ Jak `wyczyscKatalog()` wyżej — celowo NIE przez `zadanie()`/`rzucGdyBlad()`: ten ogólny
 * helper skleja komunikat błędu ze statusem i surowym JSON-em ciała (`"500: {\"error\":...}"`),
 * a backend przy błędzie oddaje czytelne `{error: "..."}` (patrz `routes/maintenance.ts`).
 */
export async function dziedziczWage(): Promise<WynikDziedziczeniaWagi> {
  const odpowiedz = await fetch(`${BAZA_API}/api/products/dziedzicz-wage`, {
    method: "POST",
    headers: naglowki(false),
    credentials: "include",
  });

  if (!odpowiedz.ok) {
    const cialo = (await odpowiedz.json().catch(() => ({}))) as { error?: string };
    throw new Error(cialo.error || "Nie udało się dociągnąć wagi");
  }

  return (await odpowiedz.json()) as WynikDziedziczeniaWagi;
}

/**
 * Wynik `POST /api/products/oszacuj-wage` — ticket 167 (NOWA logika, świadomie MNIEJ PEWNA
 * niż dziedziczenie z ticketu 156). Kształt = pola `WynikSzacowaniaWstecznego` z backendu
 * (`src/import/dziedziczenieWagi.ts`) plus `ok`.
 */
export type WynikSzacowaniaWagi = {
  ok: true;
  wszystkichKandydatow: number;
  zaktualizowano: number;
  pominietoOverride: number;
  pominietoBrakDanych: number;
  pominietoBrakSredniej: number;
};

/**
 * Klient `POST /api/products/oszacuj-wage` — przycisk „Oszacuj pozostałe wagi" w zakładce
 * „Katalog". Nie jest destrukcyjne, więc bez `window.confirm` i bez ciała żądania — ten sam
 * wzorzec co `dziedziczWage()` wyżej.
 */
export async function oszacujWage(): Promise<WynikSzacowaniaWagi> {
  const odpowiedz = await fetch(`${BAZA_API}/api/products/oszacuj-wage`, {
    method: "POST",
    headers: naglowki(false),
    credentials: "include",
  });

  if (!odpowiedz.ok) {
    const cialo = (await odpowiedz.json().catch(() => ({}))) as { error?: string };
    throw new Error(cialo.error || "Nie udało się oszacować wagi");
  }

  return (await odpowiedz.json()) as WynikSzacowaniaWagi;
}
