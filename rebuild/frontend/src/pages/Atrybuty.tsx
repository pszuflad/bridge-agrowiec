/**
 * Widok `/atrybuty` — natywne odtworzenie ekranu, który w produkcji powstaje z TRZECH warstw:
 *  1. bazowego widoku React (`deminified/frontend-index.js:27277-27650`),
 *  2. mostka wbudowanego w bundle (`:9960-10268`), który martwe klucze `["/api/attributes"]`
 *     i `["/api/attribute-kinds"]` karmi z `fetch("/panel/api/atrybuty")` i patchuje zapisy
 *     wartości na prawdziwe API,
 *  3. skryptu `mirror/frontend/assets/pending-injection.js` (57 KB), który przejmuje `<main>`,
 *     chowa kafle bazowego Reacta i renderuje własny DOM.
 *
 * „Parytet” w tej sesji znaczy parytet z EFEKTEM ZŁOŻONYM tych trzech warstw — czyli z tym,
 * co realnie widzi Ania — a nie z samym bazowym widokiem. Stąd układ: kafle rodzajów →
 * panel wartości wybranego rodzaju, plus osobny panel kolejki pod przyciskiem „Do akceptacji”
 * z licznikiem.
 *
 * NIE PORTUJEMY mechaniki injection, bo po natywnym porcie nie ma czego obchodzić: React Fiber,
 * `MutationObserver`, pętli `tick()` z `cleanup()` przy zmianie trasy, chowania i odsłaniania
 * treści bazowego widoku, podmiany węzła tekstowego przycisku, ręcznego wstrzykiwania CSS
 * i toastów ani skeletonu chroniącego przed przebiciem starego widoku.
 *
 * MARTWE ŚCIEŻKI NAPRAWIONE: widok woła wyłącznie `/api/atrybuty*`, nigdy `/api/attributes`
 * ani `/api/attribute-kinds` (`docs/rebuild-roadmap.md` §3).
 */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  komunikatBledu,
  pobierzPending,
  pobierzSlownik,
  type OdpowiedzPending,
  type OdpowiedzSlownika,
} from "./atrybuty/api";
import { DialogNowaWartosc } from "./atrybuty/DialogNowaWartosc";
import { DialogNowyRodzaj } from "./atrybuty/DialogNowyRodzaj";
import { DialogProduktow } from "./atrybuty/DialogProduktow";
import { KafleRodzajow } from "./atrybuty/KafleRodzajow";
import { PanelPending } from "./atrybuty/PanelPending";
import { PanelWartosci } from "./atrybuty/PanelWartosci";

/** Trzy stany ekranu — odpowiednik `state.view` z injection (`:625`). */
type Widok = "kafle" | "wartosci" | "pending";

export function Atrybuty() {
  const [widok, ustawWidok] = useState<Widok>("kafle");
  const [aktywnyRodzaj, ustawAktywnyRodzaj] = useState<string | null>(null);
  const [podglad, ustawPodglad] = useState<{ rodzaj: string; wartosc: string } | null>(null);

  const slownik = useQuery<OdpowiedzSlownika>({
    queryKey: ["/api/atrybuty"],
    queryFn: pobierzSlownik,
  });

  /**
   * Kolejka jedzie jednym zapytaniem dla licznika w przycisku ORAZ dla panelu — tak jak
   * w oryginale, gdzie badge i panel czytają ten sam `state.pendingItems` (`:534`, `:898`).
   */
  const kolejka = useQuery<OdpowiedzPending>({
    queryKey: ["/api/atrybuty/pending"],
    queryFn: pobierzPending,
  });

  const rodzaje = slownik.data?.rodzaje ?? [];
  const wartosci = slownik.data?.wartosci ?? [];
  const pozycjePending = kolejka.data?.items ?? [];
  const wybrany = rodzaje.find((r) => r.value === aktywnyRodzaj) ?? null;

  function pokazRodzaj(rodzaj: string) {
    ustawAktywnyRodzaj(rodzaj);
    ustawWidok("wartosci");
  }

  function przelaczKolejke() {
    ustawWidok((biezacy) => (biezacy === "pending" ? "kafle" : "pending"));
  }

  return (
    <AppShell>
      <PageHeader
        title="Atrybuty"
        subtitle="Centralna lista wartości słownikowych używanych w aplikacji"
        actions={
          <>
            <Button
              variant={widok === "pending" ? "default" : "secondary"}
              onClick={przelaczKolejke}
              data-testid="button-do-akceptacji"
            >
              Do akceptacji
              <span className="ml-2 rounded-full bg-black/20 px-2 py-0.5 text-xs font-semibold tabular-nums">
                {pozycjePending.length}
              </span>
            </Button>
            <DialogNowyRodzaj />
            <DialogNowaWartosc
              rodzaje={rodzaje}
              {...(wybrany ? { rodzajPoczatkowy: wybrany.value } : {})}
            />
          </>
        }
      />

      {widok === "pending" ? (
        <PanelPending
          pozycje={pozycjePending}
          blad={kolejka.error ? komunikatBledu(kolejka.error) : null}
          ladowanie={kolejka.isPending}
          onPodglad={(rodzaj, wartosc) => ustawPodglad({ rodzaj, wartosc })}
        />
      ) : widok === "wartosci" && wybrany ? (
        <PanelWartosci
          rodzaj={wybrany}
          wartosci={wartosci}
          onWroc={() => {
            ustawAktywnyRodzaj(null);
            ustawWidok("kafle");
          }}
          onPodglad={(rodzaj, wartosc) => ustawPodglad({ rodzaj, wartosc })}
        />
      ) : (
        <KafleRodzajow
          rodzaje={rodzaje}
          wartosci={wartosci}
          blad={slownik.error ? komunikatBledu(slownik.error) : null}
          odswiezanie={slownik.isFetching}
          onWybierz={pokazRodzaj}
          onOdswiez={() => void slownik.refetch()}
        />
      )}

      <DialogProduktow
        rodzaj={podglad?.rodzaj ?? null}
        wartosc={podglad?.wartosc ?? null}
        onZamknij={() => ustawPodglad(null)}
      />
    </AppShell>
  );
}
