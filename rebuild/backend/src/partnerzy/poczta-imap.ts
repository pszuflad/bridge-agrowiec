// Skrzynka IMAP (karta PARTNERZY, ticket 229 / PRT-7.3): `imapflow` + `mailparser`. Połączenie TLS (port 993), jedna sesja na odbiór.
// Nieprzeczytane wiadomości pobieramy z INBOX; `oznaczPrzetworzona` ustawia `\Seen`. Limit rozmiaru wiadomości chroni pamięć.

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

import type { KonfiguracjaSkrzynki, OtworzSkrzynke, Skrzynka, WiadomoscPoczty } from "./poczta.js";

/** Wiadomości większe niż to są pomijane (zamówienie XML ma kilka KB; limit ma tylko chronić proces). */
export const MAKS_ROZMIAR_WIADOMOSCI = 10_000_000;
export const MAKS_WIADOMOSCI_NA_ODBIOR = 200;

export const otworzSkrzynkeImap: OtworzSkrzynke = async (konfig: KonfiguracjaSkrzynki): Promise<Skrzynka> => {
  const klient = new ImapFlow({
    host: konfig.host,
    port: konfig.port,
    secure: konfig.port === 993,
    auth: { user: konfig.uzytkownik, pass: konfig.haslo },
    logger: false,
  });
  await klient.connect();
  const blokada = await klient.getMailboxLock("INBOX");
  let zamkniete = false;

  return {
    async pobierzNieprzeczytane(): Promise<WiadomoscPoczty[]> {
      const uidy = ((await klient.search({ seen: false }, { uid: true })) || []).slice(0, MAKS_WIADOMOSCI_NA_ODBIOR);
      const wynik: WiadomoscPoczty[] = [];
      for (const uid of uidy) {
        const m = await klient.fetchOne(String(uid), { source: true, size: true }, { uid: true });
        if (!m || !m.source) continue;
        if ((m.size ?? m.source.length) > MAKS_ROZMIAR_WIADOMOSCI) {
          wynik.push({ id: String(uid), temat: "(pominięta: za duża)", od: "", zalaczniki: [], oznaczPrzetworzona: () => oznacz(uid) });
          continue;
        }
        const p = await simpleParser(m.source);
        wynik.push({
          id: String(uid),
          temat: p.subject ?? "",
          od: p.from?.text ?? "",
          zalaczniki: p.attachments.map((z) => ({ nazwa: z.filename ?? "", typ: z.contentType ?? "", tresc: z.content })),
          oznaczPrzetworzona: () => oznacz(uid),
        });
      }
      return wynik;
    },
    async zamknij() {
      if (zamkniete) return;
      zamkniete = true;
      blokada.release();
      await klient.logout().catch(() => undefined);
    },
  };

  async function oznacz(uid: number): Promise<void> {
    await klient.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
  }
};
