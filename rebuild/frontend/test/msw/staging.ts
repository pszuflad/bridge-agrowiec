/**
 * Współdzielone handlery MSW widoku `/staging` — LISTA, MUTACJE I CZTERY TRASY POLITYKI.
 *
 * ⚠ PO CO TO ISTNIEJE (CLAUDE.md, pułapka MSW). `onUnhandledRequest: "error"` NIE wywala
 * testu przy brakującym handlerze — MSW rzuca wewnątrz przechwycenia żądania, `fetch()`
 * odrzuca obietnicę, a React Query zamienia to w stan `error`. Nowe zapytanie dodane do
 * widoku, który MA już testy, przechodzi więc po cichu: testy sprawdzają wtedy stan błędu
 * zamiast danych. Handlery w JEDNYM miejscu sprawiają, że dołożenie trasy do widoku widać
 * od razu we wszystkich testach, a nie dopiero wtedy, gdy ktoś doda asercję na treść.
 *
 * ⚠ KOLEJNOŚĆ HANDLERÓW MA ZNACZENIE. `.../api/staging/:id` pasuje TAKŻE do
 * `/api/staging/paged` (dopasowuje `id = "paged"`). W obrębie jednego `server.use(...)`
 * wygrywa handler WCZEŚNIEJSZY, więc `paged` musi stać przed `:id` — i dlatego wszystko
 * wychodzi z tej funkcji jedną tablicą, a nie osobnymi wywołaniami `server.use`.
 *
 * ⭐ KARTA I15.11 NIE DOŁOŻYŁA TU ŻADNEJ TRASY (ticket 142) — i tak ma zostać. Panel
 * „Braki w cenniku" okazał się zmianą czterech ETYKIET w istniejącym filtrze i odznakach,
 * bez nowego zapytania; blokadę 409 obsługuje już `bladAkceptacji`. Jeśli kiedyś dojdzie
 * trasa, rozszerza się `OpcjeHandlerowStagingu` o kolejne pole — nie zakłada własnego pliku
 * mocków ani `server.use` w teście.
 */
import { http, HttpResponse } from "msw";

import type { PrzegladZgloszenia } from "@/pages/staging/polityka";
import { pozycjaStaginguZFixtura, stronaStaginguZFixtura } from "./kontrakt";

/** Wpis do podglądu ciał mutacji — test sprawdza na nim `ids` vs `allFiltered`. */
export type ZapisMutacji = { url: string; body: unknown };

/** Odpowiedź błędu w kształcie, jaki oddają trasy polityki: `{message}`, NIE `{error}`. */
export type OdpowiedzBledu = { status: number; cialo?: Record<string, unknown> };

export type OpcjeHandlerowStagingu = {
  /** Strona `/paged`; domyślnie prosto z `contract/fixtures/GET_staging_paged.json`. */
  strona?: Record<string, unknown>;
  /** Pozycja z `GET /api/staging/{id}`; domyślnie z `contract/fixtures/GET_staging.json`. */
  szczegol?: Record<string, unknown> | null;
  /** Materiał okna „Rozstrzygnij" — `GET /api/staging/{id}/review`. */
  przeglad?: PrzegladZgloszenia;
  /** Gdy ustawione, `review` oddaje błąd zamiast danych. */
  bladPrzegladu?: OdpowiedzBledu;
  /** Gdy ustawione, `POST /api/staging/accept` oddaje błąd — blokada polityki (409). */
  bladAkceptacji?: OdpowiedzBledu;
  /** Gdy ustawione, `POST …/resolve` oddaje błąd. */
  bladRozstrzygniecia?: OdpowiedzBledu;
  /** Gdy ustawione, `POST …/choose-absence-card` oddaje błąd. */
  bladWyboruKarty?: OdpowiedzBledu;
  /** Wołane dla każdego `GET /paged` — test zbiera na tym parametry filtrów. */
  naZapytanie?: (url: string) => void;
  /** Wołane dla każdej mutacji — test zbiera na tym ciała żądań. */
  naMutacje?: (wpis: ZapisMutacji) => void;
};

function odpowiedzBledu({ status, cialo }: OdpowiedzBledu) {
  return HttpResponse.json(cialo ?? {}, { status });
}

export function handleryStagingu(opcje: OpcjeHandlerowStagingu = {}) {
  const {
    strona = stronaStaginguZFixtura() as unknown as Record<string, unknown>,
    szczegol = null,
    przeglad,
    bladPrzegladu,
    bladAkceptacji,
    bladRozstrzygniecia,
    bladWyboruKarty,
    naZapytanie,
    naMutacje,
  } = opcje;

  const domyslnaPozycja = pozycjaStaginguZFixtura();

  const zapiszMutacje = async (request: Request) => {
    if (!naMutacje) return;
    // `DELETE /api/staging/{id}` leci bez ciała — `json()` by się wtedy wywrócił.
    const body = request.headers.get("content-type")?.includes("json")
      ? await request.clone().json()
      : null;
    naMutacje({ url: request.url, body });
  };

  return [
    // ——— trasy polityki (Staging v2) — NAJBARDZIEJ SZCZEGÓŁOWE, więc pierwsze ———
    http.get("*/api/staging/:id/review", ({ params }) => {
      if (bladPrzegladu) return odpowiedzBledu(bladPrzegladu);
      return HttpResponse.json(przeglad ?? { ...przegladDopasowania(), id: Number(params.id) });
    }),
    http.post("*/api/staging/:id/resolve", async ({ request }) => {
      await zapiszMutacje(request);
      if (bladRozstrzygniecia) return odpowiedzBledu(bladRozstrzygniecia);
      return HttpResponse.json({ ok: true, id: 999_001, kod: "MO5_NOWY" });
    }),
    http.post("*/api/staging/:id/choose-absence-card", async ({ request }) => {
      await zapiszMutacje(request);
      if (bladWyboruKarty) return odpowiedzBledu(bladWyboruKarty);
      return HttpResponse.json({ ok: true, kod: "MO5_STARY" });
    }),
    /*
      `close-absence-review` jest w backendzie i w `contract/openapi.yaml`, ale zamrożona
      produkcja (`88fa31c`) JEJ NIE WOŁA — łatka `20260923_dotchoice` usunęła przycisk
      „Pozostaw starą wstrzymaną i zamknij sprawę" (plan.md D1 ticketu 140). Handler stoi
      tu celowo: gdyby ktoś przywrócił to wywołanie, test od razu je zobaczy, zamiast
      po cichu wpaść w stan błędu.
    */
    http.post("*/api/staging/:id/close-absence-review", async ({ request }) => {
      await zapiszMutacje(request);
      return HttpResponse.json({ ok: true, kod: "MO5_STARY" });
    }),

    // ——— lista i mutacje ———
    http.get("*/api/staging/paged", ({ request }) => {
      naZapytanie?.(request.url);
      return HttpResponse.json(strona);
    }),
    http.post("*/api/staging/accept", async ({ request }) => {
      await zapiszMutacje(request);
      if (bladAkceptacji) return odpowiedzBledu(bladAkceptacji);
      return HttpResponse.json({ ok: true, accepted: 2 });
    }),
    http.post("*/api/staging/reject", async ({ request }) => {
      await zapiszMutacje(request);
      return HttpResponse.json({ ok: true, rejected: 1 });
    }),
    http.put("*/api/staging/:id", async ({ request }) => {
      await zapiszMutacje(request);
      return HttpResponse.json(domyslnaPozycja);
    }),
    http.delete("*/api/staging/:id", async ({ request }) => {
      await zapiszMutacje(request);
      return HttpResponse.json({ ok: true });
    }),
    http.get("*/api/staging/:id", ({ params }) =>
      HttpResponse.json(szczegol ?? { ...domyslnaPozycja, id: Number(params.id) }),
    ),

    // Akceptacja rusza katalog, więc widok unieważnia też `/api/products` (`fe.js:9131`).
    http.get("*/api/products", () => HttpResponse.json([])),
  ];
}

/** Wspólny szkielet odpowiedzi `review` — pola, które ma KAŻDY wariant. */
function szkieletPrzegladu(): PrzegladZgloszenia {
  return {
    id: 710_001,
    kod: "MO5_STARY",
    nazwa: "480/70R34 BKT AGRIMAX RT 765",
    powod: null,
    matchIssue: null,
    absenceReview: false,
    absenceEvidence: [],
    duplicateSource: false,
    sourceConflict: null,
    eanIssue: null,
    incoming: {
      marka: "BKT",
      model: "AGRIMAX RT 765",
      rozmiar: "480/70R34",
      dot: "2124",
      ean: "8903094020614",
      stan: 4,
      status: "aktywny",
    },
    candidates: [],
  };
}

/**
 * Gałąź „niejednoznaczne dopasowanie" — przycisk „Rozstrzygnij", akcja `POST …/resolve`.
 * `matchIssue` dosłownie z importera (`import/polityka/fabryka.ts:436`).
 */
export function przegladDopasowania(
  nadpisania: Partial<PrzegladZgloszenia> = {},
): PrzegladZgloszenia {
  return {
    ...szkieletPrzegladu(),
    powod: "Kilka zgodnych produktów z tym EAN. Wybierz właściwą oponę.",
    matchIssue: "Kilka zgodnych produktów z tym EAN. Wybierz właściwą oponę.",
    candidates: [
      {
        kod: "MO5_A",
        nazwa: "480/70R34 BKT AGRIMAX RT 765",
        rozmiar: "480/70R34",
        dot: "2124",
        ean: "8903094020614",
        catalogStan: 2,
        status: "aktywny",
        catalogDot: "2124",
        catalogVersion: "v-a",
        selectable: true,
        sameEan: true,
        sameDot: true,
      },
      {
        kod: "MO5_B",
        nazwa: "480/70R34 BKT AGRIMAX RT 765 (inna partia)",
        rozmiar: "480/70R34",
        dot: "1923",
        ean: "8903094020621",
        catalogStan: 0,
        status: "wstrzymany",
        catalogDot: "1923",
        catalogVersion: "v-b",
        selectable: false,
        sameEan: false,
        sameDot: false,
      },
    ],
    ...nadpisania,
  };
}

/**
 * Gałąź „stara karta" — przycisk „Sprawdź kartę", akcja `POST …/choose-absence-card`.
 * Domyślnie JEDEN zgodny kandydat ze świeżym odczytem oferty, czyli wariant, w którym
 * wolno wskazać obie karty (notatka „Wybór działa od razu w katalogu…").
 */
export function przegladStarejKarty(
  nadpisania: Partial<PrzegladZgloszenia> = {},
): PrzegladZgloszenia {
  return {
    ...szkieletPrzegladu(),
    powod:
      "Brak starego kodu, ale zgodne cechy są w bieżącej ofercie pod innym oznaczeniem. Sprawdź starą kartę.",
    absenceReview: true,
    incoming: { ...szkieletPrzegladu().incoming, stan: 0, status: "wstrzymany" },
    candidates: [
      {
        kod: "MO5_NOWY",
        nazwa: "480/70R34 BKT AGRIMAX RT 765",
        rozmiar: "480/70R34",
        dot: "2124",
        ean: "8903094020614",
        sourceKey: "MO5|480/70R34|RT765",
        stan: 6,
        cenaZakupu: 1850,
        catalogStan: 6,
        status: "aktywny",
        catalogDot: "2124",
        catalogVersion: "v-nowy",
        selectable: true,
        sameEan: true,
        sameDot: true,
      },
    ],
    ...nadpisania,
  };
}

/**
 * Gałąź „sprzeczne wiersze w jednym pliku" — przycisk „Rozstrzygnij", ale BEZ akcji:
 * oryginał daje tu sam podgląd, bo sprzeczność musi wyjaśnić dostawca.
 * Etykiety pól w `different` są po polsku, prosto z importera (`fabryka.ts:531-540`).
 */
export function przegladSprzecznychWierszy(
  nadpisania: Partial<PrzegladZgloszenia> = {},
): PrzegladZgloszenia {
  return {
    ...szkieletPrzegladu(),
    powod: "Kilka różnych pozycji dostawcy wskazuje tę samą oponę. Wymaga sprawdzenia pliku.",
    matchIssue: "Sprzeczne pozycje w jednym cenniku",
    duplicateSource: true,
    sourceConflict: {
      different: ["EAN", "cena zakupu", "stan"],
      earlier: {
        kod: "520196",
        EAN: "8903094020614",
        DOT: "2124",
        "cena zakupu": 1850,
        stan: 13,
      },
      later: {
        kod: "520197",
        EAN: "8903094020621",
        DOT: "2124",
        "cena zakupu": 1910,
        stan: 1,
      },
    },
    ...nadpisania,
  };
}
