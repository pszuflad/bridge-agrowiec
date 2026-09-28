/**
 * Warstwa danych okna „Rozstrzygnij" (Staging v2) — port
 * `mirror/frontend/assets/staging-policy-injection.js` @ `88fa31c` (wersja `20260923dotchoice`,
 * ta, którą `index.html` naprawdę ładuje).
 *
 * ⚠ ORYGINAŁ JEST WSTRZYKIWANĄ NAKŁADKĄ NA GOTOWY DOM, nie komponentem. Skanuje
 * `tr[data-testid^="row-staging-"]` `MutationObserver`em i dokleja przycisk do ostatniej
 * komórki wiersza. Mechaniki nie portujemy — w Reakcie przycisk renderuje sama tabela.
 * Portujemy WARUNEK, etykiety i wszystkie teksty.
 *
 * ⚠ TRASY `close-absence-review` NIE MA W TYM PLIKU I NIE JEST TO PRZEOCZENIE. Backend ją ma
 * (`routes/staging-polityka.ts`) i opisuje `contract/openapi.yaml`, ale łatka
 * `20260923_dotchoice` (23.09 12:31) USUNĘŁA z frontendu przycisk „Pozostaw starą wstrzymaną
 * i zamknij sprawę", zastępując go wyborem jednej karty (`choose-absence-card`). Dowód:
 * `git diff 58d9d1d 88fa31c -- mirror/frontend/assets/staging-policy-injection.js`.
 * Decyzja użytkownika 2026-09-23 (plan.md D1): odtwarzamy stan zamrożony, trasa zostaje
 * po stronie backendu nieużywana.
 */
import { zadanie } from "@/lib/api";

/** Pozycja oferty obok starej karty — wpis `_candidates` ze snapshotu, wzbogacony przez `review`. */
export type KandydatPrzegladu = {
  kod: string;
  nazwa?: string | null;
  rozmiar?: string | null;
  dot?: string | null;
  ean?: string | null;
  /** Klucz wiersza w pliku dostawcy — jest tylko wtedy, gdy kandydat pochodzi ze świeżego odczytu. */
  sourceKey?: string | null;
  stan?: number | string | null;
  cenaZakupu?: number | string | null;
  /** Stan ŻYWEJ karty katalogowej kandydata (dokładane przez trasę `review`). */
  catalogStan: number | null;
  status: string | null;
  catalogDot: string | null;
  catalogVersion: string | null;
  /**
   * Trójstronna zgodność DOT: DOT zapamiętany = DOT żywej karty = DOT starej karty.
   * `sameDot` niesie tę samą wartość — backend liczy je jednym wyrażeniem.
   */
  selectable: boolean;
  sameEan: boolean;
  sameDot: boolean;
};

/** Jeden z dwóch sprzecznych wierszy jednego pliku (`_sourceConflict`, `fabryka.ts:545-557`). */
export type WierszKonfliktu = {
  kod?: string | null;
  EAN?: string | null;
  DOT?: string | null;
  "cena zakupu"?: number | string | null;
  stan?: number | string | null;
};

export type KonfliktZrodla = {
  /** Etykiety pól, które się różnią — po polsku, prosto z importera („EAN", „cena zakupu"…). */
  different: string[];
  earlier: WierszKonfliktu;
  later: WierszKonfliktu;
};

/** Odpowiedź `GET /api/staging/{id}/review` — kształt z `contract/openapi.yaml`. */
export type PrzegladZgloszenia = {
  id: number;
  kod: string;
  nazwa: string;
  powod: string | null;
  matchIssue: string | null;
  absenceReview: boolean;
  absenceEvidence: unknown[];
  duplicateSource: boolean;
  sourceConflict: KonfliktZrodla | null;
  eanIssue: string | null;
  /**
   * ⚠ `stan` i `status` pochodzą z PRODUKTU W KATALOGU, reszta ze snapshotu zgłoszenia
   * (`staging-polityka.ts`, port `staging_policy.cjs:630`). Okno pokazuje więc obok siebie
   * „co przyszło" i „co stoi dziś w katalogu" — i to jest zamierzone.
   */
  incoming: {
    marka?: string | null;
    model?: string | null;
    rozmiar?: string | null;
    dot?: string | null;
    ean?: string | null;
    stan?: number | null;
    status?: string | null;
  };
  candidates: KandydatPrzegladu[];
};

/**
 * Cztery frazy, po których oryginał rozpoznaje zgłoszenie do ręcznej decyzji (`:145`).
 *
 * Wszystkie cztery pochodzą z pola `powod` i są produkowane przez importer:
 * `import/polityka/fabryka.ts` `:412`, `:436`, `:437`, `:447`, `:457` („Sprawdź dopasowanie",
 * „Wybierz właściwą oponę"), `:528` („Wymaga sprawdzenia pliku"), `:879`, `:917`
 * („Sprawdź starą kartę"). W oryginale: `staging_policy.cjs` `:384`, `:394`, `:400`, `:407`,
 * `:433`, `:577`, `:592`.
 */
export const WZORZEC_ROZSTRZYGNIECIA =
  /Sprawdź dopasowanie|Wybierz właściwą oponę|Wymaga sprawdzenia pliku|Sprawdź starą kartę/;

/** Fraza, która zmienia etykietę przycisku na „Sprawdź kartę" (`:148`). */
const WZORZEC_STAREJ_KARTY = /Sprawdź starą kartę/;

/**
 * Czy wiersz dostaje przycisk rozstrzygnięcia.
 *
 * ODSTĘPSTWO ŚWIADOME (plan.md D2): oryginał testuje `row.textContent`, czyli RENDEROWANY
 * tekst całego wiersza. Skutek uboczny, którego nikt nie chciał: schowanie kolumny „Powód"
 * w konfiguratorze (`kolumny.ts`, klucz `powod`) usuwa frazę z DOM-u i przycisk znika.
 * Czytamy więc dane, nie DOM — przycisk pojawia się dokładnie tam, gdzie w produkcji przy
 * domyślnych kolumnach, i nie znika po ukryciu kolumny.
 *
 * `ostrzezenie` jest w tym samym zdaniu co `powod` (`ostrzezenie = bledy.join(" • ")`,
 * `powod = [...zmiany, ...bledy].join(" • ")`), więc sprawdzamy oba — tak jak `textContent`
 * oryginału obejmował obie komórki.
 */
export function wymagaRozstrzygniecia(pozycja: {
  powod: string | null;
  ostrzezenie: string | null;
}): boolean {
  return WZORZEC_ROZSTRZYGNIECIA.test(`${pozycja.powod ?? ""} ${pozycja.ostrzezenie ?? ""}`);
}

/** „Sprawdź kartę" przy sprawie starej karty, inaczej „Rozstrzygnij" (`:148`). */
export function etykietaRozstrzygniecia(pozycja: {
  powod: string | null;
  ostrzezenie: string | null;
}): string {
  return WZORZEC_STAREJ_KARTY.test(`${pozycja.powod ?? ""} ${pozycja.ostrzezenie ?? ""}`)
    ? "Sprawdź kartę"
    : "Rozstrzygnij";
}

/**
 * Komunikat błędu tak, jak czyta go oryginał: `v.message || v.error || <zapasowy>` (`:41`, `:47`).
 *
 * ⚠ `zadanie()` z `lib/api.ts` rzuca `Error("<status>: <surowa treść ciała>")` — wierne
 * odtworzenie `fe.js:9031-9038`, ale traci strukturę. Rozpakowujemy ją tutaj, w jednym
 * miejscu, zamiast zmieniać `zadanie()` i ruszać wszystkie pozostałe widoki.
 *
 * Komunikat MUSI wyjść z serwera dosłownie — to jest cała treść okna „Nie zapisano zmian".
 * Przepisanie go w UI zerwałoby parytet z produkcją (backend ma siedem różnych blokad 409
 * i każda mówi, co konkretnie zrobić).
 */
export function komunikatBledu(blad: unknown, zapasowy: string): string {
  const tekst = blad instanceof Error ? blad.message : String(blad ?? "");
  // `zadanie()` prefiksuje ciało statusem; `queryFn` z `queryClient.ts` robi to samo.
  const cialo = tekst.replace(/^\d{3}:\s*/, "");
  try {
    const wartosc = JSON.parse(cialo) as { message?: unknown; error?: unknown };
    if (typeof wartosc.message === "string" && wartosc.message) return wartosc.message;
    if (typeof wartosc.error === "string" && wartosc.error) return wartosc.error;
  } catch {
    // Ciało nie jest JSON-em (błąd sieci, HTML-owe 500) — oryginał w tej sytuacji też
    // nie ma czego pokazać i sięga po tekst zapasowy.
  }
  return zapasowy;
}

/** Tekst zapasowy okna „Nie zapisano zmian" — `notice()` w oryginale (`:41`). */
export const ZAPASOWY_KOMUNIKAT_AKCEPTACJI = "Odśwież staging i spróbuj ponownie.";

/** Tekst zapasowy błędu zapisu decyzji — `api()` w oryginale (`:47`). */
export const ZAPASOWY_KOMUNIKAT_DECYZJI = "Nie udało się zapisać decyzji.";

/** Wartość opcji „To osobna opona…" — `'__new__'` w oryginale (`:124`). */
export const KOD_NOWEGO_PRODUKTU = "__new__";

/**
 * `POST /api/staging/{id}/resolve` — rozstrzygnięcie niejednoznacznego dopasowania (`:131`).
 *
 * ⚠ `targetCode` leci TYLKO przy `action: "link"`. Oryginał podaje `undefined` dla „nowego
 * produktu", a `JSON.stringify` wycina wtedy klucz — odtwarzamy to pominięciem pola, nie
 * wysłaniem `null` (backend sprawdza `produktPoKodzie(String(targetCode))`).
 */
export async function rozstrzygnijDopasowanie(
  id: number,
  wybor: string,
): Promise<{ ok: boolean; id: number; kod: string }> {
  const nowy = wybor === KOD_NOWEGO_PRODUKTU;
  const odpowiedz = await zadanie("POST", `/api/staging/${id}/resolve`, {
    action: nowy ? "new" : "link",
    ...(nowy ? {} : { targetCode: wybor }),
  });
  return (await odpowiedz.json()) as { ok: boolean; id: number; kod: string };
}

/** `POST /api/staging/{id}/choose-absence-card` — wybór jednej karty (`:113`). */
export async function wybierzKarte(
  id: number,
  selectedCode: string,
  candidateVersion: string | null,
): Promise<{ ok: boolean; kod: string }> {
  const odpowiedz = await zadanie("POST", `/api/staging/${id}/choose-absence-card`, {
    selectedCode,
    candidateVersion,
  });
  return (await odpowiedz.json()) as { ok: boolean; kod: string };
}

/**
 * `details()` z oryginału (`:52`) — jedna linia opisu opony.
 *
 * Człony puste wypadają (`filter(Boolean)`), ale „EAN " zostaje ZAWSZE, bo przy braku EAN-u
 * oryginał wstawia „EAN brak" — i to jest informacja, nie szum.
 */
export function opisOpony(o: {
  marka?: string | null;
  model?: string | null;
  rozmiar?: string | null;
  dot?: string | null;
  ean?: string | null;
}): string {
  return [o.marka, o.model, o.rozmiar, o.dot && `DOT ${o.dot}`, `EAN ${o.ean || "brak"}`]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Czy kandydat ma świeży odczyt oferty — `sourceKey && stan != null && cenaZakupu != null`
 * plus kontrola skończoności liczb (`:99` w oryginale).
 *
 * To samo wyrażenie stoi po stronie backendu (`nieobecne.ts`, `hasFreshPriceAndStock`) —
 * okno nie może zaproponować wyboru, który akcja i tak odrzuci komunikatem
 * „Nie ma aktualnego stanu i ceny tej karty.".
 */
export function maSwiezyOdczyt(c: KandydatPrzegladu): boolean {
  return (
    !!c.sourceKey &&
    c.stan != null &&
    c.cenaZakupu != null &&
    Number.isFinite(Number(c.stan)) &&
    Number.isFinite(Number(c.cenaZakupu))
  );
}

/**
 * Czy wolno wskazać STARĄ kartę — `:81-82` w oryginale.
 *
 * ⚠ Warunek jest WĘŻSZY niż dla kandydata i nie sprawdza `Number.isFinite`: oryginał testuje
 * tu tylko `sourceKey && stan != null && cenaZakupu != null`. Różnica jest w oryginale
 * i zostaje — backend i tak zweryfikuje to po swojemu.
 */
export function mozliwyWyborStarejKarty(zgodni: KandydatPrzegladu[]): boolean {
  const pierwszy = zgodni[0];
  if (zgodni.length !== 1 || !pierwszy) return false;
  return (
    (!!pierwszy.sourceKey && pierwszy.stan != null && pierwszy.cenaZakupu != null) ||
    pierwszy.status === "aktywny"
  );
}

/** Czy wolno wskazać kandydata — `:93` w oryginale. */
export function mozliwyWyborKandydata(c: KandydatPrzegladu): boolean {
  return c.selectable && (c.status === "aktywny" || maSwiezyOdczyt(c));
}

/**
 * Notatka pod kartami — DOKŁADNIE JEDNA z trzech, zależnie od stanu kandydatów (`:103-107`).
 * Teksty dosłownie z oryginału.
 */
export function notatkaWyboru(zgodni: KandydatPrzegladu[]): string {
  const pierwszy = zgodni[0];
  if (!pierwszy) {
    return "Różny DOT oznacza inną oponę. W tym przypadku nie wybieraj jednej karty: system powinien pozostawić je osobno i usunąć błędne zgłoszenie po następnym odczycie oferty.";
  }
  if (!pierwszy.sourceKey && pierwszy.status !== "aktywny") {
    return "Przed wyborem starej karty wczytaj ponownie cennik, żeby potwierdzić bieżącą cenę i liczbę opon.";
  }
  return "Wybór działa od razu w katalogu: wybrana karta przejmuje potwierdzoną ofertę, a druga zostaje wstrzymana ze stanem zero. Nie tworzy to kolejnego zgłoszenia.";
}

/** „Stan: …" na karcie starego produktu (`:85`). */
export function opisStanuStarejKarty(status: string | null | undefined): string {
  if (status === "wstrzymany") return "Stan: wstrzymana, niedostępna w sprzedaży";
  return `Stan: ${status || "nieznany"}`;
}

/** „Stan w katalogu: …" na karcie kandydata (`:92`). */
export function opisStanuKandydata(status: string | null | undefined): string {
  if (status === "aktywny") return "Stan w katalogu: dostępna";
  if (status === "wstrzymany") return "Stan w katalogu: wstrzymana";
  return `Stan w katalogu: ${status || "brak karty"}`;
}

/** Etykieta opcji wyboru kandydata w gałęzi dopasowania (`:125`). */
export function etykietaKandydata(c: KandydatPrzegladu): string {
  return (
    `${c.kod}: ${c.nazwa ?? ""} · ${c.rozmiar || "brak rozmiaru"} · ` +
    `DOT ${c.dot || "brak"} · EAN ${c.ean || "brak"}${c.sameEan ? "" : " (inny EAN)"}`
  );
}
