import { dodajUzytkownika } from "../auth/dodaj-uzytkownika.js";
import {
  czyKatalogIstnieje,
  DOMYSLNY_KATALOG_IMPORTOW,
  podmienZrodla,
} from "../import/podmien-zrodla.js";
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
      if (!czyKatalogIstnieje(katalog)) return `pominięto: brak katalogu ${katalog}`;
      const zmiany = podmienZrodla(db, katalog);
      return zmiany.length ? zmiany.join("; ") : "bez zmian";
    },
  },
];
