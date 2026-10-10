// Parser zamówienia partnera — `DOCUMENTORDER` (karta PARTNERZY, ticket 227 / PRT-7.1). Przykład pliku: `docs/karty/PARTNERZY/karta.md`.
//
// Parser zgłasza WYŁĄCZNIE błędy strukturalne (zły XML, brak `NUMBER`, brak pozycji, pusty `CODE`, ilość lub cena nieliczbowa). Walidacja biznesowa
// (nieznany kod, brak stanu, cena poza tolerancją) należy do PRT-7.4: takie zamówienie ma trafić do Selly ze statusem „błąd importu”, więc nie może
// zginąć tutaj. `CODE` zostaje TEKSTEM — zera wiodące są znaczące (`011200284`).
//
// Własny, mały czytnik XML zamiast biblioteki: wejście pochodzi od partnera, więc DOCTYPE/ENTITY są ODRZUCANE (brak XXE i „billion laughs”),
// a z encji obsługujemy tylko pięć predefiniowanych i numeryczne. Atrybuty są ignorowane (format ich nie używa).

export class BladZamowienia extends Error {
  constructor(public readonly bledy: string[]) {
    super(bledy.join("; "));
    this.name = "BladZamowienia";
  }
}

export type PozycjaZamowienia = { lp: number; kod: string; nazwa: string | null; ilosc: number; cenaSprzedazy: number | null };

export type Zamowienie = {
  numerPartnera: string;
  dataZamowienia: string | null;
  dataDostawy: string | null;
  waluta: string | null;
  kosztDostawy: number | null;
  krajDostawy: string | null;
  /** Płaska mapa dzieci `INVOICE` / `DELIVERY` (nazwa elementu → tekst); pełny zestaw pól ustala partner. */
  faktura: Record<string, string>;
  dostawa: Record<string, string>;
  pozycje: PozycjaZamowienia[];
};

type Wezel = { nazwa: string; dzieci: Wezel[]; tekst: string };

const ENCJE: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function dekoduj(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-z]+);/g, (calosc, e: string) => {
    if (e.startsWith("#")) {
      const kod = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isInteger(kod) && kod > 0 && kod <= 0x10ffff ? String.fromCodePoint(kod) : calosc;
    }
    return ENCJE[e] ?? calosc;
  });
}

/** Czyta XML do drzewa. Rzuca `BladZamowienia` przy niepoprawnej strukturze lub DOCTYPE/ENTITY. */
function czytajXml(xml: string): Wezel {
  const tekst = xml.replace(/^\uFEFF/, "");
  if (/<!DOCTYPE|<!ENTITY/i.test(tekst)) throw new BladZamowienia(["Plik zawiera DOCTYPE/ENTITY — odrzucony ze względów bezpieczeństwa."]);
  const korzen: Wezel = { nazwa: "#korzen", dzieci: [], tekst: "" };
  const stos: Wezel[] = [korzen];
  const wzor = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<\/\s*([^\s>]+)\s*>|<([^\s/>!?]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  let ostatni = 0;
  while ((m = wzor.exec(tekst)) !== null) {
    if (m.index !== ostatni) throw new BladZamowienia(["Niepoprawny XML (nieoczekiwany znak)."]);
    ostatni = wzor.lastIndex;
    const [, cdata, zamykajacy, otwierajacy, , samozamykajacy, zwykly] = m;
    const biezacy = stos[stos.length - 1]!;
    if (cdata !== undefined) biezacy.tekst += cdata;
    else if (zwykly !== undefined) biezacy.tekst += dekoduj(zwykly);
    else if (zamykajacy !== undefined) {
      if (stos.length < 2 || biezacy.nazwa !== zamykajacy) throw new BladZamowienia([`Niepoprawny XML (zamknięcie </${zamykajacy}> bez pasującego otwarcia).`]);
      stos.pop();
    } else if (otwierajacy !== undefined) {
      const w: Wezel = { nazwa: otwierajacy, dzieci: [], tekst: "" };
      biezacy.dzieci.push(w);
      if (!samozamykajacy) stos.push(w);
    }
  }
  if (ostatni !== tekst.length) throw new BladZamowienia(["Niepoprawny XML (nieoczekiwany znak)."]);
  if (stos.length !== 1) throw new BladZamowienia([`Niepoprawny XML (niezamknięty element <${stos[stos.length - 1]!.nazwa}>).`]);
  if (korzen.dzieci.length !== 1) throw new BladZamowienia(["Niepoprawny XML (oczekiwano jednego elementu głównego)."]);
  return korzen.dzieci[0]!;
}

const dziecko = (w: Wezel, nazwa: string): Wezel | undefined => w.dzieci.find((d) => d.nazwa === nazwa);
const tekstDziecka = (w: Wezel | undefined, nazwa: string): string | null => {
  const d = w ? dziecko(w, nazwa) : undefined;
  const t = d?.tekst.trim();
  return t ? t : null;
};
const mapa = (w: Wezel | undefined): Record<string, string> => {
  const wynik: Record<string, string> = {};
  for (const d of w?.dzieci ?? []) if (d.dzieci.length === 0) wynik[d.nazwa] = d.tekst.trim();
  return wynik;
};
/** Liczba z kropką dziesiętną; przecinek też przyjmujemy (eksporty różnych systemów). */
const liczba = (s: string): number | null => {
  const t = s.trim().replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
};

export function parsujZamowienie(xml: string): Zamowienie {
  const korzen = czytajXml(xml);
  if (korzen.nazwa !== "DOCUMENTORDER") throw new BladZamowienia([`Oczekiwano elementu DOCUMENTORDER, jest <${korzen.nazwa}>.`]);
  const bledy: string[] = [];

  // `NUMBER` zamówienia jest dzieckiem korzenia (INVOICE też ma własny NUMBER — nie mylić).
  const numerPartnera = tekstDziecka(korzen, "NUMBER");
  if (!numerPartnera) bledy.push("Brak numeru zamówienia (NUMBER).");

  const pozycje: PozycjaZamowienia[] = [];
  const produkty = (dziecko(korzen, "PRODUCTS")?.dzieci ?? []).filter((p) => p.nazwa === "PRODUCT");
  if (produkty.length === 0) bledy.push("Brak pozycji zamówienia (PRODUCTS/PRODUCT).");
  produkty.forEach((p, i) => {
    const lp = i + 1;
    const kod = tekstDziecka(p, "CODE");
    if (!kod) bledy.push(`Pozycja ${lp}: brak CODE.`);
    const iloscTekst = tekstDziecka(p, "ORDERQUANTITY");
    const ilosc = iloscTekst === null ? null : liczba(iloscTekst);
    if (ilosc === null || !Number.isInteger(ilosc) || ilosc < 1) bledy.push(`Pozycja ${lp}: ORDERQUANTITY musi być liczbą całkowitą ≥ 1.`);
    const cenaTekst = tekstDziecka(p, "SELL_PRICE");
    const cena = cenaTekst === null ? null : liczba(cenaTekst);
    if (cenaTekst !== null && (cena === null || cena < 0)) bledy.push(`Pozycja ${lp}: SELL_PRICE nie jest poprawną ceną.`);
    if (kod && ilosc !== null) pozycje.push({ lp, kod, nazwa: tekstDziecka(p, "NAME"), ilosc, cenaSprzedazy: cena });
  });

  const dostawaWezel = dziecko(korzen, "DELIVERY");
  const kosztTekst = tekstDziecka(dostawaWezel, "DELIVERY_COST");
  const koszt = kosztTekst === null ? null : liczba(kosztTekst);
  if (kosztTekst !== null && koszt === null) bledy.push("DELIVERY_COST nie jest liczbą.");

  if (bledy.length > 0) throw new BladZamowienia(bledy);
  return {
    numerPartnera: numerPartnera!,
    dataZamowienia: tekstDziecka(korzen, "DATE"),
    dataDostawy: tekstDziecka(korzen, "DELIVERYDATE"),
    waluta: tekstDziecka(korzen, "ORDERCURRENCY"),
    kosztDostawy: koszt,
    krajDostawy: tekstDziecka(dostawaWezel, "COUNTRY"),
    faktura: mapa(dziecko(korzen, "INVOICE")),
    dostawa: mapa(dostawaWezel),
    pozycje,
  };
}
