import { isNotNull } from "drizzle-orm";

import { dodajUzytkownika } from "../auth/dodaj-uzytkownika.js";
import { ustawHasloTymczasowe } from "../auth/reset-hasla.js";
import {
  czyKatalogIstnieje,
  DOMYSLNY_KATALOG_IMPORTOW,
  podmienZrodla,
} from "../import/podmien-zrodla.js";
import { dirname, join } from "node:path";
import { usunWszystkieKartyAuto } from "../import/migracje/scal-karty-auto.js";
import { wyprowadzKatalogiTrackingu } from "../partnerzy/katalogi-trackingu.js";
import { uzupelnijDanePartnerow } from "../partnerzy/dane-partnerow.js";
import { ustawNarzutyStartowe } from "../partnerzy/narzuty-startowe.js";
import { naprawMagazynyDostawcow, ustawKonfiguracjeStartowa } from "../partnerzy/konfiguracja-startowa.js";
import { partnerKraje } from "../db/schema.js";
import { dodajPartnera } from "../repos/partnerzy.js";
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
    tylkoProdukcja: true,
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
    tylkoProdukcja: true, // środowisko testowe nie może dostać zapisu do sklepu Selly
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
  {
    id: "2026-10-09-usun-karty-auto",
    opis: "usunięcie wszystkich wstrzymanych kart MO*_AUTO_<hash> (decyzja użytkowniczki); jeśli są w pliku dostawcy, wpadną jako nowe",
    async uruchom({ sqlite }) {
      const w = usunWszystkieKartyAuto(sqlite);
      const pominiete = w.pominiete.length ? `; pominięte ${w.pominiete.map((p) => `${p.kod} (${p.powod})`).join(", ")}` : "";
      return `usunięto ${w.usuniete.length}: ${w.usuniete.join(", ") || "—"}${pominiete}`;
    },
  },
  {
    id: "2026-10-10-partnerzy-startowi",
    opis: "moduł partnerów B2B: założenie dwóch pierwszych partnerów (TyreWorld, Adtyres) jako NIEAKTYWNYCH, z ustawieniami domyślnymi — bez krajów, magazynów i kolumn (do uzupełnienia w panelu)",
    async uruchom({ db }) {
      // Idempotentne: partner o tej nazwie już istnieje (np. dodany ręcznie w panelu) → bez zmian. Niczego nie aktywuje i nie uruchamia generowania.
      const wyniki = ["TyreWorld", "Adtyres"].map((nazwa) => `${nazwa}: ${dodajPartnera(db, { nazwa }) === null ? "już istnieje" : "założony (nieaktywny)"}`);
      return wyniki.join("; ");
    },
  },
  {
    id: "2026-10-12-partnerzy-konfiguracja-startowa",
    opis: "moduł partnerów B2B: uzupełnienie konfiguracji TyreWorld i Adtyres (nazwy plików, magazyny bez MO6/MO7/MO8, kraje z narzutem 0 % i przesyłką 15 EUR, kolumny jak w obecnych plikach) i aktywacja; ceny nie są publikowane, dopóki narzuty nie zostaną ustawione w panelu",
    async uruchom({ db }) {
      return ustawKonfiguracjeStartowa(db);
    },
  },
  {
    id: "2026-10-13-partnerzy-magazyny-dostawcy",
    opis: "partnerzy B2B: naprawa wyboru „magazynów” — kody dostawców (MO1, MO2…, bez MO6/MO7/MO8) zamiast fizycznych magazynów, tylko dla partnerów z błędnym wyborem; poprawnie ustawionych nie rusza",
    async uruchom({ db }) {
      return naprawMagazynyDostawcow(db);
    },
  },
  {
    id: "2026-10-13-partnerzy-dane-faktury",
    opis: "partnerzy B2B: dane do faktury (TyreWorld; Adtyres wg kraju dostawy), e-mail kontaktowy i stawka VAT 0 % WDT (101) — uzupełnia tylko puste pola; numerów VAT, których nie było w całości (LT, NL, SE, ES), i telefonów nie wpisuje",
    async uruchom({ db }) {
      return uzupelnijDanePartnerow(db);
    },
  },
  {
    id: "2026-10-13-partnerzy-numery-vat-adtyres",
    opis: "partnerzy B2B: dopełnienie numerów VAT UE spółki Adtyres wg kraju (LT, NL i pozostałe, które były nieczytelne na pierwszym zrzucie) — uzupełnia tylko puste pola, niczego nie nadpisuje",
    async uruchom({ db }) {
      return uzupelnijDanePartnerow(db);
    },
  },
  {
    id: "2026-10-13-partnerzy-katalogi-trackingu",
    tylkoProdukcja: true, // środowisko testowe działa na tym samym serwerze plików — nie może pisać do katalogów partnerów
    opis: "partnerzy B2B: zapis plików trackingu do katalogów partnerów — ustawia PARTNERZY_KATALOGI_TRACKINGU w .env produkcji, wyprowadzone z PARTNERZY_KATALOGI_ZAMOWIEN (tylko istniejące katalogi; nie nadpisuje istniejącej wartości)",
    async uruchom({ env }) {
      if (env.PARTNERZY_KATALOGI_TRACKINGU?.trim()) return "PARTNERZY_KATALOGI_TRACKINGU jest już ustawione — bez zmian";
      const dbPath = env.DB_PATH as string | undefined;
      const sciezka = (env.PLIK_ENV as string | undefined) || (dbPath ? join(dirname(dbPath), "..", ".env") : "");
      if (!sciezka) return { odloz: "brak DB_PATH — nie wiem, gdzie jest .env" };
      if (!env.PARTNERZY_KATALOGI_ZAMOWIEN?.trim()) return { odloz: "brak PARTNERZY_KATALOGI_ZAMOWIEN w .env — wpisz tę zmienną (katalogi zamówień partnerów), a katalogi trackingu zostaną z niej wyprowadzone przy następnym wdrożeniu" };
      const w = wyprowadzKatalogiTrackingu(env.PARTNERZY_KATALOGI_ZAMOWIEN);
      if (!w.wartosc) return { odloz: `nie ma katalogu trackingu do wpisania (${w.pominiete.join("; ")})` };
      // Wartość w cudzysłowie: skrypt wdrożenia czyta `.env` przez `source`, a średnik rozbiłby linię.
      const opis = ustawWEnvPliku(sciezka, { PARTNERZY_KATALOGI_TRACKINGU: `"${w.wartosc}"` });
      if (!opis) return { odloz: `brak pliku ${sciezka}` };
      // Log wdrożenia jest publiczny (repozytorium publiczne) — bez ścieżek serwera plików: tylko nazwy partnerów i skutek.
      const skutek = opis[0]?.match(/\((dopisano|zmieniono|bez zmian)\)$/)?.[1] ?? "ustawiono";
      return `PARTNERZY_KATALOGI_TRACKINGU (${skutek}) dla: ${w.wartosc.split(";").map((x) => x.split("=")[0]).join(", ")}${w.pominiete.length ? ` — pominięto: ${w.pominiete.join("; ")}` : ""}`;
    },
  },
  {
    id: "2026-10-13-partnerzy-narzuty-startowe",
    opis: "partnerzy B2B: narzuty startowe wg starego panelu — dopłata 5 % w krajach partnera, które mają jeszcze 0 %, oraz 7 reguł marek (Niemcy, Rolnicze: Alliance/CEAT 2 %, Vredestein 3 %); tylko uzupełnia, niczego nie nadpisuje; odkłada się, gdy nie rozpozna dostawcy w tabeli dostawców",
    async uruchom({ db }) {
      return ustawNarzutyStartowe(db);
    },
  },
  {
    id: "2026-10-14-partnerzy-zdjecie-przesylki-bazowej",
    opis: "partnerzy B2B: przesyłka liczy się wyłącznie z tabel GEIS — czyści stare wartości „przesyłki bazowej” (np. 15 EUR z konfiguracji startowej) w krajach partnerów; pole nie jest już używane w wycenie",
    async uruchom({ db }) {
      const n = db.update(partnerKraje).set({ przesylkaStalaEur: null }).where(isNotNull(partnerKraje.przesylkaStalaEur)).run().changes;
      return `wyczyszczono przesyłkę bazową w krajach: ${n}`;
    },
  },
  {
    id: "2026-10-14-partnerzy-selly-zamowienia-wlaczone",
    tylkoProdukcja: true, // środowisko testowe nie może dostać zapisu do sklepu Selly
    opis: "partnerzy B2B: włączenie „Utwórz w Selly” — PARTNERZY_SELLY_ZAMOWIENIA=true w .env produkcji (decyzja użytkowniczki 2026-10-14); zamówienie powstaje w sklepie dopiero po ręcznym kliknięciu, z podglądem; działa tylko przy SELLY_TRYB=pelny",
    async uruchom({ env }) {
      const dbPath = env.DB_PATH as string | undefined;
      const sciezka = (env.PLIK_ENV as string | undefined) || (dbPath ? join(dirname(dbPath), "..", ".env") : "");
      if (!sciezka) return { odloz: "brak DB_PATH — nie wiem, gdzie jest .env" };
      const opis = ustawWEnvPliku(sciezka, { PARTNERZY_SELLY_ZAMOWIENIA: "true" });
      if (!opis) return { odloz: `brak pliku ${sciezka}` };
      const tryb = env.SELLY_TRYB === "pelny" ? "" : ` — UWAGA: SELLY_TRYB=${env.SELLY_TRYB ?? "(brak)"}, flaga zadziała dopiero przy SELLY_TRYB=pelny`;
      return `${opis.join("; ")} — zacznie działać po restarcie backendu (wdrożenie wczytuje .env po krokach)${tryb}`;
    },
  },
];
