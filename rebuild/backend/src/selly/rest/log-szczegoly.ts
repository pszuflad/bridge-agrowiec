/**
 * Serializacja `szczegoly_json` dla `selly_sync_log` — ticket 194.
 *
 * ⚠ Oryginał robi `JSON.stringify(details).slice(0, 8000)`. Gdy szczegóły przekraczały limit (długie komunikaty
 * błędów × 20 próbek), ucinał JSON w środku, więc wpis był nieparsowalny i panel nie mógł pokazać przyczyny błędów.
 * Tu najpierw skracamy LISTY (próbki błędów od końca, potem kolizje), a ucinanie tekstu zostaje wyłącznie ostatnią
 * deską ratunku — wtedy zapisujemy poprawny JSON z samym znacznikiem `ucieto`.
 */

export const MAKS_ZNAKOW_SZCZEGOLOW = 8000;

type Szczegoly = Record<string, unknown>;

const KLUCZE_LIST = ["sample_errors", "kolizje"] as const;

export function szczegolyDoZapisu(details: unknown, maks = MAKS_ZNAKOW_SZCZEGOLOW): string {
  let json = JSON.stringify(details);
  if (json.length <= maks || details === null || typeof details !== "object") return json.slice(0, maks);

  const kopia: Szczegoly = { ...(details as Szczegoly) };
  for (const klucz of KLUCZE_LIST) {
    const lista = kopia[klucz];
    if (!Array.isArray(lista)) continue;
    const skracana = [...lista];
    const poczatkowa = skracana.length;
    while (json.length > maks && skracana.length > 0) {
      skracana.pop();
      kopia[klucz] = skracana;
      kopia[`ucieto_${klucz}`] = poczatkowa - skracana.length;
      json = JSON.stringify(kopia);
    }
    if (json.length <= maks) return json;
  }

  // Nic już nie da się skrócić listami — zostawiamy poprawny, choć ubogi JSON zamiast obciętego tekstu.
  const awaryjny = JSON.stringify({
    ucieto: true,
    stats: kopia.stats ?? null,
    bledy_wg_rodzaju: kopia.bledy_wg_rodzaju ?? null,
  });
  return awaryjny.length <= maks ? awaryjny : awaryjny.slice(0, maks);
}
