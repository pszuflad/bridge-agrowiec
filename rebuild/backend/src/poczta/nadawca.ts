// Wysyłka poczty z Bridge (ticket 263) — SMTP przez `nodemailer`, za interfejsem: testy NIGDY nie wysyłają prawdziwej poczty (wstrzykiwana atrapa).
// Hasło SMTP jest wyłącznie w środowisku serwera (`SMTP_HASLO`), nigdy w repozytorium ani w logach.

import nodemailer from "nodemailer";

export type WiadomoscDoWyslania = { do: string[]; temat: string; tekst: string };
export interface NadawcaEmail {
  /** Wysyła jedną wiadomość tekstową. Rzuca przy błędzie SMTP (komunikat bez hasła). */
  wyslij(w: WiadomoscDoWyslania): Promise<void>;
}

export type KonfiguracjaSmtp = { host: string; port: number; uzytkownik: string; haslo: string; od: string; nazwaNadawcy: string };

type SrodowiskoSmtp = {
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_HASLO?: string;
  SMTP_OD?: string;
  SMTP_OD_NAZWA?: string;
};

/** Konfiguracja SMTP ze środowiska albo `null`, gdy czegokolwiek brakuje (powiadomienia są wtedy wyłączone, bez błędu). */
export function konfiguracjaSmtp(env: SrodowiskoSmtp): KonfiguracjaSmtp | null {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_HASLO || !env.SMTP_OD) return null;
  return { host: env.SMTP_HOST, port: env.SMTP_PORT ?? 465, uzytkownik: env.SMTP_USER, haslo: env.SMTP_HASLO, od: env.SMTP_OD, nazwaNadawcy: env.SMTP_OD_NAZWA ?? "Bridge" };
}

/** Lista adresów z `a@x.pl, b@y.pl` (przecinek lub średnik); niepoprawne wpisy są pomijane. */
export function parsujAdresy(tekst: string | undefined): string[] {
  return (tekst ?? "")
    .split(/[;,]/)
    .map((a) => a.trim())
    .filter((a) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a));
}

export function nadawcaSmtp(k: KonfiguracjaSmtp): NadawcaEmail {
  const transport = nodemailer.createTransport({
    host: k.host,
    port: k.port,
    secure: k.port === 465, // 465 = SSL od razu; inne porty (587) negocjują STARTTLS
    auth: { user: k.uzytkownik, pass: k.haslo },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  return {
    async wyslij(w) {
      try {
        await transport.sendMail({ from: { name: k.nazwaNadawcy, address: k.od }, to: w.do, subject: w.temat, text: w.tekst });
      } catch (e) {
        const komunikat = e instanceof Error ? e.message : String(e);
        throw new Error(komunikat.split(k.haslo).join("***"));
      }
    },
  };
}
