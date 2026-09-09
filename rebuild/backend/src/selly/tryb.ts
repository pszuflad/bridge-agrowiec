/**
 * Twarda blokada integracji Selly na poziomie środowiska (ticket
 * `34-FEATURE-selly-blokada-srodowiska`, decyzje D2/D3).
 *
 * ⚠ PO CO TO ISTNIEJE. Staging stoi na TYM SAMYM VPS co produkcja
 * (`docs/deploy-setup.md:4`) i — jeśli dostanie sekrety — patrzy na TEN SAM, żywy sklep
 * Selly. Dotychczasowe zabezpieczenie było zabezpieczeniem przez NIEOBECNOŚĆ: brak
 * `SELLY_*` w env. To wystarcza, dopóki nikt nie skopiuje `.env` z produkcji „żeby coś
 * sprawdzić" — a wtedy staging staje się żywy po cichu. `SELLY_TRYB` zamienia to
 * w jawny ZAKAZ, niezależny od tego, czy sekrety są ustawione.
 *
 * ⚠ DLACZEGO OBWOLUTA, A NIE WARUNKI W TRASACH (D3). `KlientSelly` ma czysty podział na
 * odczyt i zapis (`klient.ts:59-78`), więc jedno opakowanie interfejsu blokuje wszystkie
 * dziesięć tras naraz. Warunki rozsiane po trasach trzeba by pamiętać przy każdej nowej —
 * a `test/selly.tryb.test.ts` pilnuje tu czegoś, czego takie warunki pilnować nie potrafią:
 * że lista metod zapisujących POKRYWA SIĘ z faktycznym interfejsem klienta.
 *
 * ⚠ SKUTEK UBOCZNY, POŻĄDANY: `sync-supplier` z `dry_run: true` działa w trybie
 * `tylko-odczyt` SAM Z SIEBIE, bez ani jednej linijki kodu na ten temat — bo dry-run
 * z definicji nie woła metody zapisującej (`routes/selly.ts:281-287`). Gdyby kiedyś zaczął,
 * blokada go zatrzyma i o tym się dowiemy.
 */
import type { KlientSelly } from "./klient.js";

export type TrybSelly = "wylaczony" | "tylko-odczyt" | "pelny";

/**
 * Metody `KlientSelly`, które ZMIENIAJĄ stan sklepu Selly.
 *
 * ⚠ Lista jest zamrożona testem kompletności (`test/selly.tryb.test.ts`): jej suma
 * z metodami odczytu musi dawać DOKŁADNIE interfejs `KlientSelly`. Dzięki temu dopisanie
 * w przyszłości nowej metody — zapisującej czy odczytowej — wywali test zamiast po cichu
 * ominąć blokadę. To jest właściwy powód istnienia tego pliku jako osobnego modułu.
 */
export const METODY_ZAPISUJACE = [
  "createProducer",
  "createCategory",
  "createProduct",
  "updateProduct",
  "upsertProductWarehouse",
  "setProductMultiCat",
] as const satisfies readonly (keyof KlientSelly)[];

/** Metody wyłącznie odczytowe — przechodzą w trybie `tylko-odczyt`. */
export const METODY_ODCZYTU = [
  "ping",
  "listProducers",
  "listCategories",
  "listVatRates",
  "listWarehouses",
] as const satisfies readonly (keyof KlientSelly)[];

/**
 * Błąd blokady środowiskowej.
 *
 * Osobna klasa, nie zwykły `Error`, żeby dało się ją odróżnić w logach i testach od błędu
 * braku konfiguracji (`[Selly] Brak konfiguracji: …`) — to dwa różne stany i dwie różne
 * naprawy: tam „uzupełnij sekrety", tu „to środowisko ma zakaz".
 */
export class BlokadaSelly extends Error {
  readonly tryb: TrybSelly;

  constructor(wiadomosc: string, tryb: TrybSelly) {
    super(wiadomosc);
    this.name = "BlokadaSelly";
    this.tryb = tryb;
  }
}

/**
 * Komunikaty niosą NAZWĘ I WARTOŚĆ zmiennej, bo trafiają wprost na ekran Ani i do logu —
 * bez tego „nie działa integracja" jest nie do zdiagnozowania bez wejścia na serwer.
 * Prefiks `[Selly]` zgodnie z konwencją pozostałych błędów tego modułu.
 */
export function komunikatBlokady(tryb: Exclude<TrybSelly, "pelny">): string {
  return tryb === "wylaczony"
    ? "[Selly] Integracja wyłączona na tym środowisku (SELLY_TRYB=wylaczony)"
    : "[Selly] Zapis do Selly zablokowany na tym środowisku (SELLY_TRYB=tylko-odczyt)";
}

/**
 * Opakowuje klienta blokadą wynikającą z trybu środowiska.
 *
 * Dla `pelny` zwraca **ten sam obiekt** — produkcja nie płaci ani jednego dodatkowego
 * wywołania, a zachowanie zostaje 1:1 z oryginałem.
 */
export function opakujKlientaTrybem(klient: KlientSelly, tryb: TrybSelly): KlientSelly {
  if (tryb === "pelny") return klient;

  const zapisujace = new Set<string>(METODY_ZAPISUJACE);

  return new Proxy(klient, {
    get(cel, nazwa, odbiorca) {
      const wartosc = Reflect.get(cel, nazwa, odbiorca);
      if (typeof wartosc !== "function") return wartosc;

      const blokowana = tryb === "wylaczony" || zapisujace.has(String(nazwa));
      if (!blokowana) return wartosc;

      // Rzucamy z WNĘTRZA odrzuconej obietnicy, a nie synchronicznie: wołający (`routes/selly.ts`)
      // łapie te błędy w `try/catch` wokół `await`, więc synchroniczny throw ominąłby jego
      // obsługę i wywalił proces zamiast oddać 500.
      return () => Promise.reject(new BlokadaSelly(komunikatBlokady(tryb), tryb));
    },
  });
}
