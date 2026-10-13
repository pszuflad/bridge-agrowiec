// Zamówienie partnera → zamówienie w Selly (ticket 248 podgląd, ticket 249 utworzenie).
// Podgląd jest TYLKO ODCZYTEM i pokazuje dokładnie to, co poszłoby do sklepu (`zadanie`). Utworzenie (`utworzWSelly`) jest ręczne, za flagą
// `PARTNERZY_SELLY_ZAMOWIENIA`, i nigdy nie dubluje: zamówienie jest „zajmowane” statusem `wysylanie` PRZED wywołaniem sklepu.
// Ciało `POST /api/orders` wyprowadzono z kształtu `GET /api/orders` (nazwy pól) — dokumentacji zapisu nie mamy; błąd sklepu wraca do człowieka,
// a zamówienie wraca do statusu `przyjete`.

import { and, desc, eq, isNull } from "drizzle-orm";

import type { Baza } from "../db/index.js";
import { kursyNbp, partnerKraje, partnerZamowienia, partnerzy, products, sellyProducts } from "../db/schema.js";
import { szczegolyZamowieniaDlaPartnera } from "../repos/partnerzy-zamowienia.js";
import { BladSelly, type KlientSelly } from "../selly/klient.js";
import { znajdzPozycjeKatalogu } from "./walidacja-zamowienia.js";

/**
 * Stałe zamówień partnerów w Selly (decyzja użytkowniczki 2026-10-13): VAT „0 % WDT” = 101 (potwierdzone), forma płatności i dostawy „System zewnętrzny” = 10
 * (ID ze słowników Selly pokazanych przez użytkowniczkę — do sprawdzenia przy pierwszym zamówieniu). Kolumny `partnerzy.selly_payment_id/delivery_id/vat_id`
 * (migracja 034) zostają jako opcjonalne nadpisania; panel ich nie pokazuje — w ustawieniach partnera jest tylko status.
 */
export const SELLY_VAT_ID = 101;
export const SELLY_PLATNOSC_ID = 10;
export const SELLY_DOSTAWA_ID = 10;

export const STATUS_WYSYLANIE = "wysylanie";
export const STATUS_WYSLANE = "wyslane";

export type PozycjaPodgladu = {
  lp: number;
  kodPartnera: string;
  nazwaPartnera: string | null;
  ilosc: number;
  cena: number | null;
  dopasowanie: {
    kod: string; nazwa: string; ean: string | null; dostawca: string | null; stan: number; status: string;
    sellyProductId: number | null; sellyVariantId: number | null;
  } | null;
};

export type PodgladSelly = {
  zamawiajacy: { nazwa: string | null; nip: string | null; ulica: string | null; kod: string | null; miasto: string | null; kraj: string | null };
  /** Skąd pochodzą dane do faktury: `kraj` (ustawione dla kraju dostawy) albo `partner` (domyślne). */
  zrodloFaktury: "kraj" | "partner";
  /** Kraj dostawy, dla którego wybrano dane do faktury. */
  krajFaktury: string | null;
  dostawa: Record<string, string>;
  waluta: string | null;
  kosztDostawy: number | null;
  pozycje: PozycjaPodgladu[];
  /** Powody, dla których zamówienia nie wolno jeszcze tworzyć w Selly (puste = można). */
  blokady: string[];
  /** Uwagi, które nie blokują (np. niepełny adres dostawy). */
  ostrzezenia: string[];
  /** Ciało `POST /api/orders` dokładnie w tej postaci, w jakiej pójdzie do sklepu; `null`, gdy są blokady. */
  zadanie: Record<string, unknown> | null;
  /** Flaga serwera `PARTNERZY_SELLY_ZAMOWIENIA` — bez niej przycisk „Utwórz w Selly” jest nieaktywny. */
  tworzenieWlaczone: boolean;
  /** Kurs użyty w ciele zamówienia (`exchange_rate`, PLN za 1 EUR) i data tabeli NBP — widoczne w podglądzie, bo kierunek kursu trzeba sprawdzić przy pierwszej próbie. */
  kurs: { kurs: number; data: string } | null;
};

const BRAKUJE: Array<[keyof PodgladSelly["zamawiajacy"], string]> = [
  ["nazwa", "nazwa"], ["nip", "NIP"], ["ulica", "ulica"], ["kod", "kod pocztowy"], ["miasto", "miasto"], ["kraj", "kraj"],
];

/** Adres dostawy z obu formatów plików (Adtyres: CUSTOMERNAME/COUNTRY/PHONE; TyreWorld: name/strasse/plz/ort/lkz/telefon). */
export function adresDostawy(d: Record<string, string>) {
  const pierwszy = (...klucze: string[]): string => klucze.map((k) => d[k]?.trim() ?? "").find((v) => v !== "") ?? "";
  return {
    odbiorca: [pierwszy("CUSTOMERNAME", "name"), pierwszy("name2")].filter(Boolean).join(" "),
    ulica: pierwszy("strasse", "STREET"),
    kod: pierwszy("plz", "ZIP"),
    miasto: pierwszy("ort", "CITY"),
    kraj: pierwszy("lkz", "COUNTRY", "land"),
    telefon: pierwszy("telefon", "PHONE"),
    email: pierwszy("email", "EMAIL"),
  };
}

const ostatniKursEur = (db: Baza): { kurs: number; data: string } | null => db.select({ kurs: kursyNbp.kurs, data: kursyNbp.data }).from(kursyNbp).orderBy(desc(kursyNbp.data)).limit(1).get() ?? null;

export function podgladDlaSelly(db: Baza, partnerId: number, zamowienieId: number, tworzenieWlaczone = false): PodgladSelly | null {
  const z = szczegolyZamowieniaDlaPartnera(db, partnerId, zamowienieId);
  if (!z) return null;
  const p = db.select().from(partnerzy).where(eq(partnerzy.id, partnerId)).get();
  // Dane do faktury: osobne dla kraju dostawy z zamówienia (`partner_kraje.faktura_*`, ticket 252); bez nich — domyślne partnera. Cały komplet z jednego źródła, bez mieszania pól.
  const krajDostawy = adresDostawy(z.dostawa).kraj.toUpperCase();
  const wierszKraju = /^[A-Z]{2}$/.test(krajDostawy)
    ? db.select().from(partnerKraje).where(and(eq(partnerKraje.partnerId, partnerId), eq(partnerKraje.kraj, krajDostawy))).get()
    : undefined;
  const zKraju = !!wierszKraju?.fakturaNazwa;
  const zamawiajacy = zKraju
    ? {
        nazwa: wierszKraju!.fakturaNazwa, nip: wierszKraju!.fakturaNip, ulica: wierszKraju!.fakturaUlica,
        kod: wierszKraju!.fakturaKod, miasto: wierszKraju!.fakturaMiasto, kraj: wierszKraju!.fakturaKraj,
      }
    : {
        nazwa: p?.fakturaNazwa ?? null, nip: p?.fakturaNip ?? null, ulica: p?.fakturaUlica ?? null,
        kod: p?.fakturaKod ?? null, miasto: p?.fakturaMiasto ?? null, kraj: p?.fakturaKraj ?? null,
      };
  const niejednoznaczne = new Set<string>();
  const pozycje: PozycjaPodgladu[] = z.pozycje.map((poz) => {
    const znaleziona = znajdzPozycjeKatalogu(db, poz.kod);
    const produkt = znaleziona ? db.select({ nazwa: products.nazwa, ean: products.ean, dostawca: products.dostawca }).from(products).where(eq(products.kod, znaleziona.kod)).get() : undefined;
    // Powiązań z Selly bywa kilka dla jednego `bridge_kod` (unikat jest na (kod_importu, dostawca)) — zgadywać nie wolno: różne pary = niejednoznaczne.
    const powiazania = znaleziona
      ? db.select({ pid: sellyProducts.sellyProductId, vid: sellyProducts.sellyVariantId }).from(sellyProducts).where(eq(sellyProducts.bridgeKod, znaleziona.kod)).all().filter((r) => r.vid !== null)
      : [];
    const rozne = new Set(powiazania.map((r) => `${r.pid}/${r.vid}`));
    if (rozne.size > 1) niejednoznaczne.add(znaleziona!.kod);
    const selly = rozne.size === 1 ? powiazania[0] : undefined;
    return {
      lp: poz.lp, kodPartnera: poz.kod, nazwaPartnera: poz.nazwa, ilosc: poz.ilosc, cena: poz.cenaSprzedazy,
      dopasowanie: znaleziona
        ? {
            kod: znaleziona.kod, nazwa: produkt?.nazwa ?? "", ean: produkt?.ean ?? null, dostawca: produkt?.dostawca ?? null, stan: znaleziona.stan, status: znaleziona.status,
            sellyProductId: selly?.pid ?? null, sellyVariantId: selly?.vid ?? null,
          }
        : null,
    };
  });

  const blokady: string[] = [];
  const ostrzezenia: string[] = [];
  const brak = BRAKUJE.filter(([k]) => !zamawiajacy[k]?.trim()).map(([, e]) => e);
  if (brak.length) blokady.push(`Brak danych do faktury ${zKraju ? `kraju ${krajDostawy}` : "partnera"}: ${brak.join(", ")} (uzupełnij w ustawieniach ${zKraju ? "kraju" : "partnera"}).`);
  // Jedyne ustawienie Selly partnera to status nowego zamówienia (decyzja 2026-10-13: dalsze statusy zmieniają handlowcy w Selly).
  if (p?.sellyStatusId === null || p?.sellyStatusId === undefined) blokady.push("Brak identyfikatora statusu nowego zamówienia Selly w ustawieniach partnera.");
  const nieznane = pozycje.filter((x) => !x.dopasowanie).length;
  if (nieznane) blokady.push(`Pozycje bez dopasowania w katalogu: ${nieznane} — do ręcznej weryfikacji.`);
  const bezSelly = pozycje.filter((x) => x.dopasowanie && x.dopasowanie.sellyVariantId === null).length;
  if (bezSelly) blokady.push(`Pozycje, których nie ma jeszcze w Selly (brak powiązania produkt/wariant): ${bezSelly}.`);
  if (niejednoznaczne.size) blokady.push(`Niejednoznaczne powiązanie z Selly (kilka różnych produktów/wariantów dla jednego kodu): ${[...niejednoznaczne].join(", ")}.`);
  const bezCeny = pozycje.filter((x) => x.cena === null || !(x.cena > 0)).length;
  if (bezCeny) blokady.push(`Pozycje bez ceny w zamówieniu: ${bezCeny}.`);
  const waluta = (z.waluta ?? "EUR").trim().toUpperCase();
  if (waluta !== "EUR") blokady.push(`Waluta zamówienia to ${waluta}, a Bridge tworzy zamówienia partnerów tylko w EUR.`);
  const kursWpis = ostatniKursEur(db);
  const kurs = kursWpis?.kurs ?? null;
  if (kurs === null) blokady.push("Brak zapisanego kursu EUR (pojawia się po pierwszym wygenerowaniu cennika z kursem NBP).");
  if (z.status !== "przyjete") blokady.push(`Zamówienie ma status „${z.status}” — do Selly trafia tylko zamówienie „przyjęte”.`);
  if (z.numerWlasny) blokady.push(`Zamówienie ma już numer własny (${z.numerWlasny}).`);
  if (z.status === STATUS_WYSYLANIE) blokady.push("Zamówienie jest w trakcie wysyłania do Selly albo poprzednia próba nie dała jednoznacznej odpowiedzi — sprawdź w Selly, a potem „Zwolnij”.");

  if (kursWpis && Date.now() - Date.parse(kursWpis.data) > 5 * 86_400_000) ostrzezenia.push(`Kurs EUR w ciele zamówienia pochodzi z tabeli NBP z ${kursWpis.data} (starszy niż 5 dni).`);
  const adres = adresDostawy(z.dostawa);
  // Zamawiającym jest partner (ticket 253): e-mail z jego kontaktu (fallback: e-mail z pliku zamówienia), telefon partnera, a gdy brak — telefon odbiorcy z pliku.
  const emailZamawiajacego = p?.kontaktEmail?.trim() || adres.email;
  const telefon = p?.kontaktTelefon?.trim() || adres.telefon;
  if (emailZamawiajacego === "") blokady.push("Brak adresu e-mail zamawiającego (uzupełnij „Kontakt: e-mail” w ustawieniach partnera).");
  if (!/^[A-Za-z]{2}$/.test(adres.kraj)) blokady.push(`Zamówienie nie ma dwuliterowego kodu kraju dostawy (jest: „${adres.kraj || "brak"}”).`);
  const bezAdresu = (["ulica", "kod", "miasto"] as const).filter((k) => adres[k] === "");
  if (bezAdresu.length) ostrzezenia.push(`Zamówienie nie zawiera pełnego adresu dostawy (brak: ${bezAdresu.map((k) => ({ ulica: "ulica", kod: "kod pocztowy", miasto: "miasto" })[k]).join(", ")}) — uzupełnij w Selly.`);

  let zadanie: Record<string, unknown> | null = null;
  if (blokady.length === 0 && p && kurs !== null) {
    zadanie = {
      status_id: p.sellyStatusId,
      payment_id: p.sellyPaymentId ?? SELLY_PLATNOSC_ID,
      delivery_id: p.sellyDeliveryId ?? SELLY_DOSTAWA_ID,
      currency: waluta,
      exchange_rate: kurs,
      delivery_price: z.kosztDostawy ?? 0,
      email: emailZamawiajacego,
      phone: telefon,
      ship_company: adres.odbiorca,
      ship_first_name: "-",
      ship_last_name: "-",
      ship_postcode: adres.kod,
      ship_city: adres.miasto,
      ship_address: adres.ulica,
      delivery_country_iso2: adres.kraj.toUpperCase().slice(0, 2),
      invoice_as_ship: 0,
      invoice_type: "faktura",
      invoice_company: zamawiajacy.nazwa,
      invoice_nip: zamawiajacy.nip,
      invoice_first_name: "-",
      invoice_last_name: "-",
      invoice_postcode: zamawiajacy.kod,
      invoice_city: zamawiajacy.miasto,
      invoice_address: zamawiajacy.ulica,
      client_comment: `Zamówienie partnera ${p.nazwa} nr ${z.numerPartnera}`,
      products: pozycje.map((x) => ({
        product_id: x.dopasowanie!.sellyProductId,
        variant_id: x.dopasowanie!.sellyVariantId,
        quantity: x.ilosc,
        price_with_tax: x.cena,
        vat_rate_id: p.sellyVatId ?? SELLY_VAT_ID,
      })),
    };
  }
  return { zamawiajacy, zrodloFaktury: zKraju ? "kraj" : "partner", krajFaktury: /^[A-Z]{2}$/.test(krajDostawy) ? krajDostawy : null, dostawa: z.dostawa, waluta: z.waluta, kosztDostawy: z.kosztDostawy, pozycje, blokady, ostrzezenia, zadanie, tworzenieWlaczone, kurs: kursWpis };
}

export class BladTworzenia extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export type WynikTworzenia = { numerWlasny: string; idSelly: number | null };

/**
 * Tworzy zamówienie w Selly (ręcznie, jedno kliknięcie). Kolejność gwarantuje brak duplikatów: (1) flaga i blokady, (2) atomowe „zajęcie” zamówienia
 * (`przyjete` → `wysylanie`), (3) wywołanie sklepu, (4) `wyslane` + numer. Błąd sklepu zwraca zamówienie do `przyjete`; gdyby proces padł PO udanym
 * wywołaniu, zamówienie zostaje w `wysylanie` (nie wraca samo — człowiek sprawdza w Selly, zamiast ryzykować drugie zamówienie).
 */
export async function utworzWSelly(db: Baza, klient: KlientSelly, partnerId: number, zamowienieId: number, tworzenieWlaczone: boolean): Promise<WynikTworzenia> {
  if (!tworzenieWlaczone) throw new BladTworzenia(403, "Tworzenie zamówień w Selly jest wyłączone (PARTNERZY_SELLY_ZAMOWIENIA nie jest ustawione na serwerze).");
  const podglad = podgladDlaSelly(db, partnerId, zamowienieId, true);
  if (!podglad) throw new BladTworzenia(404, "Nie ma takiego zamówienia tego partnera.");
  if (podglad.blokady.length > 0 || !podglad.zadanie) throw new BladTworzenia(409, podglad.blokady.join(" "));
  const zajete = db
    .update(partnerZamowienia)
    .set({ status: STATUS_WYSYLANIE })
    .where(and(eq(partnerZamowienia.id, zamowienieId), eq(partnerZamowienia.partnerId, partnerId), eq(partnerZamowienia.status, "przyjete"), isNull(partnerZamowienia.numerWlasny)))
    .run();
  if (zajete.changes !== 1) throw new BladTworzenia(409, "Zamówienie zostało w międzyczasie zmienione lub jest już wysyłane.");
  let odp: unknown;
  try {
    odp = await klient.createOrder(podglad.zadanie);
  } catch (e) {
    const opis = e instanceof Error ? e.message : String(e);
    // Wracamy do `przyjete` TYLKO przy jednoznacznej odmowie (4xx — sklep odpowiedział i nie utworzył). Timeout, zerwane połączenie i 5xx są
    // niejednoznaczne: sklep mógł zamówienie przyjąć. Wtedy zostaje `wysylanie` (zamówienie zablokowane) i człowiek sprawdza w Selly.
    if (e instanceof BladSelly && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) {
      db.update(partnerZamowienia).set({ status: "przyjete" }).where(eq(partnerZamowienia.id, zamowienieId)).run();
      throw new BladTworzenia(502, `Selly odrzuciło zamówienie: ${opis}`);
    }
    throw new BladTworzenia(502, `Nie wiadomo, czy Selly utworzyło zamówienie (${opis}). Zamówienie zostało zablokowane — sprawdź je w Selly i dopiero wtedy użyj „Zwolnij”.`);
  }
  const dane = (odp ?? {}) as { data?: { order_id?: unknown; order_number?: unknown }; order_id?: unknown; order_number?: unknown };
  const idSurowe = dane.data?.order_id ?? dane.order_id;
  const idSelly = typeof idSurowe === "number" ? idSurowe : typeof idSurowe === "string" && /^\d+$/.test(idSurowe) ? Number(idSurowe) : null;
  const numerSurowy = dane.data?.order_number ?? dane.order_number;
  const numerWlasny = typeof numerSurowy === "string" && numerSurowy !== "" ? numerSurowy : idSelly !== null ? String(idSelly) : "wysłano (Selly nie zwróciło numeru)";
  db.update(partnerZamowienia).set({ status: STATUS_WYSLANE, numerWlasny }).where(eq(partnerZamowienia.id, zamowienieId)).run();
  return { numerWlasny, idSelly };
}

/** Zwalnia zamówienie zablokowane w `wysylanie` (po sprawdzeniu w Selly, że NIE powstało) — wraca do `przyjete`. Atomowo; inny status → 409. */
export function zwolnijWysylanie(db: Baza, partnerId: number, zamowienieId: number): void {
  const r = db
    .update(partnerZamowienia)
    .set({ status: "przyjete" })
    .where(and(eq(partnerZamowienia.id, zamowienieId), eq(partnerZamowienia.partnerId, partnerId), eq(partnerZamowienia.status, STATUS_WYSYLANIE), isNull(partnerZamowienia.numerWlasny)))
    .run();
  if (r.changes !== 1) throw new BladTworzenia(409, "Zamówienie nie jest w stanie „wysyłanie”.");
}
