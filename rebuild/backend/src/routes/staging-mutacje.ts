// Staging — MUTACJE. Sześć tras, którymi człowiek rozstrzyga to, czego import nie zatwierdził
// sam: `accept`, `reject`, `clear`, `import`, `PUT /{id}`, `DELETE /{id}`.
//
// Osobny plik od `staging.ts` (odczyt), bo to inny rodzaj kodu i inna sesja odbudowy —
// odczyt przyszedł w 3b, mutacje w 3d-2. Rejestrowane są w `app.ts` obok siebie.

import { Router } from "express";

import type { Baza } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { zapiszAudyt } from "../repos/audit.js";
import { dostawcaPoKodzie, zapiszWynikImportu } from "../repos/suppliers.js";
import { pozycjaStaginguPoId, zaktualizujPozycjeStagingu } from "../repos/staging.js";
import { zapiszPoprawke } from "../repos/overrides.js";
import {
  idPozycjiZFiltrow,
  odrzucPozycjeStagingu,
  wyczyscStaging,
  zatwierdzPozycjeStagingu,
} from "../import/akceptacja.js";
import { skanujNoweWartosci } from "../repos/atrybuty-pending.js";
import { PustyImportBlad, silnikStagingu, type SilnikStagingu } from "../import/tk.js";
import type { RekordSurowy } from "../import/typy.js";

export type ZaleznosciMutacjiStagingu = {
  db: Baza;
  /** Wstrzykiwany dla testów, tak samo jak w `trasyImportu`. */
  silnik?: SilnikStagingu;
};

/**
 * Pola pozycji stagingu, które wolno edytować przez `PUT /api/staging/{id}` —
 * tablica `r` z `backend-index.cjs:48596`. Cokolwiek spoza listy jest po cichu ignorowane.
 */
const POLA_EDYTOWALNE = [
  "nazwa",
  "marka",
  "model",
  "kategoria",
  "rozmiar",
  "ean",
  "cenaZakupuNowa",
  "magazyn",
];

/**
 * Mapowanie pola pozycji stagingu na nazwę pola w `manual_overrides` (`:48617`).
 *
 * ⭐ TO JEST JEDYNE MIEJSCE, KTÓRE TWORZY POPRAWKI MARTY. Edycja pozycji w stagingu nie jest
 * jednorazową korektą — zapisuje się jako trwały override, który przy KAŻDYM następnym
 * imporcie wygra z plikiem dostawcy (`Gq()` w silniku, 3d-1). Stąd `PUT` jest sercem tej
 * trasy, a nie jej dodatkiem.
 */
const POLE_NA_OVERRIDE: Record<string, string> = {
  nazwa: "nazwa",
  marka: "marka",
  model: "model",
  kategoria: "kategoria",
  rozmiar: "rozmiar",
  ean: "ean",
  cenaZakupuNowa: "cenaZakupu",
  magazyn: "magazyn",
};

/** Filtry masowej operacji `allFiltered` — wspólne dla `accept` i `reject` (`:48540`). */
type FiltryMasowe = {
  ids?: unknown;
  allFiltered?: unknown;
  typZmiany?: unknown;
  dostawca?: unknown;
  search?: unknown;
};

/**
 * Wybiera identyfikatory do operacji masowej — port `:48536-48546`, wspólny dla obu tras,
 * bo oryginał ma tam dosłownie ten sam kod dwa razy.
 */
function wybierzId(db: Baza, cialo: FiltryMasowe): number[] {
  if (cialo.allFiltered) {
    return idPozycjiZFiltrow(db, {
      typZmiany: cialo.typZmiany == null ? undefined : String(cialo.typZmiany),
      dostawca: cialo.dostawca == null ? undefined : String(cialo.dostawca),
      search: cialo.search == null ? undefined : String(cialo.search),
    });
  }
  return Array.isArray(cialo.ids) ? (cialo.ids as number[]) : [];
}

/** Szczegóły audytu operacji masowej — ten sam zestaw pól dla `accept` i `reject` (`:48551`). */
function szczegolyMasowe(cialo: FiltryMasowe, ile: number) {
  return {
    ile,
    allFiltered: Boolean(cialo.allFiltered),
    typZmiany: cialo.typZmiany ?? "all",
    dostawca: cialo.dostawca ?? null,
    search: cialo.search ?? null,
  };
}

export function trasyMutacjiStagingu({ db, silnik }: ZaleznosciMutacjiStagingu): Router {
  const router = Router();
  const uruchomImport = silnik ?? silnikStagingu(db);

  /**
   * Import pozycji podanych WPROST w ciele żądania (`:48502`).
   *
   * ⚠ To jedyna trasa, która karmi silnik rekordami spoza parsera — i dlatego jako jedyna
   * realnie uruchamia gałąź identyfikatora zastępczego `Lq()` (ścieżka plikowa jej nie
   * dotyka, bo adapter sam nadaje `kod` każdemu rekordowi).
   *
   * Bezpiecznik pustego wejścia siedzi w `tk()` (odstępstwo D7 z 3b), więc pusta tablica
   * nie dociera ani do stagingu, ani do liczników.
   */
  router.post("/api/staging/import", requireAuth, (req, res) => {
    const cialo = (req.body ?? {}) as { dostawcaKod?: unknown; dostawca?: unknown; surowe?: unknown; items?: unknown };
    const kodDostawcy = cialo.dostawcaKod ?? cialo.dostawca;
    if (!kodDostawcy) {
      return res.status(400).json({ error: "Brak kodu dostawcy (dostawcaKod)" });
    }
    const surowe = cialo.surowe ?? cialo.items ?? [];
    if (!Array.isArray(surowe)) {
      return res.status(400).json({ error: "Pole 'surowe' musi być tablicą" });
    }

    let statystyki;
    try {
      statystyki = uruchomImport(String(kodDostawcy), surowe as RekordSurowy[]);
    } catch (blad) {
      // Oryginał zwraca 500 na każdy błąd importu (`:48530`). Pusty wsad to u nas świadome
      // odstępstwo (D7) — dajemy 400, bo to błąd żądania, nie serwera.
      if (blad instanceof PustyImportBlad) {
        return res.status(400).json({ error: blad.message });
      }
      return res.status(500).json({ error: (blad as Error)?.message || "Błąd importu" });
    }

    const dostawca = dostawcaPoKodzie(db, String(kodDostawcy));
    if (dostawca) {
      // Oryginał ustawia tu ZNACZNIK CZASU jako `ostatniPlik` (`:48515`) — nie nazwę pliku,
      // bo przy tej trasie żadnego pliku nie ma. Odtwarzamy dosłownie.
      zapiszWynikImportu(db, dostawca.id, {
        ostatniPlik: new Date().toISOString(),
        liczbaProduktow: surowe.length,
      });
    }

    zapiszAudyt(db, {
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
      akcja: "import_cennika",
      encjaTyp: "dostawca",
      encjaId: String(kodDostawcy),
      szczegoly: {
        wczytanych: surowe.length,
        doStagingu: statystyki.doStagingu,
        nowe: statystyki.nowe,
        zmienione: statystyki.zmienione,
        wycofane: statystyki.wycofane,
        odrzuconeNieOpony: statystyki.odrzuconeNieOpony,
        odrzuconeBrakDanych: statystyki.odrzuconeBrakDanych,
      },
    });

    return res.json({ ok: true, ...statystyki });
  });

  /** Zatwierdzenie pozycji — pojedynczo (`ids`) albo masowo (`allFiltered`) (`:48535`). */
  router.post("/api/staging/accept", requireAuth, (req, res) => {
    const cialo = (req.body ?? {}) as FiltryMasowe;
    const identyfikatory = wybierzId(db, cialo);

    for (const id of identyfikatory) zatwierdzPozycjeStagingu(db, id, req.user!.id);

    zapiszAudyt(db, {
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
      akcja: "akceptacja_stagingu",
      encjaTyp: "staging",
      encjaId: cialo.allFiltered ? "wszystkie_filtrowane" : identyfikatory.join(","),
      szczegoly: szczegolyMasowe(cialo, identyfikatory.length),
    });

    // Wykrycie nowych wartości atrybutów po akceptacji — port hooka z Iteracji 7a
    // (`mirror/backend/pending_module.cjs:145-192`). Produkcja instaluje go monkey-patchem na
    // `router.stack` i odpala skan w `res.on('finish')` przy 2xx; tutaj wołamy go wprost.
    //
    // ODSTĘPSTWO ŚWIADOME W UMIEJSCOWIENIU (decyzja użytkownika, plan.md D2 ticketa
    // 29-FEATURE-atrybuty-backend): skan idzie PRZED odpowiedzią, nie po jej wysłaniu. Ciało
    // i kod odpowiedzi są identyczne, zmienia się tylko moment — klient dostaje odpowiedź po
    // skanie, za to kolejka pending jest spójna już w chwili, gdy front ją odpytuje.
    // Bez tego wywołania kolejka rosłaby wyłącznie z ręcznego `POST /api/atrybuty/scan-pending`.
    //
    // Błąd skanu NIE MOŻE wywrócić zaakceptowanej akceptacji — łapiemy go i logujemy,
    // dokładnie jak oryginał (`:154-156`).
    try {
      skanujNoweWartosci(db);
    } catch (e) {
      console.error("[pending] skan po /api/staging/accept:", e instanceof Error ? e.message : e);
    }

    return res.json({ ok: true, accepted: identyfikatory.length });
  });

  /** Odrzucenie pozycji — ta sama mechanika co `accept` (`:48561`). */
  router.post("/api/staging/reject", requireAuth, (req, res) => {
    const cialo = (req.body ?? {}) as FiltryMasowe;
    const identyfikatory = wybierzId(db, cialo);

    for (const id of identyfikatory) odrzucPozycjeStagingu(db, id);

    zapiszAudyt(db, {
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
      akcja: "odrzucenie_stagingu",
      encjaTyp: "staging",
      encjaId: cialo.allFiltered ? "wszystkie_filtrowane" : identyfikatory.join(","),
      szczegoly: szczegolyMasowe(cialo, identyfikatory.length),
    });

    return res.json({ ok: true, rejected: identyfikatory.length });
  });

  /** Wyczyszczenie całego stagingu (`:48592`). */
  router.post("/api/staging/clear", requireAuth, (req, res) => {
    wyczyscStaging(db);
    zapiszAudyt(db, {
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
      akcja: "czyszczenie_stagingu",
      encjaTyp: "staging",
      encjaId: "wszystkie",
      szczegoly: null,
    });
    return res.json({ ok: true });
  });

  /** Odrzucenie POJEDYNCZEJ pozycji (`:48581`). 404, gdy pozycji nie ma. */
  router.delete("/api/staging/:id", requireAuth, (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const pozycja = pozycjaStaginguPoId(db, id);
    if (!pozycja) return res.status(404).json({ error: "Nie znaleziono pozycji stagingu" });

    odrzucPozycjeStagingu(db, id);
    zapiszAudyt(db, {
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
      akcja: "odrzucenie_stagingu",
      encjaTyp: "staging",
      encjaId: String(id),
      szczegoly: { kod: pozycja.kod },
    });
    return res.json({ ok: true });
  });

  /**
   * Edycja pozycji stagingu (`:48598`) — i JEDNOCZEŚNIE zapis poprawek Marty.
   *
   * Zmiana wchodzi w trzy miejsca naraz:
   *   1. kolumny wiersza stagingu (`nazwa`, `magazyn`, `cenaZakupuNowa`),
   *   2. `snapshotJson`, z którego `acceptStaging` zbuduje potem produkt,
   *   3. `manual_overrides` — żeby następny import nie przywrócił wartości z pliku.
   *
   * ⚠ `_reason` z ciała żądania NIE jest polem pozycji — to uzasadnienie trafiające do
   * `manual_overrides.reason`. Dlatego jest wyłuskiwane przed pętlą.
   */
  router.put("/api/staging/:id", requireAuth, (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const pozycja = pozycjaStaginguPoId(db, id);
    if (!pozycja) return res.status(404).json({ error: "Nie znaleziono pozycji stagingu" });

    const { _reason: uzasadnienie, ...zmiany } = (req.body ?? {}) as Record<string, unknown>;

    let snapshot: Record<string, unknown> = {};
    if (pozycja.snapshotJson) {
      try {
        snapshot = JSON.parse(pozycja.snapshotJson) as Record<string, unknown>;
      } catch {
        // Uszkodzony snapshot nie blokuje edycji — oryginał też go połyka.
      }
    }

    const edytowanePola: string[] = pozycja.edytowanePola
      ? (JSON.parse(pozycja.edytowanePola) as string[])
      : [];
    const doZapisu: Record<string, unknown> = {};
    const teraz = new Date().toISOString();

    for (const [pole, wartosc] of Object.entries(zmiany)) {
      if (!POLA_EDYTOWALNE.includes(pole)) continue;
      if (!edytowanePola.includes(pole)) edytowanePola.push(pole);

      // Trzy pola mają odpowiednik w KOLUMNACH pozycji; reszta żyje tylko w snapshocie.
      if (pole === "cenaZakupuNowa") {
        doZapisu.cenaZakupuNowa =
          typeof wartosc === "number" ? wartosc : parseFloat(String(wartosc)) || 0;
        snapshot.cenaZakupu = doZapisu.cenaZakupuNowa;
      } else if (pole === "magazyn") {
        doZapisu.magazyn = String(wartosc ?? "");
        snapshot.magazyn = doZapisu.magazyn;
      } else if (pole === "nazwa") {
        doZapisu.nazwa = String(wartosc ?? "");
        snapshot.nazwa = doZapisu.nazwa;
      } else {
        snapshot[pole] = wartosc;
      }

      const poleOverride = POLE_NA_OVERRIDE[pole];
      if (poleOverride) {
        const wartoscOverride =
          pole === "cenaZakupuNowa"
            ? snapshot.cenaZakupu
            : pole === "magazyn"
              ? snapshot.magazyn
              : wartosc;
        // ⚠ `acknowledgedSourceValue` NIE jest tu podawane — i to jest istotne: dzięki temu
        // edycja nie kasuje potwierdzenia konfliktu zapisanego wcześniej przez akceptację
        // (patrz `zapiszPoprawke`, plan.md D5).
        zapiszPoprawke(db, {
          supplierKod: pozycja.dostawca,
          supplierProductId: pozycja.kod,
          fieldName: poleOverride,
          overrideValue: wartoscOverride == null ? "" : String(wartoscOverride),
          reason: (uzasadnienie as string | undefined) ?? "edycja w stagingu",
          createdBy: req.user!.id,
          createdAt: teraz,
        });
      }
    }

    doZapisu.snapshotJson = JSON.stringify(snapshot);
    doZapisu.edytowanePola = JSON.stringify(edytowanePola);
    const zaktualizowana = zaktualizujPozycjeStagingu(db, id, doZapisu);

    zapiszAudyt(db, {
      uzytkownikId: req.user?.id ?? null,
      uzytkownikImie: req.user?.imieNazwisko ?? null,
      akcja: "edycja_stagingu",
      encjaTyp: "staging",
      encjaId: String(id),
      szczegoly: { pola: edytowanePola },
    });

    return res.json(zaktualizowana);
  });

  return router;
}
