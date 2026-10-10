// Abstrakcja skrzynki pocztowej partnera (karta PARTNERZY, ticket 229 / PRT-7.3). Produkcja: IMAP (`poczta-imap.ts`); testy: atrapa — NIGDY prawdziwa poczta.

export type ZalacznikPoczty = { nazwa: string; typ: string; tresc: Buffer };

export type WiadomoscPoczty = {
  /** Identyfikator w skrzynce (UID IMAP) — tylko do logów. */
  id: string;
  temat: string;
  od: string;
  zalaczniki: ZalacznikPoczty[];
  /** Oznacza wiadomość jako przetworzoną (przeczytaną), żeby nie wracała przy kolejnym odbiorze. */
  oznaczPrzetworzona(): Promise<void>;
};

export interface Skrzynka {
  pobierzNieprzeczytane(): Promise<WiadomoscPoczty[]>;
  zamknij(): Promise<void>;
}

export type KonfiguracjaSkrzynki = { host: string; port: number; uzytkownik: string; haslo: string };

export type OtworzSkrzynke = (konfig: KonfiguracjaSkrzynki) => Promise<Skrzynka>;
