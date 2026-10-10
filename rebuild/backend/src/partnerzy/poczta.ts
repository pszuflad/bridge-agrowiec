// Abstrakcja skrzynki pocztowej partnera (karta PARTNERZY, ticket 229 / PRT-7.3). Produkcja: IMAP (`poczta-imap.ts`); testy: atrapa — NIGDY prawdziwa poczta.
//
// Wiadomości są ładowane po JEDNEJ (`wczytaj`), żeby setki wiadomości nie siedziały naraz w pamięci i żeby jedna uszkodzona nie blokowała reszty.

export type ZalacznikPoczty = { nazwa: string; typ: string; tresc: Buffer };

export type TrescWiadomosci = { temat: string; od: string; zalaczniki: ZalacznikPoczty[] };

export type WiadomoscPoczty = {
  /** Identyfikator w skrzynce (UID IMAP) — tylko do logów. */
  id: string;
  /** Pobiera i parsuje wiadomość. Rzuca przy uszkodzonej wiadomości lub awarii sesji. */
  wczytaj(): Promise<TrescWiadomosci>;
  /** Oznacza wiadomość jako przetworzoną (przeczytaną), żeby nie wracała przy kolejnym odbiorze. */
  oznaczPrzetworzona(): Promise<void>;
};

export interface Skrzynka {
  /** Lista nieprzeczytanych wiadomości (bez treści — ta przychodzi z `wczytaj`). */
  pobierzNieprzeczytane(): Promise<WiadomoscPoczty[]>;
  zamknij(): Promise<void>;
}

export type KonfiguracjaSkrzynki = { host: string; port: number; uzytkownik: string; haslo: string };

export type OtworzSkrzynke = (konfig: KonfiguracjaSkrzynki) => Promise<Skrzynka>;
