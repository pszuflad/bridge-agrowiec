/**
 * Port `Bu()` (`deminified/frontend-index.js:16747-16760`) — znacznik względny Pulpitu.
 *
 * ⚠ TO NIE JEST TO SAMO, CO `sformatujOstatnia()` z `pages/alerty/grupowanie.ts` (I6).
 * Tamta zna dwa warianty („14:45" dla dziś, pełna data dla starszych); ta ma sześć progów
 * („przed chwilą", „N min temu", „dzisiaj, HH:MM", „wczoraj, HH:MM", „N dni temu", data)
 * i pochodzi z innego miejsca oryginału. Nie scalać ich w jedną „uniwersalną" funkcję —
 * różnica jest w produkcji widoczna i obie są portem.
 */

/** Kolejność progów jest z oryginału i ma znaczenie: „dzisiaj" bije „N min temu" dopiero po godzinie. */
export function sformatujWzglednie(iso: string, teraz: Date = new Date()): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;

  const minuty = Math.floor((teraz.getTime() - data.getTime()) / 60_000);
  if (minuty < 1) return "przed chwilą";
  if (minuty < 60) return `${minuty} min temu`;

  const godziny = Math.floor(minuty / 60);
  // Warunek jest podwójny w oryginale: „dzisiaj" wymaga i < 24 h, i tej samej daty lokalnej.
  if (godziny < 24 && data.toDateString() === teraz.toDateString()) {
    return `dzisiaj, ${data.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`;
  }

  const wczoraj = new Date(teraz);
  wczoraj.setDate(teraz.getDate() - 1);
  if (data.toDateString() === wczoraj.toDateString()) {
    return `wczoraj, ${data.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`;
  }

  const dni = Math.floor(godziny / 24);
  return dni < 7 ? `${dni} dni temu` : data.toLocaleDateString("pl-PL");
}

/** Data dzienna w tabeli dostawców (`:17062`) — `—` dla pustych. */
export function formatujDate(iso: string | null): string {
  if (!iso) return "—";
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? "—" : data.toLocaleDateString("pl-PL");
}

/** Data z godziną w tabeli dostawców (`:17066`, `:17070`) — `—` dla pustych. */
export function formatujDateZGodzina(iso: string | null): string {
  if (!iso) return "—";
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? "—" : data.toLocaleString("pl-PL");
}
