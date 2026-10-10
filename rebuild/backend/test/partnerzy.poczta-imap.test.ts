/** Adapter IMAP (ticket 229, PRT-7.3) na atrapie `imapflow` — bez sieci. Sprawdza ochronę procesu: handler `error`, zwolnienie blokady, limit rozmiaru. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const stan = vi.hoisted(() => ({
  opcje: [] as Record<string, unknown>[],
  zdarzenia: [] as string[],
  wywolania: [] as string[],
  blokadaRzuca: false,
  rozmiar: 100,
}));

vi.mock("imapflow", () => ({
  ImapFlow: class {
    constructor(opcje: Record<string, unknown>) {
      stan.opcje.push(opcje);
    }
    on(zdarzenie: string): void {
      stan.zdarzenia.push(zdarzenie);
    }
    async connect(): Promise<void> {
      stan.wywolania.push("connect");
    }
    async getMailboxLock(): Promise<{ release: () => void }> {
      if (stan.blokadaRzuca) throw new Error("brak INBOX");
      return { release: () => void stan.wywolania.push("release") };
    }
    async search(): Promise<number[]> {
      return [7];
    }
    async fetchOne(_u: string, q: { size?: boolean; source?: boolean }): Promise<unknown> {
      stan.wywolania.push(q.size ? "fetch-size" : "fetch-source");
      return q.size ? { size: stan.rozmiar } : { source: Buffer.from("Subject: x\r\n\r\nbody") };
    }
    async messageFlagsAdd(): Promise<void> {
      stan.wywolania.push("seen");
    }
    async logout(): Promise<void> {
      stan.wywolania.push("logout");
    }
  },
}));

import { MAKS_ROZMIAR_WIADOMOSCI, otworzSkrzynkeImap } from "../src/partnerzy/poczta-imap.js";

const konfig = { host: "imap.example.test", port: 993, uzytkownik: "u@example.test", haslo: "tajne" };

describe("adapter IMAP", () => {
  beforeEach(() => {
    stan.opcje = [];
    stan.zdarzenia = [];
    stan.wywolania = [];
    stan.blokadaRzuca = false;
    stan.rozmiar = 100;
  });

  it("zawsze rejestruje handler zdarzenia `error` (bez niego zerwana sesja wywraca proces)", async () => {
    await otworzSkrzynkeImap(konfig);
    expect(stan.zdarzenia).toContain("error");
  });

  it("gdy skrzynki nie da się otworzyć po połączeniu, sesja jest zamykana (brak wycieku połączenia)", async () => {
    stan.blokadaRzuca = true;
    await expect(otworzSkrzynkeImap(konfig)).rejects.toThrow("brak INBOX");
    expect(stan.wywolania).toEqual(["connect", "logout"]);
  });

  it("wczytuje wiadomość po jednej, oznacza `\\Seen` i zamyka skrzynkę (blokada zwolniona raz)", async () => {
    const skrzynka = await otworzSkrzynkeImap(konfig);
    const [w] = await skrzynka.pobierzNieprzeczytane();
    expect(w!.id).toBe("7");
    expect((await w!.wczytaj()).temat).toBe("x");
    await w!.oznaczPrzetworzona();
    await skrzynka.zamknij();
    await skrzynka.zamknij();
    expect(stan.wywolania).toEqual(["connect", "fetch-size", "fetch-source", "seen", "release", "logout"]);
  });

  it("wiadomość ponad limitem jest odrzucana BEZ pobierania treści", async () => {
    stan.rozmiar = MAKS_ROZMIAR_WIADOMOSCI + 1;
    const skrzynka = await otworzSkrzynkeImap(konfig);
    const [w] = await skrzynka.pobierzNieprzeczytane();
    await expect(w!.wczytaj()).rejects.toThrow(/za duża/);
    expect(stan.wywolania).not.toContain("fetch-source");
  });

  it("port 993: TLS od początku; inny port: STARTTLS jest WYMAGANY (hasło nie pójdzie jawnie, gdy serwer go nie oferuje)", async () => {
    await otworzSkrzynkeImap(konfig);
    expect(stan.opcje[0]).toMatchObject({ secure: true });
    expect(stan.opcje[0]).not.toHaveProperty("doSTARTTLS");
    await otworzSkrzynkeImap({ ...konfig, port: 143 });
    expect(stan.opcje[1]).toMatchObject({ secure: false, doSTARTTLS: true });
  });
});
