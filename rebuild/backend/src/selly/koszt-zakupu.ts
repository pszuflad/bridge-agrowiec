/** Bridge przechowuje koszt netto. Importer `wariant_cena_zakupu` Selly czyta brutto. */
export function kosztZakupuBrutto(netto: number | null, vat: number | null): number | null {
  if (netto === null) return null;
  if (!Number.isFinite(netto) || netto < 0 ||
      vat === null || !Number.isFinite(vat) || vat < 0 || vat > 100) {
    throw new Error("Selly: nieprawidłowy koszt netto lub VAT — eksport kosztu zablokowany");
  }
  return Math.round((netto * (1 + vat / 100) + Number.EPSILON) * 100) / 100;
}
