// Partnerzy B2B — ustawienia (karta PARTNERZY, ticket 209 / PRT-1.3).
//
// ⚠ NOWE TRASY, SPOZA PRODUKCJI I SPOZA `contract/openapi.yaml` (nowa funkcjonalność; ten sam tryb co `/api/ean-pary`
// z ticketu 168). Wszystkie za `requireAuth`. Błąd: `{error}`. Partnera się nie usuwa — tylko dezaktywuje.

import { Router, type Request, type Response } from "express";

import multer from "multer";

import type { Baza } from "../db/index.js";
import type { KlientSelly } from "../selly/klient.js";
import { parsujGeisXlsx } from "../partnerzy/geis-xlsx.js";
import { podgladKosztuPrzesylki } from "../partnerzy/podglad-przesylki.js";
import { BladTransportu, importujTabeleGeis, ustawPaliwo, type TabeleGeisJson } from "../partnerzy/transport.js";
import { listaGeis } from "../repos/partnerzy-geis.js";
import { dodajRegule, edytujRegule, listaRegul, usunRegule, walidujRegule, type DaneReguly } from "../repos/partnerzy-narzuty.js";
import { requireAuth } from "../middleware/auth.js";
import { zapiszAudyt } from "../repos/audit.js";
import { pobierzBledy, pobierzLogi } from "../partnerzy/logi.js";
import { OdbiorTrwaError, odbierzZamowieniaEmail, type OdbiorEmail } from "../partnerzy/odbior-email.js";
import { BrakKursuError, kursEur, type KlientNbp } from "../partnerzy/kurs-nbp.js";
import { BladTrackingu, dodajPrzesylke, katalogTrackinguPartnera, listaPrzesylek, zapiszPlikTrackingu, zbudujPlikTrackingu } from "../partnerzy/tracking.js";
import { powiadomOBledzieSelly } from "../partnerzy/powiadomienia.js";
import type { NadawcaEmail } from "../poczta/nadawca.js";
import { BladTworzenia, podgladDlaSelly, utworzWSelly, zwolnijWysylanie } from "../partnerzy/podglad-selly.js";
import { zwaliduj } from "../partnerzy/walidacja-zamowienia.js";
import { listaZamowien, szczegolyZamowieniaDlaPartnera } from "../repos/partnerzy-zamowienia.js";
import { walidujKolumny, walidujPola, zapiszKolumny, zapiszPola } from "../repos/partnerzy-kolumny.js";
import { GenerowanieTrwaError, type SerwisPartnerow } from "../partnerzy/scheduler.js";
import {
  czyBlad,
  dodajPartnera,
  dostepneMagazyny,
  edytujPartnera,
  listaPartnerow,
  normalizujKraj,
  szczegolyPartnera,
  ustawAktywnosc,
  ustawFakturaKraju,
  ustawKraj,
  ustawMagazyny,
  ustawWykluczenia,
  usunKraj,
  walidujListeTekstow,
  walidujFakturaKraju,
  walidujUstawieniaKraju,
  walidujUstawieniaPartnera,
} from "../repos/partnerzy.js";

export type ZaleznosciPartnerzy = { db: Baza; serwis?: SerwisPartnerow; odbiorEmail?: OdbiorEmail; klientSelly?: KlientSelly; sellyZamowienia?: boolean; klientNbp?: KlientNbp; katalogiTrackingu?: ReadonlyMap<string, string>; powiadomienia?: { nadawca: NadawcaEmail; odbiorcy: string[] } };

export function trasyPartnerzy({ db, serwis, odbiorEmail, klientSelly, sellyZamowienia = false, klientNbp, katalogiTrackingu = new Map(), powiadomienia }: ZaleznosciPartnerzy): Router {
  const router = Router();
  const wgrywanieGeis = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5_000_000 } });

  const audytuj = (req: Request, akcja: string, id: number, szczegoly?: unknown): void => {
    try {
      const user = req.user!;
      zapiszAudyt(db, { uzytkownikId: user.id, uzytkownikImie: user.imieNazwisko, akcja, encjaTyp: "partner", encjaId: id, szczegoly });
    } catch (e) {
      console.error("[partnerzy] audyt pominięty:", e instanceof Error ? e.message : e);
    }
  };
  const idZParametru = (req: Request, res: Response): number | null => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1 || szczegolyPartnera(db, id) === null) {
      res.status(404).json({ error: "Nie ma takiego partnera." });
      return null;
    }
    return id;
  };

  router.get("/api/partnerzy", requireAuth, (_req, res) => {
    res.json({ partnerzy: listaPartnerow(db) });
  });

  /** Magazyny katalogu do wyboru w panelu. MUSI stać przed `/api/partnerzy/:id`, inaczej „magazyny” zostałoby wzięte za id. */
  router.get("/api/partnerzy/magazyny", requireAuth, (_req, res) => {
    res.json({ magazyny: dostepneMagazyny(db) });
  });

  /**
   * Aktualny kurs EUR z NBP do podglądu w panelu (ticket 250) — ten sam mechanizm co przy generowaniu cennika (`kursEur`: ostatnio opublikowana tabela A,
   * przy awarii NBP ostatni zapisany kurs + ostrzeżenie). Zapisuje kurs w `kursy_nbp`, nic poza tym. MUSI stać przed `/api/partnerzy/:id`.
   */
  router.get("/api/partnerzy/kurs-nbp", requireAuth, async (_req, res) => {
    if (!klientNbp) return void res.status(503).json({ error: "Klient NBP nie jest dostępny w tej instancji." });
    try {
      const k = await kursEur(db, klientNbp, { kursZrodlo: "nbp", kursReczny: null });
      res.json({ kurs: k.kurs, zrodlo: k.zrodlo, dataTabeli: k.dataTabeli, ostrzezenie: k.ostrzezenie });
    } catch (e) {
      if (e instanceof BrakKursuError) return void res.status(502).json({ error: e.message });
      throw e;
    }
  });

  /**
   * Słowniki zamówień Selly (statusy, formy płatności, formy dostawy) — TYLKO ODCZYT, do wyboru identyfikatorów przed tworzeniem zamówień w Selly
   * (ticket 240). MUSI stać przed `/api/partnerzy/:id`. 503 bez klienta Selly; błąd Selly → 502 z komunikatem (bez sekretów).
   */
  router.get("/api/partnerzy/selly/slowniki-zamowien", requireAuth, async (_req, res) => {
    if (!klientSelly) return void res.status(503).json({ error: "Klient Selly nie jest dostępny w tej instancji." });
    try {
      const [statusy, platnosci, dostawy, vat] = await Promise.all([klientSelly.listOrderStatuses(), klientSelly.listOrderPayments(), klientSelly.listOrderDeliveries(), klientSelly.listVatRates()]);
      res.json({ statusy: statusy?.data ?? [], platnosci: platnosci?.data ?? [], dostawy: dostawy?.data ?? [], vat: vat?.data ?? [] });
    } catch (e) {
      console.error("[partnerzy] słowniki zamówień Selly:", e instanceof Error ? e.message : e);
      res.status(502).json({ error: e instanceof Error ? e.message : "Nie udało się pobrać słowników z Selly." });
    }
  });

  /**
   * Jedno ostatnie zamówienie ze sklepu Selly, bez interpretacji (ticket 248) — TYLKO ODCZYT. Służy do poznania kształtu zamówienia przed `POST /api/orders`.
   * MUSI stać przed `/api/partnerzy/:id`. Zawiera dane klienta sklepu — tylko dla zalogowanych, nie logujemy treści.
   */
  router.get("/api/partnerzy/selly/przykladowe-zamowienie", requireAuth, async (_req, res) => {
    if (!klientSelly) return void res.status(503).json({ error: "Klient Selly nie jest dostępny w tej instancji." });
    try {
      const odp = await klientSelly.listOrders({ limit: 1 });
      res.json({ zamowienie: odp?.data?.[0] ?? null });
    } catch (e) {
      console.error("[partnerzy] przykładowe zamówienie Selly:", e instanceof Error ? e.message : e);
      res.status(502).json({ error: e instanceof Error ? e.message : "Nie udało się pobrać zamówienia z Selly." });
    }
  });

  /**
   * Tabele transportowe GEIS (ticket 244): podgląd (`GET`), edycja jednego kraju (`PUT`, ciało = `{wspGabarytowy, kosztPakowania, maks, stawki}`) i import z arkusza
   * Excel (`POST /import`, pole `plik`). Stawka = kolumna „1” (cały kraj). MUSZĄ stać przed `/api/partnerzy/:id`.
   */
  router.get("/api/partnerzy/geis", requireAuth, (_req, res) => {
    res.json({ kraje: listaGeis(db) });
  });

  router.put("/api/partnerzy/geis/:kraj", requireAuth, (req, res) => {
    const kraj = normalizujKraj(req.params.kraj);
    if (kraj === null) return void res.status(400).json({ error: "Kraj musi być dwuliterowym kodem (np. FR)." });
    try {
      importujTabeleGeis(db, { [kraj]: req.body as TabeleGeisJson[string] });
    } catch (e) {
      if (e instanceof BladTransportu) return void res.status(400).json({ error: e.message });
      throw e;
    }
    audytuj(req, "partner_geis_edycja", 0, { kraj });
    res.json({ kraje: listaGeis(db) });
  });

  /**
   * Podgląd kosztu przesyłki (ticket 246): `{partnerId, kraj, waga, dlugosc, szerokosc, wysokosc}` (cm, kg) → rozbicie kosztu w EUR.
   * 400 z komunikatem, gdy nie da się policzyć (brak tabeli kraju, wymiary ponad limit, waga ponad najwyższy próg).
   */
  /** Wiadomość próbna na adresy powiadomień (ticket 263) — do sprawdzenia, że SMTP i adres odbiorcy działają. 503 = powiadomienia nie są skonfigurowane. */
  router.post("/api/partnerzy/powiadomienia/test", requireAuth, async (_req, res) => {
    if (!powiadomienia || powiadomienia.odbiorcy.length === 0) return void res.status(503).json({ error: "Powiadomienia e-mail nie są skonfigurowane na serwerze (SMTP_* i POWIADOMIENIA_PARTNERZY_DO)." });
    try {
      await powiadomienia.nadawca.wyslij({ do: powiadomienia.odbiorcy, temat: "Bridge: wiadomość próbna", tekst: "To wiadomość próbna z Bridge. Jeśli ją widzisz, powiadomienia o błędach zamówień partnerów będą dochodzić na ten adres." });
      res.json({ wyslano: powiadomienia.odbiorcy.length });
    } catch (e) {
      res.status(502).json({ error: `Nie udało się wysłać wiadomości: ${e instanceof Error ? e.message : String(e)}` });
    }
  });

  router.post("/api/partnerzy/geis/podglad-kosztu", requireAuth, (req, res) => {
    const c = (req.body ?? {}) as Record<string, unknown>;
    const partnerId = Number(c.partnerId);
    const kraj = normalizujKraj(c.kraj);
    const liczba = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
    if (!Number.isInteger(partnerId) || szczegolyPartnera(db, partnerId) === null) return void res.status(404).json({ error: "Nie ma takiego partnera." });
    if (kraj === null) return void res.status(400).json({ error: "Kraj musi być dwuliterowym kodem (np. FR)." });
    try {
      const wynik = podgladKosztuPrzesylki(
        db,
        partnerId,
        kraj,
        { waga: liczba(c.waga), dlugosc: liczba(c.dlugosc), szerokosc: liczba(c.szerokosc), wysokosc: liczba(c.wysokosc) },
        new Date().toISOString().slice(0, 10),
      );
      res.json(wynik);
    } catch (e) {
      if (e instanceof BladTransportu || e instanceof Error) return void res.status(400).json({ error: e.message });
      throw e;
    }
  });

  router.post("/api/partnerzy/geis/import", requireAuth, (req, res, next) => {
    wgrywanieGeis.single("plik")(req, res, (e: unknown) => {
      if (e instanceof multer.MulterError) return void res.status(400).json({ error: e.code === "LIMIT_FILE_SIZE" ? "Plik większy niż 5 MB." : "Niepoprawny upload." });
      if (e) return next(e);
      if (!req.file) return void res.status(400).json({ error: "Brak pliku (pole `plik`)." });
      try {
        const { dane, ostrzezenia } = parsujGeisXlsx(req.file.buffer);
        const liczba = importujTabeleGeis(db, dane);
        audytuj(req, "partner_geis_import", 0, { kraje: Object.keys(dane), ostrzezenia: ostrzezenia.length });
        res.json({ zaimportowano: liczba, kraje: Object.keys(dane).sort(), ostrzezenia });
      } catch (err) {
        if (err instanceof BladTransportu || err instanceof Error) return void res.status(400).json({ error: err.message });
        next(err);
      }
    });
  });

  /** Reguła zawężona do kraju, którego partner nie ma, nigdy by nie zadziałała — odrzucamy ją zamiast cicho ignorować. */
  const krajSpozaPartnera = (partnerId: number, kraj: string | null | undefined): boolean =>
    typeof kraj === "string" && !szczegolyPartnera(db, partnerId)!.kraje.some((k) => k.kraj === kraj);

  // Reguły narzutów partnera (ticket 247). Zasada jak w „narzutach i promocjach” sklepu, osobne dane; brak pasującej reguły = narzut kraju.
  router.get("/api/partnerzy/:id/narzuty", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id !== null) res.json({ reguly: listaRegul(db, id) });
  });

  router.post("/api/partnerzy/:id/narzuty", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    const d = walidujRegule(req.body, false);
    if ("blad" in d) return void res.status(400).json({ error: d.blad });
    if (krajSpozaPartnera(id, d.kraj)) return void res.status(400).json({ error: `Partner nie ma kraju ${d.kraj} — dodaj go najpierw w tabeli krajów.` });
    const regula = dodajRegule(db, id, d as DaneReguly);
    audytuj(req, "partner_narzut_dodany", id, { regulaId: regula.id, nazwa: regula.nazwa, wartosc: regula.wartosc });
    res.status(201).json(regula);
  });

  router.patch("/api/partnerzy/:id/narzuty/:regulaId", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    const d = walidujRegule(req.body, true);
    if ("blad" in d) return void res.status(400).json({ error: d.blad });
    const regulaId = Number(req.params.regulaId);
    if (!Number.isInteger(regulaId)) return void res.status(404).json({ error: "Partner nie ma takiej reguły." });
    if (krajSpozaPartnera(id, d.kraj)) return void res.status(400).json({ error: `Partner nie ma kraju ${d.kraj} — dodaj go najpierw w tabeli krajów.` });
    const regula = edytujRegule(db, id, regulaId, d);
    if (!regula) return void res.status(404).json({ error: "Partner nie ma takiej reguły." });
    audytuj(req, "partner_narzut_zmieniony", id, { regulaId: regula.id, ...d });
    res.json(regula);
  });

  router.delete("/api/partnerzy/:id/narzuty/:regulaId", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    if (!Number.isInteger(Number(req.params.regulaId)) || !usunRegule(db, id, Number(req.params.regulaId))) return void res.status(404).json({ error: "Partner nie ma takiej reguły." });
    audytuj(req, "partner_narzut_usuniety", id, { regulaId: Number(req.params.regulaId) });
    res.json({ ok: true });
  });

  router.get("/api/partnerzy/:id", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id !== null) res.json(szczegolyPartnera(db, id));
  });

  const stronicowanie = (req: Request): { limit: number; offset: number } => ({
    // `Math.floor`: niecałkowite `limit=1.5` wywracałoby SQLite (500) — dotyczy też tras logów.
    limit: Math.min(Math.max(Math.floor(Number(req.query.limit)) || 100, 1), 1000),
    offset: Math.max(Math.floor(Number(req.query.offset)) || 0, 0),
  });

  /** Log operacji (jedna linia na operację), najnowsze pierwsze; `limit` (domyślnie 100, max 1000) i `offset`. */
  router.get("/api/partnerzy/:id/logi", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    const { limit, offset } = stronicowanie(req);
    res.json({ logi: pobierzLogi(db, id, limit, offset) });
  });

  /** Log błędów i ostrzeżeń ze szczegółami; opcjonalnie `?poziom=blad|ostrzezenie`. */
  router.get("/api/partnerzy/:id/error-log", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    const poziom = req.query.poziom === "blad" || req.query.poziom === "ostrzezenie" ? req.query.poziom : undefined;
    const { limit, offset } = stronicowanie(req);
    res.json({ bledy: pobierzBledy(db, id, limit, offset, poziom) });
  });

  /** Zamówienia odebrane od partnera (ticket 230, tylko odczyt), najnowsze pobrane pierwsze; `limit` (domyślnie 100, max 1000) i `offset`. Bez surowego XML. */
  router.get("/api/partnerzy/:id/zamowienia", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    const { limit, offset } = stronicowanie(req);
    res.json({ zamowienia: listaZamowien(db, id, limit, offset) });
  });

  /** Szczegóły zamówienia partnera: pozycje, dostawa, faktura. 404, gdy zamówienie nie należy do tego partnera. */
  router.get("/api/partnerzy/:id/zamowienia/:zamowienieId", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    const zamowienieId = Number(req.params.zamowienieId);
    const z = Number.isInteger(zamowienieId) && zamowienieId > 0 ? szczegolyZamowieniaDlaPartnera(db, id, zamowienieId) : null;
    if (z === null) return void res.status(404).json({ error: "Nie ma takiego zamówienia tego partnera." });
    res.json(z);
  });

  /** Podgląd tego, co poszłoby do Selly (ticket 248): zamawiający, dostawa, pozycje dopasowane do katalogu i blokady. Tylko odczyt. */
  router.get("/api/partnerzy/:id/zamowienia/:zamowienieId/podglad-selly", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    const zamowienieId = Number(req.params.zamowienieId);
    const podglad = Number.isInteger(zamowienieId) && zamowienieId > 0 ? podgladDlaSelly(db, id, zamowienieId, sellyZamowienia) : null;
    if (podglad === null) return void res.status(404).json({ error: "Nie ma takiego zamówienia tego partnera." });
    res.json(podglad);
  });

  /**
   * Tracking (ticket 256): przesyłki zamówienia partnera. Wpisanie numeru listu przewozowego tworzy plik trackingu (CSV, format wg założenia użytkowniczki — `partnerzy/tracking.ts`)
   * i od razu zapisuje go w katalogu partnera z `PARTNERZY_KATALOGI_TRACKINGU`; bez katalogu plik zostaje do pobrania w panelu. Błąd zapisu pliku NIE cofa przesyłki — widać go przy przesyłce i można ponowić.
   */
  const przesylkaParam = (req: Request, res: Response): { id: number; zamowienieId: number } | null => {
    const id = idZParametru(req, res);
    if (id === null) return null;
    const zamowienieId = Number(req.params.zamowienieId);
    if (!Number.isInteger(zamowienieId) || zamowienieId < 1) {
      res.status(404).json({ error: "Nie ma takiego zamówienia tego partnera." });
      return null;
    }
    return { id, zamowienieId };
  };
  const bladTrackingu = (e: unknown, res: Response): void => {
    if (e instanceof BladTrackingu) return void res.status(e.status).json({ error: e.message });
    throw e;
  };

  router.get("/api/partnerzy/:id/zamowienia/:zamowienieId/przesylki", requireAuth, (req, res) => {
    const p = przesylkaParam(req, res);
    if (!p) return;
    const lista = listaPrzesylek(db, p.id, p.zamowienieId);
    if (lista === null) return void res.status(404).json({ error: "Nie ma takiego zamówienia tego partnera." });
    res.json({ przesylki: lista, katalogSkonfigurowany: katalogTrackinguPartnera(db, p.id, katalogiTrackingu) !== undefined });
  });

  router.post("/api/partnerzy/:id/zamowienia/:zamowienieId/przesylki", requireAuth, (req, res) => {
    const p = przesylkaParam(req, res);
    if (!p) return;
    try {
      const wysylkaId = dodajPrzesylke(db, p.id, p.zamowienieId, (req.body ?? {}) as never);
      const status = zapiszPlikTrackingu(db, wysylkaId, katalogTrackinguPartnera(db, p.id, katalogiTrackingu));
      audytuj(req, "partner_przesylka", p.id, { zamowienieId: p.zamowienieId, wysylkaId, plik: status });
      res.json({ przesylki: listaPrzesylek(db, p.id, p.zamowienieId), plik: status });
    } catch (e) {
      bladTrackingu(e, res);
    }
  });

  router.get("/api/partnerzy/:id/zamowienia/:zamowienieId/przesylki/:wysylkaId/plik", requireAuth, (req, res) => {
    const p = przesylkaParam(req, res);
    if (!p) return;
    const wysylkaId = Number(req.params.wysylkaId);
    try {
      const lista = listaPrzesylek(db, p.id, p.zamowienieId);
      if (lista === null || !Number.isInteger(wysylkaId) || !lista.some((w) => w.id === wysylkaId)) return void res.status(404).json({ error: "Nie ma takiej przesyłki tego zamówienia." });
      res.json(zbudujPlikTrackingu(db, wysylkaId));
    } catch (e) {
      bladTrackingu(e, res);
    }
  });

  router.post("/api/partnerzy/:id/zamowienia/:zamowienieId/przesylki/:wysylkaId/ponow", requireAuth, (req, res) => {
    const p = przesylkaParam(req, res);
    if (!p) return;
    const wysylkaId = Number(req.params.wysylkaId);
    try {
      const lista = listaPrzesylek(db, p.id, p.zamowienieId);
      if (lista === null || !Number.isInteger(wysylkaId) || !lista.some((w) => w.id === wysylkaId)) return void res.status(404).json({ error: "Nie ma takiej przesyłki tego zamówienia." });
      const status = zapiszPlikTrackingu(db, wysylkaId, katalogTrackinguPartnera(db, p.id, katalogiTrackingu));
      audytuj(req, "partner_przesylka_ponow", p.id, { zamowienieId: p.zamowienieId, wysylkaId, plik: status });
      res.json({ przesylki: listaPrzesylek(db, p.id, p.zamowienieId), plik: status });
    } catch (e) {
      bladTrackingu(e, res);
    }
  });

  /**
   * Ręczne utworzenie zamówienia partnera w Selly (ticket 249). Tylko z flagą `PARTNERZY_SELLY_ZAMOWIENIA`, bez blokad podglądu i w statusie `przyjete`;
   * 403 (flaga), 404, 409 (blokady/zmiana statusu), 502 (odmowa Selly), 503 (brak klienta). Odpowiedź: `{numerWlasny, idSelly}`.
   */
  router.post("/api/partnerzy/:id/zamowienia/:zamowienieId/utworz-w-selly", requireAuth, async (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    if (!klientSelly) return void res.status(503).json({ error: "Klient Selly nie jest dostępny w tej instancji." });
    const zamowienieId = Number(req.params.zamowienieId);
    if (!Number.isInteger(zamowienieId) || zamowienieId < 1) return void res.status(404).json({ error: "Nie ma takiego zamówienia tego partnera." });
    try {
      const wynik = await utworzWSelly(db, klientSelly, id, zamowienieId, sellyZamowienia);
      audytuj(req, "partner_zamowienie_utworz_w_selly", id, { zamowienieId, numerWlasny: wynik.numerWlasny });
      res.json(wynik);
    } catch (e) {
      if (e instanceof BladTworzenia) {
        audytuj(req, "partner_zamowienie_utworz_w_selly_blad", id, { zamowienieId, status: e.status }); // bez treści błędu (może zawierać dane sklepu)
        // 502 = Selly odrzuciło zamówienie albo nie wiadomo, czy je przyjęło; 403/404/409 to blokady widoczne od razu w panelu — bez e-maila.
        if (e.status === 502 && powiadomienia) void powiadomOBledzieSelly(db, powiadomienia.nadawca, powiadomienia.odbiorcy, { partnerId: id, zamowienieId, powod: e.message }, console.error);
        return void res.status(e.status).json({ error: e.message });
      }
      throw e;
    }
  });

  /** Zwolnienie zamówienia zablokowanego w `wysylanie` — po RĘCZNYM sprawdzeniu w Selly, że zamówienie nie powstało (ticket 249). */
  router.post("/api/partnerzy/:id/zamowienia/:zamowienieId/zwolnij-wysylanie", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    const zamowienieId = Number(req.params.zamowienieId);
    if (!Number.isInteger(zamowienieId) || zamowienieId < 1) return void res.status(404).json({ error: "Nie ma takiego zamówienia tego partnera." });
    try {
      zwolnijWysylanie(db, id, zamowienieId);
    } catch (e) {
      if (e instanceof BladTworzenia) return void res.status(e.status).json({ error: e.message });
      throw e;
    }
    audytuj(req, "partner_zamowienie_zwolnij_wysylanie", id, { zamowienieId });
    res.json({ ok: true });
  });

  /**
   * Ponowna walidacja zamówienia względem katalogu (ticket 232) — po poprawieniu katalogu człowiek ponawia sprawdzenie zamówienia z `blad_importu`.
   * Tyka tylko statusów `nowe`/`przyjete`/`blad_importu`; zwraca świeże szczegóły zamówienia. Nic nie wysyła do partnera.
   */
  router.post("/api/partnerzy/:id/zamowienia/:zamowienieId/waliduj", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    const zamowienieId = Number(req.params.zamowienieId);
    const obecne = Number.isInteger(zamowienieId) && zamowienieId >= 1 ? szczegolyZamowieniaDlaPartnera(db, id, zamowienieId) : null;
    if (obecne === null) return void res.status(404).json({ error: "Nie ma takiego zamówienia tego partnera." });
    if (!obecne.mozeWalidowac) {
      return void res.status(409).json({ error: `Zamówienie ma status „${obecne.status}” i nie podlega ponownej walidacji.` });
    }
    const wynik = zwaliduj(db, zamowienieId);
    audytuj(req, "partner_zamowienie_waliduj", id, { zamowienieId, status: wynik?.status, bledy: wynik?.bledy });
    res.json(szczegolyZamowieniaDlaPartnera(db, id, zamowienieId));
  });

  /**
   * Ręczny odbiór zamówień z e-maila partnera (ticket 231) — działa też przy wyłączonym harmonogramie i dla partnera nieaktywnego, do testów kanału.
   * 200 + wynik (także gdy nic nie odebrano: `polaczono:false` i `powod`, np. brak zmiennej w `.env`); 409 bez kanału e-mail lub gdy odbiór trwa; 503 bez wstrzykniętego odbioru.
   */
  router.post("/api/partnerzy/:id/zamowienia/odbierz", requireAuth, async (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    if (!odbiorEmail) return void res.status(503).json({ error: "Odbiór zamówień z e-maila nie jest dostępny w tej instancji." });
    const partner = szczegolyPartnera(db, id);
    if (!partner?.kanalEmail || !partner.emailSkrzynka) {
      return void res.status(409).json({ error: "Partner nie ma włączonego kanału e-mail albo adresu skrzynki — ustaw je w konfiguracji." });
    }
    try {
      const wynik = await odbierzZamowieniaEmail(db, odbiorEmail.otworz, id, odbiorEmail.ustawienia);
      audytuj(req, "partner_odbior_reczny", id, { polaczono: wynik.polaczono, wiadomosci: wynik.wiadomosci, nowe: wynik.nowe, bledy: wynik.bledy });
      res.json(wynik);
    } catch (e) {
      if (e instanceof OdbiorTrwaError) return void res.status(409).json({ error: "Odbiór zamówień dla tego partnera już trwa — spróbuj za chwilę." });
      console.error("[partnerzy] odbiór ręczny nieudany:", e instanceof Error ? e.message : e);
      res.status(500).json({ error: "Odbiór zamówień nie powiódł się — szczegóły w logach błędów partnera." });
    }
  });

  /** Ręczne „generuj teraz” (też dla partnera nieaktywnego). Zwraca wynik generowania: pliki, błędy, ostrzeżenia. */
  router.post("/api/partnerzy/:id/generuj", requireAuth, async (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    if (!serwis) return void res.status(503).json({ error: "Generowanie plików partnerów nie jest skonfigurowane na tym serwerze." });
    try {
      const wynik = await serwis.generujTeraz(id);
      audytuj(req, "partner_generowanie_reczne", id, { pliki: wynik.pliki.map((p) => p.nazwa), bledy: wynik.bledy.length });
      res.json(wynik);
    } catch (e) {
      if (e instanceof GenerowanieTrwaError) return void res.status(409).json({ error: e.message });
      console.error("[partnerzy] ręczne generowanie nie powiodło się:", e instanceof Error ? e.message : e);
      res.status(500).json({ error: "Generowanie nie powiodło się — szczegóły w logu błędów partnera." });
    }
  });

  router.post("/api/partnerzy", requireAuth, (req, res) => {
    const u = walidujUstawieniaPartnera(req.body, false);
    if (czyBlad(u)) return void res.status(400).json({ error: u.blad });
    const id = dodajPartnera(db, u as Parameters<typeof dodajPartnera>[1]);
    if (id === null) return void res.status(409).json({ error: "Partner o tej nazwie już istnieje." });
    audytuj(req, "partner_dodany", id, u);
    res.status(201).json(szczegolyPartnera(db, id));
  });

  router.put("/api/partnerzy/:id", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    const u = walidujUstawieniaPartnera(req.body, true);
    if (czyBlad(u)) return void res.status(400).json({ error: u.blad });
    if (edytujPartnera(db, id, u) === "nazwa-zajeta")
      return void res.status(409).json({ error: "Partner o tej nazwie już istnieje." });
    audytuj(req, "partner_zmieniony", id, u);
    res.json(szczegolyPartnera(db, id));
  });

  /** Aktywacja i dezaktywacja bez usuwania: `{aktywny: boolean}`. */
  router.put("/api/partnerzy/:id/aktywny", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    const aktywny = (req.body as { aktywny?: unknown } | undefined)?.aktywny;
    if (typeof aktywny !== "boolean") return void res.status(400).json({ error: "Pole `aktywny` musi być wartością logiczną." });
    ustawAktywnosc(db, id, aktywny);
    audytuj(req, aktywny ? "partner_aktywowany" : "partner_dezaktywowany", id);
    res.json(szczegolyPartnera(db, id));
  });

  router.put("/api/partnerzy/:id/magazyny", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    const l = walidujListeTekstow((req.body as { magazyny?: unknown } | undefined)?.magazyny, "magazyny");
    if (czyBlad(l)) return void res.status(400).json({ error: l.blad });
    ustawMagazyny(db, id, l);
    audytuj(req, "partner_magazyny", id, { magazyny: l });
    res.json(szczegolyPartnera(db, id));
  });

  router.put("/api/partnerzy/:id/wykluczenia", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    const l = walidujListeTekstow((req.body as { kody?: unknown } | undefined)?.kody, "kody");
    if (czyBlad(l)) return void res.status(400).json({ error: l.blad });
    ustawWykluczenia(db, id, l);
    audytuj(req, "partner_wykluczenia", id, { liczba: l.length });
    res.json(szczegolyPartnera(db, id));
  });

  /** Dodaje albo nadpisuje kraj (np. `PUT /api/partnerzy/1/kraje/FR`). */
  /** Zastępuje pola obliczeniowe `{pola: [{nazwa, formula}]}`; błędy formuł z pozycją znaku w `bledy`. */
  router.put("/api/partnerzy/:id/pola-obliczeniowe", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    const w = walidujPola(db, id, (req.body as { pola?: unknown } | undefined)?.pola);
    if ("blad" in w) return void res.status(400).json({ error: w.blad, bledy: w.bledy ?? [] });
    const odmowa = zapiszPola(db, id, w.pola);
    if (odmowa) return void res.status(409).json({ error: odmowa.blad });
    audytuj(req, "partner_pola_obliczeniowe", id, { liczba: w.pola.length });
    res.json(szczegolyPartnera(db, id));
  });

  /** Zastępuje kolumny pliku `{kolumny: [{nazwaWPliku, zrodloTyp: katalog|cena|pole, zrodlo}]}`; kolejność tablicy = kolejność kolumn. */
  router.put("/api/partnerzy/:id/kolumny", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    const w = walidujKolumny(db, id, (req.body as { kolumny?: unknown } | undefined)?.kolumny);
    if ("blad" in w) return void res.status(400).json({ error: w.blad });
    zapiszKolumny(db, id, w.kolumny);
    audytuj(req, "partner_kolumny", id, { liczba: w.kolumny.length });
    res.json(szczegolyPartnera(db, id));
  });

  /** Podgląd pliku bez zapisu: pierwsze pozycje, tekst CSV/XML, błędy i ostrzeżenia. */
  router.post("/api/partnerzy/:id/podglad", requireAuth, async (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    if (!serwis) return void res.status(503).json({ error: "Podgląd plików partnerów nie jest skonfigurowany na tym serwerze." });
    try {
      res.json(await serwis.podglad(id));
    } catch (e) {
      console.error("[partnerzy] podgląd nie powiódł się:", e instanceof Error ? e.message : e);
      res.status(500).json({ error: "Podgląd nie powiódł się." });
    }
  });

  /** Symulacja ceny na prawdziwych produktach z rozbiciem składników (ticket 273): `{kraj, kody?, limit?}`; tylko odczyt. */
  router.post("/api/partnerzy/:id/symulacja-ceny", requireAuth, async (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    if (!serwis) return void res.status(503).json({ error: "Symulacja ceny nie jest skonfigurowana na tym serwerze." });
    const cialo = (req.body ?? {}) as { kraj?: unknown; kody?: unknown; limit?: unknown };
    if (typeof cialo.kraj !== "string" || !/^[A-Za-z]{2}$/.test(cialo.kraj.trim())) return void res.status(400).json({ error: "Podaj kraj (dwuliterowy kod, np. DE)." });
    const kody = Array.isArray(cialo.kody) ? cialo.kody.filter((k): k is string => typeof k === "string").slice(0, 50) : undefined;
    const limit = typeof cialo.limit === "number" && Number.isFinite(cialo.limit) ? cialo.limit : undefined;
    try {
      res.json(await serwis.symulujCeny(id, { kraj: cialo.kraj, kody, limit }));
    } catch (e) {
      const komunikat = e instanceof Error ? e.message : "";
      if (/nie ma kraju|Nie ma partnera/i.test(komunikat)) return void res.status(404).json({ error: komunikat });
      console.error("[partnerzy] symulacja ceny nie powiodła się:", komunikat);
      res.status(500).json({ error: "Symulacja ceny nie powiodła się." });
    }
  });

  /** Pobranie PEŁNEGO pliku partnera z podglądu (ticket 260): `?nazwa=<plik z podglądu>`; bez zapisu na dysk i bez wysyłki. */
  router.get("/api/partnerzy/:id/podglad/plik", requireAuth, async (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    if (!serwis) return void res.status(503).json({ error: "Podgląd plików partnerów nie jest skonfigurowany na tym serwerze." });
    const nazwa = typeof req.query.nazwa === "string" ? req.query.nazwa : "";
    if (!/^[A-Za-z0-9._-]{1,120}$/.test(nazwa)) return void res.status(400).json({ error: "Brak poprawnej nazwy pliku (`nazwa`)." });
    try {
      const plik = await serwis.pelnyPlik(id, nazwa);
      if (!plik) return void res.status(404).json({ error: "Partner nie ma takiego pliku (sprawdź nazwę w podglądzie)." });
      res.setHeader("Content-Type", plik.nazwa.endsWith(".xml") ? "application/xml; charset=utf-8" : "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${plik.nazwa}"`);
      res.send(plik.tekst);
    } catch (e) {
      console.error("[partnerzy] pobranie pliku nie powiodło się:", e instanceof Error ? e.message : e);
      res.status(500).json({ error: "Pobranie pliku nie powiodło się." });
    }
  });

  router.put("/api/partnerzy/:id/kraje/:kraj", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    const kraj = normalizujKraj(req.params.kraj);
    if (kraj === null) return void res.status(400).json({ error: "Kraj musi być dwuliterowym kodem (np. FR)." });
    const u = walidujUstawieniaKraju(req.body);
    if (czyBlad(u)) return void res.status(400).json({ error: u.blad });
    const { paliwoProc, ...ustawienia } = u;
    ustawKraj(db, id, kraj, ustawienia);
    // Opłata paliwowa: nowy okres od dziś (historia, zmiana nie przelicza wstecz) — tylko gdy podana.
    if (paliwoProc !== null) ustawPaliwo(db, kraj, paliwoProc, new Date().toISOString().slice(0, 10));
    audytuj(req, "partner_kraj", id, { kraj, ...u });
    res.json(szczegolyPartnera(db, id));
  });

  /** Dane do faktury dla zamówień z danym krajem dostawy (ticket 252). Puste pola = dane domyślne partnera. 404, gdy partner nie ma takiego kraju. */
  router.put("/api/partnerzy/:id/kraje/:kraj/faktura", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    const kraj = normalizujKraj(req.params.kraj);
    if (kraj === null) return void res.status(400).json({ error: "Kraj musi być dwuliterowym kodem (np. FR)." });
    const f = walidujFakturaKraju(req.body);
    if (czyBlad(f)) return void res.status(400).json({ error: f.blad });
    if (!ustawFakturaKraju(db, id, kraj, f)) return void res.status(404).json({ error: "Partner nie ma takiego kraju." });
    audytuj(req, "partner_kraj_faktura", id, { kraj });
    res.json(szczegolyPartnera(db, id));
  });

  router.delete("/api/partnerzy/:id/kraje/:kraj", requireAuth, (req, res) => {
    const id = idZParametru(req, res);
    if (id === null) return;
    const kraj = normalizujKraj(req.params.kraj);
    if (kraj === null || !usunKraj(db, id, kraj)) return void res.status(404).json({ error: "Partner nie ma takiego kraju." });
    audytuj(req, "partner_kraj_usuniety", id, { kraj });
    res.json(szczegolyPartnera(db, id));
  });

  return router;
}
