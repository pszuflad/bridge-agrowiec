/**
 * Nagłówek karty analityki — tytuł plus dwie notki o filtrach.
 *
 * Powstał w bloku 10e, kiedy sekcji zrobiło się sześć. Blok 10a miał jedną i trzymał ten
 * kawałek wprost w `SekcjaMarze.tsx`; przepisanie go pięć razy byłoby czystym powielaniem,
 * a notki muszą brzmieć identycznie w każdej karcie, bo tłumaczą to samo zjawisko.
 *
 * Markup jest 1:1 z tym, co renderowało 10a (`px-4 py-3` z dolną kreską, tytuł
 * `text-sm font-semibold`), więc karta marż wygląda po tej zmianie tak samo — pilnują tego
 * jej testy z 10a, które zostały nietknięte.
 *
 * Dwie notki są opcjonalne i pojawiają się tylko wtedy, gdy mają co powiedzieć:
 *  • licznik odfiltrowanych — bez niego zawężony filtr wygląda jak brak danych,
 *  • lista wymiarów, których sekcja nie umie zastosować, bo jej wiersz ich nie niesie —
 *    bez niej użytkownik zastanawia się, czemu zaznaczenie modelu nic nie zmieniło.
 */
import type { ReactNode } from "react";

import { ETYKIETY_WYMIAROW, type WymiarFiltra } from "./filtrowanie";
import { formatuj } from "./formatowanie";

export type NaglowekSekcjiProps = {
  tytul: string;
  /** Ile wierszy przyszło z backendu przed filtrowaniem klienckim. */
  wszystkie: number;
  /** Ile zostało po filtrach. */
  widoczne: number;
  /** Wymiary zaznaczone przez użytkownika, na które ta sekcja nie ma jak odpowiedzieć. */
  pominiete: WymiarFiltra[];
  /** Zdanie tłumaczące, DLACZEGO ta sekcja ich nie stosuje. Listę wymiarów dokleja komponent. */
  wyjasnieniePominietych: string;
  /** Czego liczy licznik — „grup", „pozycji", „modeli". */
  rzeczownik: string;
  /** Przedrostek `data-testid` obu notek. */
  prefiksTestu: string;
  /** Miejsce na kontrolki po prawej stronie tytułu (przycisk „CSV" dołoży blok 10f). */
  obok?: ReactNode;
  /**
   * Karta ma własny padding i nie chce kreski pod nagłówkiem.
   *
   * Tak jest w oryginale DOKŁADNIE JEDEN raz — karta „Rotacja / produkty bez aktualizacji"
   * stoi na `CardContent` z `p-4 space-y-3` (`frontend-index.js:28563`), gdy wszystkie
   * pozostałe karty analityki mają `p-0` i kreskę pod nagłówkiem. Nie ujednolicamy tego.
   */
  bezRamki?: boolean;
};

export function NaglowekSekcji({
  tytul,
  wszystkie,
  widoczne,
  pominiete,
  wyjasnieniePominietych,
  rzeczownik,
  prefiksTestu,
  obok,
  bezRamki = false,
}: NaglowekSekcjiProps) {
  const odfiltrowane = wszystkie - widoczne;

  return (
    <div className={bezRamki ? undefined : "border-b px-4 py-3"}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">{tytul}</div>
        {obok}
      </div>

      {odfiltrowane > 0 && (
        <div className="mt-1 text-xs text-muted-foreground" data-testid={`${prefiksTestu}-licznik-filtra`}>
          Filtry ukryły {formatuj(odfiltrowane)} z {formatuj(wszystkie)} {rzeczownik}.
        </div>
      )}

      {pominiete.length > 0 && (
        <div className="mt-1 text-xs text-muted-foreground" data-testid={`${prefiksTestu}-pominiete`}>
          {wyjasnieniePominietych} {pominiete.map((w) => ETYKIETY_WYMIAROW[w]).join(", ")}.
        </div>
      )}
    </div>
  );
}
