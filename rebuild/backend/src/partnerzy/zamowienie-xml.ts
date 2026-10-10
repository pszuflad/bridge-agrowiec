// Parser zamówienia partnera — `DOCUMENTORDER` (karta PARTNERZY, ticket 227 / PRT-7.1). Przykład pliku: `docs/karty/PARTNERZY/karta.md`.
//
// Parser zgłasza WYŁĄCZNIE błędy strukturalne (zły XML, brak `NUMBER`, brak pozycji, pusty `CODE`, ilość lub cena nieliczbowa). Walidacja biznesowa
// (nieznany kod, brak stanu, cena poza tolerancją) należy do PRT-7.4: takie zamówienie ma trafić do Selly ze statusem „błąd importu”, więc nie może
// zginąć tutaj. `CODE` zostaje TEKSTEM — zera wiodące są znaczące (`011200284`).
//
// Własny, mały czytnik XML zamiast biblioteki: wejście pochodzi od partnera, więc DOCTYPE/ENTITY są ODRZUCANE (brak XXE i „billion laughs”),
// a z encji obsługujemy tylko pięć predefiniowanych i numeryczne. Atrybuty są ignorowane (format ich nie używa). Skaner jest liniowy (bez regexów po wejściu).

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

/** Maksymalny rozmiar pliku zamówienia (znaki) i liczba pozycji — chroni przed plikiem z kosmosu i rozdęciem bazy (`surowy_xml` zapisujemy w całości). */
export const MAKS_ROZMIAR_XML = 2_000_000;
export const MAKS_POZYCJI = 5_000;

const bladXml = (opis: string): BladZamowienia => new BladZamowienia([`Niepoprawny XML (${opis}).`]);
const ZNAK_NAZWY = /[^\s/>=<"'!?]/;

/**
 * Czyta XML do drzewa. Skaner ręczny (indexOf), liniowy — żadnego regexu po niezaufanym wejściu (ReDoS).
 * Rzuca `BladZamowienia` przy niepoprawnej strukturze, DOCTYPE/ENTITY, tekście poza elementem głównym i przekroczeniu limitu rozmiaru.
 */
function czytajXml(xml: string): Wezel {
  if (xml.length > MAKS_ROZMIAR_XML) throw new BladZamowienia([`Plik jest za duży (limit ${MAKS_ROZMIAR_XML} znaków).`]);
  const tekst = xml.charCodeAt(0) === 0xfeff ? xml.slice(1) : xml;
  const korzen: Wezel = { nazwa: "#korzen", dzieci: [], tekst: "" };
  const stos: Wezel[] = [korzen];
  const n = tekst.length;
  let i = 0;
  while (i < n) {
    const biezacy = stos[stos.length - 1]!;
    if (tekst[i] !== "<") {
      const koniec = tekst.indexOf("<", i);
      const kawalek = tekst.slice(i, koniec === -1 ? n : koniec);
      if (stos.length === 1 && kawalek.trim() !== "") throw bladXml("tekst poza elementem głównym");
      biezacy.tekst += dekoduj(kawalek);
      i = koniec === -1 ? n : koniec;
      continue;
    }
    if (tekst.startsWith("<!--", i)) {
      const k = tekst.indexOf("-->", i + 4);
      if (k === -1) throw bladXml("niezamknięty komentarz");
      i = k + 3;
    } else if (tekst.startsWith("<![CDATA[", i)) {
      const k = tekst.indexOf("]]>", i + 9);
      if (k === -1) throw bladXml("niezamknięta sekcja CDATA");
      if (stos.length === 1) throw bladXml("CDATA poza elementem głównym");
      biezacy.tekst += tekst.slice(i + 9, k);
      i = k + 3;
    } else if (tekst.startsWith("<?", i)) {
      const k = tekst.indexOf("?>", i + 2);
      if (k === -1) throw bladXml("niezamknięta instrukcja przetwarzania");
      i = k + 2;
    } else if (tekst.startsWith("<!", i)) {
      // <!DOCTYPE …>, <!ENTITY …> i każda inna deklaracja — nie przyjmujemy (XXE, „billion laughs”).
      throw new BladZamowienia(["Plik zawiera DOCTYPE/ENTITY — odrzucony ze względów bezpieczeństwa."]);
    } else if (tekst[i + 1] === "/") {
      const k = tekst.indexOf(">", i + 2);
      if (k === -1) throw bladXml("niezamknięty znacznik");
      const nazwa = tekst.slice(i + 2, k).trim();
      if (stos.length < 2 || biezacy.nazwa !== nazwa) throw bladXml(`zamknięcie </${nazwa}> bez pasującego otwarcia`);
      stos.pop();
      i = k + 1;
    } else {
      // Znacznik otwierający: nazwa, atrybuty (ignorowane; cudzysłowy mogą zawierać „>”), opcjonalne „/”.
      let p = i + 1;
      while (p < n && ZNAK_NAZWY.test(tekst[p]!)) p++;
      const nazwa = tekst.slice(i + 1, p);
      if (nazwa === "") throw bladXml("pusta nazwa znacznika");
      let cudzyslow: string | null = null;
      while (p < n && (cudzyslow !== null || tekst[p] !== ">")) {
        const c = tekst[p]!;
        if (cudzyslow !== null) {
          if (c === cudzyslow) cudzyslow = null;
        } else if (c === '"' || c === "'") cudzyslow = c;
        p++;
      }
      if (p >= n) throw bladXml("niezamknięty znacznik");
      const samozamykajacy = tekst[p - 1] === "/" && cudzyslow === null;
      const w: Wezel = { nazwa, dzieci: [], tekst: "" };
      biezacy.dzieci.push(w);
      if (!samozamykajacy) stos.push(w);
      i = p + 1;
    }
  }
  if (stos.length !== 1) throw bladXml(`niezamknięty element <${stos[stos.length - 1]!.nazwa}>`);
  if (korzen.dzieci.length !== 1) throw bladXml("oczekiwano jednego elementu głównego");
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
  if (produkty.length > MAKS_POZYCJI) throw new BladZamowienia([`Za dużo pozycji (${produkty.length}, limit ${MAKS_POZYCJI}).`]);
  if (produkty.length === 0) bledy.push("Brak pozycji zamówienia (PRODUCTS/PRODUCT).");
  produkty.forEach((p, i) => {
    const lp = i + 1;
    const kod = tekstDziecka(p, "CODE");
    if (!kod) bledy.push(`Pozycja ${lp}: brak CODE.`);
    const iloscTekst = tekstDziecka(p, "ORDERQUANTITY");
    const ilosc = iloscTekst === null ? null : liczba(iloscTekst);
    if (ilosc === null || !Number.isSafeInteger(ilosc) || ilosc < 1) bledy.push(`Pozycja ${lp}: ORDERQUANTITY musi być liczbą całkowitą ≥ 1.`);
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
