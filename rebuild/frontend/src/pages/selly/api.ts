/**
 * Klient `/api/selly/*` — backend gotowy od sesji 8a (`28-FEATURE-selly-eksport-backend`).
 *
 * ⚠ PANEL WOŁA SZEŚĆ TRAS Z DZIESIĘCIU. Żywy oryginał
 * (`mirror/frontend/assets/selly-injection.js`, `VERSION='v5-csvstatus-genbtn'`) używa
 * dokładnie: `/ping` (:547), `/csv-status` (:570), `/generate-csv` (:604), `/status` (:620),
 * `/log?limit=10` (:653), `/sync-supplier` (:691). Pozostałe cztery — `dictionaries`,
 * `producers`, `categories`, `sync-product` — NIE MAJĄ konsumenta w UI; w produkcji
 * używano ich z konsoli. Decyzja D1 planu: nie dorabiamy im ekranu.
 *
 * ⚠ `producers` i `categories` to POST, nie GET (`contract/openapi.yaml`,
 * `rebuild/backend/src/routes/selly.ts:112,139`) — gdyby kiedyś dostały UI.
 *
 * Nie używamy domyślnego `queryFn` z `queryClient.ts` (`on401: returnNull`), bo panel musi
 * odróżnić awarię od braku danych: przy braku sekretów `SELLY_*` sześć tras zewnętrznych
 * oddaje 500 i to jest informacja do pokazania, a nie pusty ekran.
 */
import { BAZA_API, naglowki, rzucGdyBlad, zadanie } from "@/lib/api";

/** Kształt z `contract/fixtures/GET_selly_ping.json`. */
export type PingSelly = {
  ok: boolean;
  shop: string;
  token_prefix: string;
  expires_in_seconds: number;
  vat_probe: string;
};

/**
 * Kształt z `contract/fixtures/GET_selly_csv-status.json`.
 *
 * `powod` jest `null`, gdy `status === "ok"`; przy problemie niesie tekst przyczyny.
 * `url` wskazuje plik pobierany przez Selly — panel podaje go jako `<a href>`, NIE fetchem.
 */
export type StatusCsv = {
  ok: boolean;
  exists: boolean;
  status: string;
  powod: string | null;
  ostatnia_synchronizacja: string | null;
  wygenerowany_dzisiaj: boolean;
  wiek_minut: number | null;
  wiersze: number | null;
  rozmiar_bajty: number | null;
  rozmiar_mb: number | null;
  url: string | null;
};

/** Wiersz z `contract/fixtures/GET_selly_status.json` (`items[]`). */
export type WierszStatusuDostawcy = {
  dostawca: string;
  w_bridge: number;
  w_selly: number;
  z_bledami: number;
};

/**
 * Wpis z `contract/fixtures/GET_selly_log.json` (`items[]`) — 12 pól.
 *
 * `szczegoly_json` to STRING z zserializowanym JSON-em, nie obiekt. Panel go nie parsuje
 * (oryginał też nie, `:648-680`) — wyświetla wyłącznie kolumny liczbowe i status.
 */
export type WpisLogu = {
  id: number;
  operacja: string;
  dostawca_kod: string | null;
  liczba_ok: number;
  liczba_blad: number;
  liczba_skip: number;
  szczegoly_json: string | null;
  uzytkownik_id: number | null;
  uzytkownik_imie: string | null;
  rozpoczeto: string;
  zakonczono: string | null;
  status: string;
};

/** Odpowiedź `POST /api/selly/generate-csv` (brak fixtura — kształt z backendu 8a). */
export type WynikGenerowaniaCsv = {
  ok: boolean;
  wiersze?: number;
  rozmiar_mb?: number;
  czas_ms?: number;
  error?: string;
};

/** Odpowiedź `POST /api/selly/sync-supplier` (brak fixtura — kształt z backendu 8a). */
export type WynikSynchronizacji = {
  dostawca?: string;
  total?: number;
  created?: number;
  updated?: number;
  failed?: number;
  skipped?: number;
  dry_run?: boolean;
  errors?: unknown[];
  dry_payloads?: unknown[];
};

/** Parametry `POST /api/selly/sync-supplier` — 1:1 z `selly-injection.js:691-699`. */
export type ParametrySynchronizacji = {
  dostawca: string;
  dry_run: boolean;
  limit: number;
  only_updated: boolean;
};

export const KLUCZ_PING = ["/api/selly/ping"] as const;
export const KLUCZ_STATUS_CSV = ["/api/selly/csv-status"] as const;
export const KLUCZ_STATUS = ["/api/selly/status"] as const;
export const KLUCZ_LOG = ["/api/selly/log"] as const;
export const KLUCZ_USUWANIE = ["/api/selly/usuwanie-status"] as const;
export const KLUCZ_USUNIETE = ["/api/selly/usuniete"] as const;

/** Ile ostatnich wpisów dziennika pobiera panel (ticket 194: było 10 = jedna runda synchronizacji dla 10 dostawców). */
export const LIMIT_LOGU = 100;

/** `GET /api/selly/usuwanie-status` (ticket 194, trasa spoza oryginału) — stan Toru 3. */
export type StatusUsuwania = {
  wlaczone: boolean;
  powody_wylaczenia: string[];
  tryb: string;
  proba_uprawnien: "jest" | "brak" | "nieokreslony" | null;
  ostatni_przebieg: {
    kiedy: string;
    wynik:
      | "brak_sierot"
      | "usunieto"
      | "pominieto"
      | "wstrzymano"
      | "limit_dobowy"
      | "brak_uprawnien"
      | "proba_nieokreslona"
      | "wylaczone"
      | "blad";
    opis: string;
    sieroty?: number;
    usuniete?: number;
    pominiete?: number;
    bledy?: number;
  } | null;
  sierot_teraz: number;
  usuniec_24h: number;
  limit_dobowy: number;
  maks_udzial_sierot: number;
  ostatnie_usuniecie: { kiedy: string; kod: string | null; nazwa: string | null } | null;
};

/**
 * Prefiks komunikatu, którym backend 8a sygnalizuje brak sekretów `SELLY_*`
 * (`rebuild/backend/src/selly/klient.ts`, plan 8a D6). Bez konfiguracji SZEŚĆ tras
 * zewnętrznych oddaje 500 z tekstem `[Selly] Brak konfiguracji: …` — to zachowanie
 * 1:1 z produkcją, NIE awaria do naprawienia.
 *
 * Dopasowanie jest LUŹNE (sam prefiks), bo lista brakujących zmiennych w ogonie
 * komunikatu zależy od tego, czego akurat brakuje.
 */
const PREFIKS_BRAKU_KONFIGURACJI = "[Selly] Brak konfiguracji";

/**
 * Czy błąd to „Selly nieskonfigurowane" (decyzja D4 planu).
 *
 * `rzucGdyBlad` sklei komunikat jako `"<status>: <treść>"`, więc szukamy prefiksu
 * w środku tekstu, nie na jego początku. KAŻDY inny błąd ma lecieć surowo, jak w oryginale.
 */
export function czyBrakKonfiguracjiSelly(blad: unknown): boolean {
  return blad instanceof Error && blad.message.includes(PREFIKS_BRAKU_KONFIGURACJI);
}

/**
 * Prefiksy blokady środowiskowej (`SELLY_TRYB`, backend `src/selly/tryb.ts`, ticket 34).
 *
 * To INNY stan niż brak konfiguracji: tam naprawą jest „uzupełnij sekrety", tu — „to
 * środowisko ma zakaz i tak ma być". Mylenie ich kosztowałoby zgłoszenie awarii, której nie ma.
 */
const PREFIKS_INTEGRACJA_WYLACZONA = "[Selly] Integracja wyłączona";
const PREFIKS_ZAPIS_ZABLOKOWANY = "[Selly] Zapis do Selly zablokowany";

/** Czy błąd to blokada CAŁEJ integracji (`SELLY_TRYB=wylaczony`). */
export function czyIntegracjaWylaczona(blad: unknown): boolean {
  return blad instanceof Error && blad.message.includes(PREFIKS_INTEGRACJA_WYLACZONA);
}

/** Czy błąd to blokada samych ZAPISÓW (`SELLY_TRYB=tylko-odczyt`). */
export function czyZapisZablokowany(blad: unknown): boolean {
  return blad instanceof Error && blad.message.includes(PREFIKS_ZAPIS_ZABLOKOWANY);
}

async function pobierz<T>(sciezka: string): Promise<T> {
  const odpowiedz = await fetch(`${BAZA_API}${sciezka}`, {
    headers: naglowki(false),
    credentials: "include",
  });
  await rzucGdyBlad(odpowiedz);
  return (await odpowiedz.json()) as T;
}

export function pobierzPing(): Promise<PingSelly> {
  return pobierz<PingSelly>("/api/selly/ping");
}

export function pobierzStatusCsv(): Promise<StatusCsv> {
  return pobierz<StatusCsv>("/api/selly/csv-status");
}

export async function pobierzStatusDostawcow(): Promise<WierszStatusuDostawcy[]> {
  const dane = await pobierz<{ items?: WierszStatusuDostawcy[] }>("/api/selly/status");
  return dane.items ?? [];
}

/**
 * Log operacji. Ticket 194: limit podniesiony z `10` (oryginał, `selly-injection.js:653`) do `LIMIT_LOGU`, bo jedna
 * runda synchronizacji to 10 wpisów (po jednym na dostawcę) i wypychała z okna wszystko inne, w tym wpisy Toru 3.
 * Limit jest w ŚCIEŻCE, nie w kluczu zapytania — oryginał woła
 * `/log?limit=10` na sztywno (`selly-injection.js:653`).
 */
export async function pobierzLog(grupa?: "usuwanie" | "synchronizacja"): Promise<WpisLogu[]> {
  // `grupa` (ticket 194, parametr spoza oryginału): wpisy usuwania i synchronizacji mają osobne okno `LIMIT_LOGU`,
  // żeby częste wpisy synchronizacji nie wypychały rzadkich wpisów Toru 3.
  const dane = await pobierz<{ items?: WpisLogu[] }>(
    `/api/selly/log?limit=${LIMIT_LOGU}${grupa ? `&grupa=${grupa}` : ""}`,
  );
  return dane.items ?? [];
}

export function pobierzStatusUsuwania(): Promise<StatusUsuwania> {
  return pobierz<StatusUsuwania>("/api/selly/usuwanie-status");
}

/** Ile pozycji pokazuje jedna strona karty „Usunięte z Selly". */
export const LIMIT_USUNIETYCH = 20;

/** Jedna usunięta pozycja — `GET /api/selly/usuniete` (ticket 195, trasa spoza oryginału). */
export type UsunietaPozycja = {
  id: number;
  /** UTC `YYYY-MM-DD HH:MM:SS`. */
  usunieto_at: string;
  /** `selly_sync_log.id` przebiegu, który usunął pozycję. */
  przebieg_id: number | null;
  kod: string;
  nazwa: string | null;
  ean: string | null;
  dostawca: string;
  kod_importu: string;
  selly_product_id: number;
  selly_variant_id: number | null;
  akcja: "usunieto_wariant" | "usunieto_produkt" | "juz_nie_istnial";
};

export type StronaUsunietych = { items: UsunietaPozycja[]; total: number };

/** `GET /api/selly/usuniete` — najnowsze pierwsze; `offset` = ile pozycji pominąć (paginacja). */
export function pobierzUsuniete(offset: number): Promise<StronaUsunietych> {
  return pobierz<StronaUsunietych>(`/api/selly/usuniete?limit=${LIMIT_USUNIETYCH}&offset=${offset}`);
}

/**
 * `GET /api/selly/usuniete/csv` — CAŁA historia usunięć jako plik. Pobieramy `fetch`em z nagłówkiem autoryzacji
 * (zwykły link nie niesie tokenu Bearer), a plik zapisujemy przez tymczasową kotwicę — tak jak archiwum importów.
 * Nazwa pliku pochodzi z `Content-Disposition` serwera (`selly-usuniete-RRRR-MM-DD.csv`).
 */
export async function pobierzCsvUsunietych(): Promise<void> {
  const odpowiedz = await fetch(`${BAZA_API}/api/selly/usuniete/csv`, {
    headers: naglowki(false),
    credentials: "include",
  });
  await rzucGdyBlad(odpowiedz);
  const nazwa =
    /filename="?([^";]+)"?/i.exec(odpowiedz.headers.get("content-disposition") ?? "")?.[1] ?? "selly-usuniete.csv";
  const blob = await odpowiedz.blob();
  const adres = URL.createObjectURL(blob);
  const kotwica = document.createElement("a");
  kotwica.href = adres;
  kotwica.download = nazwa;
  document.body.appendChild(kotwica);
  kotwica.click();
  kotwica.remove();
  setTimeout(() => URL.revokeObjectURL(adres), 5000);
}

/** `selly-injection.js:604` — ciało to dosłownie `{}`. */
export async function wygenerujCsv(): Promise<WynikGenerowaniaCsv> {
  const odpowiedz = await zadanie("POST", "/api/selly/generate-csv", {});
  return (await odpowiedz.json()) as WynikGenerowaniaCsv;
}

/**
 * ⚠ Z `dry_run: false` ta trasa REALNIE tworzy i modyfikuje produkty w cudzym, żywym
 * sklepie Selly. Wywołanie jest zabezpieczone dialogiem potwierdzenia (decyzja D3 planu) —
 * jedyne odstępstwo od oryginału w tej ścieżce.
 */
export async function synchronizujDostawce(
  parametry: ParametrySynchronizacji,
): Promise<WynikSynchronizacji> {
  const odpowiedz = await zadanie("POST", "/api/selly/sync-supplier", parametry);
  return (await odpowiedz.json()) as WynikSynchronizacji;
}
