// Skrzynka IMAP (karta PARTNERZY, ticket 229 / PRT-7.3): `imapflow` + `mailparser`. Połączenie TLS (port 993), jedna sesja na odbiór.
// Nieprzeczytane wiadomości z INBOX; treść pobierana po jednej (`wczytaj`), `oznaczPrzetworzona` ustawia `\Seen`.
//
// Ochrona procesu: bez nasłuchu `error` zerwana sesja rzuciłaby nieobsłużony wyjątek i wywróciła backend — dlatego handler jest ZAWSZE;
// timeouty gniazda chronią przed zawieszeniem; wiadomości ponad limit rozmiaru nie są pobierane (sprawdzamy rozmiar PRZED pobraniem treści).

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

import type { KonfiguracjaSkrzynki, OtworzSkrzynke, Skrzynka, TrescWiadomosci, WiadomoscPoczty } from "./poczta.js";

/** Wiadomości większe niż to są odrzucane bez pobierania (zamówienie XML ma kilka KB; limit ma tylko chronić proces). */
export const MAKS_ROZMIAR_WIADOMOSCI = 10_000_000;
export const MAKS_WIADOMOSCI_NA_ODBIOR = 200;
export const TIMEOUT_POLACZENIA_MS = 30_000;
export const TIMEOUT_GNIAZDA_MS = 60_000;

export const otworzSkrzynkeImap: OtworzSkrzynke = async (konfig: KonfiguracjaSkrzynki): Promise<Skrzynka> => {
  const klient = new ImapFlow({
    host: konfig.host,
    port: konfig.port,
    secure: konfig.port === 993,
    auth: { user: konfig.uzytkownik, pass: konfig.haslo },
    logger: false,
    connectionTimeout: TIMEOUT_POLACZENIA_MS,
    greetingTimeout: TIMEOUT_POLACZENIA_MS,
    socketTimeout: TIMEOUT_GNIAZDA_MS,
  });
  // Błąd po udanym connect() (zerwane gniazdo, timeout) imapflow zgłasza zdarzeniem — bez handlera zabiłby proces. Treść błędu nie zawiera hasła.
  klient.on("error", (e: Error) => console.error(`[partnerzy-odbior-email] błąd sesji IMAP (${konfig.uzytkownik}):`, e.message));

  await klient.connect();
  let blokada;
  try {
    blokada = await klient.getMailboxLock("INBOX");
  } catch (e) {
    await klient.logout().catch(() => undefined);
    throw e;
  }
  let zamkniete = false;
  const oznacz = async (uid: number): Promise<void> => {
    await klient.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
  };

  return {
    async pobierzNieprzeczytane(): Promise<WiadomoscPoczty[]> {
      const uidy = ((await klient.search({ seen: false }, { uid: true })) || []).slice(0, MAKS_WIADOMOSCI_NA_ODBIOR);
      return uidy.map((uid) => ({
        id: String(uid),
        oznaczPrzetworzona: () => oznacz(uid),
        async wczytaj(): Promise<TrescWiadomosci> {
          const rozmiar = await klient.fetchOne(String(uid), { size: true }, { uid: true });
          if (!rozmiar) throw new Error("wiadomość zniknęła ze skrzynki");
          if ((rozmiar.size ?? 0) > MAKS_ROZMIAR_WIADOMOSCI) throw new Error(`wiadomość za duża (${rozmiar.size} B, limit ${MAKS_ROZMIAR_WIADOMOSCI})`);
          const m = await klient.fetchOne(String(uid), { source: true }, { uid: true });
          if (!m || !m.source) throw new Error("nie udało się pobrać treści wiadomości");
          const p = await simpleParser(m.source);
          return {
            temat: p.subject ?? "",
            od: p.from?.text ?? "",
            zalaczniki: p.attachments.map((z) => ({ nazwa: z.filename ?? "", typ: z.contentType ?? "", tresc: z.content })),
          };
        },
      }));
    },
    async zamknij() {
      if (zamkniete) return;
      zamkniete = true;
      blokada.release();
      await klient.logout().catch(() => undefined);
    },
  };
};
