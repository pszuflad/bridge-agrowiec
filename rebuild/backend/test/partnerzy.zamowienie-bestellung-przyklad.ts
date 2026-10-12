/**
 * Przykładowe zamówienie TyreWorld w formacie `bestellung` (TopM R6) — ZANONIMIZOWANE: struktura, komentarze i typy pól jak w prawdziwych plikach od partnera
 * (2026-10-12), ale dane osoby, adresu, telefonu i numerów są zmyślone. Prawdziwych plików NIE wolno wkładać do repozytorium (publiczne, dane klientów końcowych).
 */
export const XML_BESTELLUNG = `<?xml version="1.0" encoding="UTF-8"?>
<bestellung>                                          <!-- Definiert den Anfang einer einzelnen Bestellung. Multiple Bestellungen je XML werden nicht unterstützt. -->
  <bestellnummer>2026-100000001</bestellnummer>
  <bestelldatum>2026-03-04 12:24:40</bestelldatum>
  <neutralversand>true</neutralversand>               <!-- optional, 1,true,True,TRUE,J,Ja,JA / 0,false,False,FALSE,N,Nein,NEIN; wenn nicht angegeben, gilt automatisch true -->

  <lieferadresse>                                     <!-- Lieferadresse optional, sonst gilt der Rechnungsempfänger als Lieferadresse -->
    <name><![CDATA[Max Mustermann +490000000000]]></name>
    <name2><![CDATA[]]></name2>   <!-- optional -->
    <strasse><![CDATA[Musterweg 1]]></strasse>
    <plz>12345</plz>
    <ort>Musterstadt</ort>
    <lkz>DE</lkz> <!-- 2-Stelliger Ländercode nach ISO 3166-2  -->
    <land></land> <!-- optional, wird über das Länderkennzeichen zugeordnet -->
    <email>kontakt@example.test</email>
    <telefon>+49(0)000000000</telefon>
  </lieferadresse>

  <positionen>
    <pos>
      <artnr>011300258</artnr>                                  <!-- Primärschlüssel, PFLICHTFELD, 5-Stellige Artikel ID, auch Alphanummerisch (z.B. B29FK) -->
      <menge>1</menge>
      <preis>779.0600</preis>                                  <!-- optional, Je nach Preislisteneinstellung im R6 Setup entweder netto oder brutto -->
      <bezeichnung><![CDATA[CONTINENTAL 420/70 R24 TL 130/133D TRACTOR 70]]></bezeichnung> <!-- optional, Vergleichswert zur internen Bezeichnung -->
    </pos>
    <pos>
      <artnr>013100077</artnr>
      <menge>2</menge>
      <preis>650.0800</preis>
      <bezeichnung><![CDATA[KLEBER 320/85 R36 TL 128/125A8 TRAKER]]></bezeichnung>
    </pos>
  </positionen>

  <bemerkung>
     <![CDATA[Bitte vor Lieferung anrufen]]> <!-- optional, Bezeichnung wird unter den Artikelpositionen angedruckt. -->
  </bemerkung>

  <bemerkungintern>
     <![CDATA[]]>                                 <!-- optional, Information wird in den Auftrag übernommen, ist aber nicht für den Kunden -->
  </bemerkungintern>
</bestellung>
`;
