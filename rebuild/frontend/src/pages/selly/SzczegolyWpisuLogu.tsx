/**
 * Rozwinięcie wpisu „Historii operacji" — przyczyny błędów, lista usuniętych produktów, opis próby uprawnień
 * (ticket 194, NOWE; oryginał pokazywał wyłącznie liczby).
 */
import type { WpisLogu } from "./api";
import { analizujSzczegoly, type RodzajBledu } from "./szczegoly-logu";

const OPISY_RODZAJU: Record<RodzajBledu, { nazwa: string; wyjasnienie: string }> = {
  pending_create: {
    nazwa: "Czekają na utworzenie w Selly",
    wyjasnienie:
      "Produktu nie ma jeszcze w sklepie, a szybka synchronizacja cen i stanów go nie zakłada — zakłada go dopiero nocna pełna synchronizacja (jeśli jest włączona). To kolejka, nie awaria.",
  },
  tozsamosc: {
    nazwa: "Zapis zablokowany zabezpieczeniem",
    wyjasnienie:
      "Produkt, wariant lub magazyn w Selly nie zgadza się z tym, co ma Bridge (EAN/nazwa/magazyn), więc nic nie wysłano. Wymaga sprawdzenia człowieka.",
  },
  inne: {
    nazwa: "Inne błędy",
    wyjasnienie: "Odpowiedzi błędów z Selly (HTTP), limity zapytań, błędy sieci.",
  },
};

const AKCJE_USUNIECIA: Record<string, string> = {
  usunieto_produkt: "usunięto produkt",
  usunieto_wariant: "usunięto wariant",
  juz_nie_istnial: "już go nie było w Selly — usunięto mapowanie",
  pominieto: "pominięto",
  blad: "błąd",
};

export function SzczegolyWpisuLogu({ wpis }: { wpis: WpisLogu }) {
  const s = analizujSzczegoly(wpis.operacja, wpis.szczegoly_json);

  if (s.rodzaj === "brak") {
    return <p className="text-muted-foreground">Ten wpis nie zapisał szczegółów.</p>;
  }
  if (s.rodzaj === "uszkodzone") {
    return (
      <div>
        <p className="text-muted-foreground">
          Szczegóły tego wpisu są niekompletne (starszy zapis ucięty po 8000 znakach). Początek:
        </p>
        <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[11px]">{s.poczatek}</pre>
      </div>
    );
  }
  if (s.rodzaj === "opis") return <p data-testid="selly-log-opis">{s.opis}</p>;
  if (s.rodzaj === "inne") return <pre className="whitespace-pre-wrap font-mono text-[11px]">{s.tekst}</pre>;

  if (s.rodzaj === "usuwanie") {
    return (
      <div className="space-y-2" data-testid="selly-log-usuwanie">
        {s.wstrzymano ? <p className="font-medium">{s.wstrzymano}</p> : null}
        {s.sieroty != null ? <p className="text-muted-foreground">Sierot w momencie przebiegu: {s.sieroty}</p> : null}
        {s.wpisy.length > 0 ? (
          <ul className="space-y-1">
            {s.wpisy.map((w) => (
              <li key={`${w.kod}-${w.akcja}`}>
                <span className="font-mono">{w.kod}</span>
                {w.nazwa ? ` — ${w.nazwa}` : ""}: {AKCJE_USUNIECIA[w.akcja] ?? w.akcja}
                {w.powod ? <span className="text-muted-foreground"> ({w.powod})</span> : null}
              </li>
            ))}
            {s.uciete > 0 ? <li className="italic text-muted-foreground">… i {s.uciete} więcej (lista ucięta)</li> : null}
          </ul>
        ) : null}
      </div>
    );
  }

  // synchronizacja
  const bledy = wpis.liczba_blad;
  const liczby = s.bledyWgRodzaju;
  return (
    <div className="space-y-3" data-testid="selly-log-synchronizacja">
      <p className="text-muted-foreground">
        Pozycji do wysłania: {s.stats.total ?? "—"} · wysłano: {s.stats.ok ?? 0} · błędy: {s.stats.err ?? bledy} · pominięte:{" "}
        {s.stats.skip ?? 0}
        {s.kolizje > 0 ? ` · grup z kolizją kodu importu: ${s.kolizje}` : ""}
      </p>

      {liczby ? (
        <ul className="space-y-1" data-testid="selly-log-rodzaje">
          {(Object.keys(OPISY_RODZAJU) as RodzajBledu[])
            .filter((r) => liczby[r] > 0)
            .map((r) => (
              <li key={r}>
                <span className="font-medium">
                  {OPISY_RODZAJU[r].nazwa}: {liczby[r]}
                </span>
                <span className="block text-muted-foreground">{OPISY_RODZAJU[r].wyjasnienie}</span>
              </li>
            ))}
        </ul>
      ) : bledy > 0 ? (
        <p className="text-muted-foreground">
          Starszy wpis — nie ma podziału błędów na rodzaje. Poniżej próbka komunikatów.
        </p>
      ) : null}

      {s.probka.length > 0 ? (
        <div>
          <p className="mb-1 font-medium">
            Przykładowe błędy ({s.probka.length}
            {bledy > s.probka.length ? ` z ${bledy}` : ""})
          </p>
          <ul className="max-h-60 space-y-1 overflow-auto" data-testid="selly-log-probka">
            {s.probka.map((e, i) => (
              <li key={`${e.kod}-${i}`} className="font-mono text-[11px]">
                {e.kod} <span className="text-muted-foreground">[{OPISY_RODZAJU[e.rodzaj].nazwa}]</span> — {e.error}
              </li>
            ))}
          </ul>
        </div>
      ) : bledy > 0 ? (
        <p className="text-muted-foreground">Ten wpis nie zachował komunikatów błędów.</p>
      ) : null}
    </div>
  );
}
