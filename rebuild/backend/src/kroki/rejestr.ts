import { dodajUzytkownika } from "../auth/dodaj-uzytkownika.js";
import { ustawHasloTymczasowe } from "../auth/reset-hasla.js";
import {
  czyKatalogIstnieje,
  DOMYSLNY_KATALOG_IMPORTOW,
  podmienZrodla,
} from "../import/podmien-zrodla.js";
import { dirname, join } from "node:path";
import { ustawWEnvPliku } from "./env-plik.js";
import type { Krok } from "./runner.js";

/**
 * REJESTR KROKÓW WDROŻENIA — dopisuj na KOŃCU, nigdy nie zmieniaj ani nie usuwaj `id`
 * kroku już wdrożonego (zapisany w `kroki_wdrozenia` na produkcji). Zasady i szablon:
 * `CLAUDE.md`, sekcja „Poprawki danych i konta na produkcji”.
 */
export const KROKI_WDROZENIA: Krok[] = [
  {
    id: "2026-10-06-konta-erwin-anna",
    opis: "konta Erwina Wojtysiaka i Anny Naumowicz z hasłem tymczasowym",
    wymagaEnv: ["HASLO_TYMCZASOWE"],
    async uruchom({ db, env }) {
      const haslo = env.HASLO_TYMCZASOWE as string;
      if (haslo.length < 8)
        throw new Error("HASLO_TYMCZASOWE musi mieć co najmniej 8 znaków");
      const konta = [
        {
          email: "erwin.wojtysiak@agrowiec.eu",
          imieNazwisko: "Erwin Wojtysiak",
        },
        { email: "anna.naumowicz4@gmail.com", imieNazwisko: "Anna Naumowicz" },
      ];
      const wyniki: string[] = [];
      for (const { email, imieNazwisko } of konta) {
        wyniki.push(
          `${email}: ${await dodajUzytkownika(db, email, imieNazwisko, haslo)}`,
        );
      }
      return wyniki.join("; ");
    },
  },
  {
    id: "2026-10-07-zrodla-cennikow-foldery",
    opis: "źródła cenników dostawców (poza MO2/MO3) → lokalne foldery MO#_ (plik://), widoczne w panelu",
    async uruchom({ db, env }) {
      const katalog = (env.IMPORTY_KATALOG as string | undefined)?.trim() || DOMYSLNY_KATALOG_IMPORTOW;
      if (!czyKatalogIstnieje(katalog)) return { odloz: `brak katalogu ${katalog}` };
      const { zmiany, braki } = podmienZrodla(db, katalog);
      if (braki.length) return { odloz: [...zmiany, ...braki].join("; ") };
      return zmiany.length ? zmiany.join("; ") : "bez zmian";
    },
  },
  {
    id: "2026-10-08-selly-tor2-tor3-wlaczone",
    opis: "Selly: włączenie Toru 2 (pełna synchronizacja 04:30) i Toru 3 (usuwanie sierot) — SELLY_TOR2=true, SELLY_USUWANIE=true w .env",
    async uruchom({ env }) {
      // `.env` leży w `$PROD_ROOT`, a baza w `$PROD_ROOT/data/` (tools/deploy-produkcja.sh).
      const dbPath = env.DB_PATH as string | undefined;
      const sciezka = (env.PLIK_ENV as string | undefined) || (dbPath ? join(dirname(dbPath), "..", ".env") : "");
      if (!sciezka) return { odloz: "brak DB_PATH — nie wiem, gdzie jest .env" };
      const opis = ustawWEnvPliku(sciezka, { SELLY_TOR2: "true", SELLY_USUWANIE: "true" });
      if (!opis) return { odloz: `brak pliku ${sciezka}` };
      return `${opis.join("; ")} — zacznie działać przy następnym wdrożeniu/restarcie (zmienne są czytane z .env przy starcie skryptu wdrożenia)`;
    },
  },
  {
    id: "2026-10-09-reset-hasla-arkadiusz",
    opis: "reset hasła Arkadiusza Mielczarka do hasła tymczasowego z HASLO_TYMCZASOWE (zapomniał hasła)",
    wymagaEnv: ["HASLO_TYMCZASOWE"],
    async uruchom({ db, env }) {
      const haslo = env.HASLO_TYMCZASOWE as string;
      if (haslo.length < 8) throw new Error("HASLO_TYMCZASOWE musi mieć co najmniej 8 znaków");
      const email = "arkadiusz.mielczarek@agrowiec.eu";
      // Brak konta nie zatrzymuje wdrożenia — krok zostaje odłożony (nie zapisany) i ruszy, gdy konto się pojawi.
      if ((await ustawHasloTymczasowe(db, email, haslo)) === "brak_konta") {
        return { odloz: `brak konta ${email}` };
      }
      return `${email}: hasło ustawione na tymczasowe — użytkownik zmienia je w /moje-konto`;
    },
  },
];
