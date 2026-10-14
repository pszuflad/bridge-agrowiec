// Powiadomienia e-mail o błędach zamówień partnerów (ticket 263) — do osoby obsługującej zamówienia (Marta).
//   • `wyslijNowePowiadomienia` — przebieg co kilka minut: zamówienia w statusie `blad_importu`, o których jeszcze nie wysłano wiadomości;
//   • `powiadomOBledzieSelly` — natychmiast po nieudanym „Utwórz w Selly” (odmowa sklepu albo niejasny wynik).
// Wiadomość zawiera numer zamówienia, partnera i powód — nie zawiera surowego XML-a ani danych osobowych klienta.

import { and, eq, isNull } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { partnerPowiadomienia, partnerZamowienia, partnerzy } from "../db/schema.js";
import type { NadawcaEmail } from "../poczta/nadawca.js";

const RODZAJ_BLAD_IMPORTU = "blad_importu";
const MAKS_NA_PRZEBIEG = 20;

type Log = (linia: string) => void;

export async function wyslijNowePowiadomienia(
  db: Baza,
  nadawca: NadawcaEmail,
  odbiorcy: string[],
  opcje: { teraz?: () => Date; log?: Log } = {},
): Promise<{ wyslane: number; bledy: number }> {
  const log = opcje.log ?? (() => undefined);
  const teraz = opcje.teraz ?? (() => new Date());
  if (odbiorcy.length === 0) return { wyslane: 0, bledy: 0 };
  const nowe = db
    .select({ id: partnerZamowienia.id, numer: partnerZamowienia.numerPartnera, blad: partnerZamowienia.bladImportu, partner: partnerzy.nazwa })
    .from(partnerZamowienia)
    .innerJoin(partnerzy, eq(partnerzy.id, partnerZamowienia.partnerId))
    .leftJoin(partnerPowiadomienia, and(eq(partnerPowiadomienia.zamowienieId, partnerZamowienia.id), eq(partnerPowiadomienia.rodzaj, RODZAJ_BLAD_IMPORTU)))
    .where(and(eq(partnerZamowienia.status, "blad_importu"), isNull(partnerPowiadomienia.zamowienieId)))
    .limit(MAKS_NA_PRZEBIEG)
    .all();
  let wyslane = 0;
  let bledy = 0;
  for (const z of nowe) {
    try {
      await nadawca.wyslij({
        do: odbiorcy,
        temat: `Bridge: zamówienie ${z.partner} ${z.numer} nie zostało przyjęte (błąd importu)`,
        tekst: [
          `Zamówienie partnera ${z.partner} nr ${z.numer} trafiło do Bridge, ale nie przeszło sprawdzenia i NIE zostanie wysłane do Selly.`,
          "",
          `Powód: ${z.blad ?? "brak opisu"}`,
          "",
          "Sprawdź zamówienie w panelu: Partnerzy → partner → Zamówienia.",
        ].join("\n"),
      });
      db.insert(partnerPowiadomienia).values({ zamowienieId: z.id, rodzaj: RODZAJ_BLAD_IMPORTU, wyslano: teraz().toISOString() }).onConflictDoNothing().run();
      wyslane += 1;
    } catch (e) {
      bledy += 1;
      log(`[powiadomienia] nie wysłano powiadomienia o zamówieniu ${z.id}: ${e instanceof Error ? e.message : String(e)} (ponowię przy następnym przebiegu)`);
    }
  }
  return { wyslane, bledy };
}

/** Best effort: błąd wysyłki trafia do logu i NIE przerywa odpowiedzi dla użytkownika. */
export async function powiadomOBledzieSelly(
  db: Baza,
  nadawca: NadawcaEmail,
  odbiorcy: string[],
  zdarzenie: { partnerId: number; zamowienieId: number; powod: string },
  log: Log = () => undefined,
): Promise<void> {
  if (odbiorcy.length === 0) return;
  try {
    const z = db
      .select({ numer: partnerZamowienia.numerPartnera, partner: partnerzy.nazwa })
      .from(partnerZamowienia)
      .innerJoin(partnerzy, eq(partnerzy.id, partnerZamowienia.partnerId))
      .where(and(eq(partnerZamowienia.id, zdarzenie.zamowienieId), eq(partnerZamowienia.partnerId, zdarzenie.partnerId)))
      .get();
    if (!z) return;
    await nadawca.wyslij({
      do: odbiorcy,
      temat: `Bridge: zamówienie ${z.partner} ${z.numer} — błąd przy tworzeniu w Selly`,
      tekst: [
        `Nie udało się utworzyć w Selly zamówienia partnera ${z.partner} nr ${z.numer}.`,
        "",
        `Powód: ${zdarzenie.powod}`,
        "",
        "Jeśli powód mówi, że nie wiadomo, czy Selly utworzyło zamówienie, sprawdź je w Selly i dopiero wtedy użyj „Zwolnij” w panelu (Partnerzy → partner → Zamówienia).",
      ].join("\n"),
    });
  } catch (e) {
    log(`[powiadomienia] nie wysłano powiadomienia o błędzie Selly (zamówienie ${zdarzenie.zamowienieId}): ${e instanceof Error ? e.message : String(e)}`);
  }
}
