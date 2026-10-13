/** Sekcja „Ustawienia” w konfiguracji partnera (ticket 222, PRT-5.2) — pola z `PUT /api/partnerzy/:id`. */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { KLUCZ_PARTNERZY, ZAOKRAGLANIA, komunikatBledu, liczbaZPola, zapiszUstawienia, type SzczegolyPartnera } from "./api";

const KLASA_SELECT = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const SEPARATORY = [
  { wartosc: ";", etykieta: "średnik ( ; )" },
  { wartosc: ",", etykieta: "przecinek ( , )" },
  { wartosc: "\t", etykieta: "tabulator" },
  { wartosc: "|", etykieta: "kreska pionowa ( | )" },
];

export function Pole({ etykieta, children }: { etykieta: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-xs font-medium text-muted-foreground">{etykieta}</span>
      {children}
    </label>
  );
}

export function UstawieniaPartnera({ partner }: { partner: SzczegolyPartnera }) {
  const klient = useQueryClient();
  const { toast } = useToast();
  const [nazwa, ustawNazwe] = useState(partner.nazwa);
  const [stanMin, ustawStanMin] = useState(String(partner.stanMin));
  const [zaokraglanie, ustawZaokraglanie] = useState(partner.zaokraglanie);
  const [harmonogram, ustawHarmonogram] = useState(partner.harmonogramMinuty === null ? "" : String(partner.harmonogramMinuty));
  const [tolerancja, ustawTolerancje] = useState(partner.tolerancjaCenyProc === null ? "" : String(partner.tolerancjaCenyProc));
  const [format, ustawFormat] = useState(partner.formatPliku);
  const [separator, ustawSeparator] = useState(partner.csvSeparator);
  const [ftp, ustawFtp] = useState(partner.kanalFtp);
  const [email, ustawEmail] = useState(partner.kanalEmail);
  const [skrzynka, ustawSkrzynke] = useState(partner.emailSkrzynka ?? "");
  const [nazwaPliku, ustawNazwePliku] = useState(partner.nazwaPliku ?? "");
  const [faktura, ustawFakture] = useState({
    fakturaNazwa: partner.fakturaNazwa ?? "",
    fakturaNip: partner.fakturaNip ?? "",
    fakturaUlica: partner.fakturaUlica ?? "",
    fakturaKod: partner.fakturaKod ?? "",
    fakturaMiasto: partner.fakturaMiasto ?? "",
    fakturaKraj: partner.fakturaKraj ?? "",
  });
  // Selly: jedyne ustawienie to status nowego zamówienia (płatność, dostawa i VAT 101 są stałymi po stronie serwera); kontakt zamawiającego do zamówienia.
  const [sellyStatus, ustawSellyStatus] = useState(partner.sellyStatusId?.toString() ?? "");
  const [kontaktEmail, ustawKontaktEmail] = useState(partner.kontaktEmail ?? "");
  const [kontaktTelefon, ustawKontaktTelefon] = useState(partner.kontaktTelefon ?? "");
  const zmienFakture = (pole: keyof typeof faktura, wartosc: string) => ustawFakture((f) => ({ ...f, [pole]: wartosc }));

  const zapis = useMutation<void, Error, void>({
    mutationFn: async () => {
      const stan = liczbaZPola(stanMin);
      const harm = liczbaZPola(harmonogram);
      const tol = liczbaZPola(tolerancja);
      if (nazwa.trim() === "") throw new Error("Nazwa jest wymagana.");
      if (stan === null || !Number.isInteger(stan) || stan < 0) throw new Error("Stan minimalny musi być liczbą całkowitą ≥ 0.");
      if (harm !== null && (!Number.isInteger(harm) || harm < 1)) throw new Error("Harmonogram musi być liczbą minut ≥ 1 albo puste (bez harmonogramu).");
      if (tol !== null && (Number.isNaN(tol) || tol < 0)) throw new Error("Tolerancja ceny musi być liczbą ≥ 0 albo puste.");
      const np = nazwaPliku.trim();
      if (np !== "" && !/^[A-Za-z0-9_-]{1,60}$/.test(np)) throw new Error("Nazwa pliku: litery, cyfry, _ i - (do 60 znaków).");
      const st = sellyStatus.trim();
      if (st !== "" && !/^\d+$/.test(st)) throw new Error("Identyfikator statusu Selly musi być liczbą całkowitą (albo puste).");
      const em = kontaktEmail.trim();
      if (em !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) throw new Error("Kontakt: e-mail musi być poprawnym adresem (albo puste).");
      await zapiszUstawienia(partner.id, {
        sellyStatusId: st === "" ? null : Number(st),
        kontaktEmail: em === "" ? null : em,
        kontaktTelefon: kontaktTelefon.trim() === "" ? null : kontaktTelefon.trim(),
        nazwa: nazwa.trim(), stanMin: stan, zaokraglanie, harmonogramMinuty: harm, tolerancjaCenyProc: tol,
        formatPliku: format, csvSeparator: separator, kanalFtp: ftp, kanalEmail: email, emailSkrzynka: skrzynka.trim() === "" ? null : skrzynka.trim(), nazwaPliku: np === "" ? null : np,
        ...Object.fromEntries(Object.entries(faktura).map(([k, v]) => [k, v.trim() === "" ? null : k === "fakturaKraj" ? v.trim().toUpperCase() : v.trim()])),
      });
    },
    onSuccess: async () => {
      toast({ title: "Zapisano ustawienia partnera" });
      await klient.invalidateQueries({ queryKey: [KLUCZ_PARTNERZY] });
    },
    onError: (e) => toast({ title: "Nie udało się zapisać ustawień", description: komunikatBledu(e), variant: "destructive" }),
  });

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <h2 className="text-sm font-semibold">Ustawienia</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Pole etykieta="Nazwa"><Input value={nazwa} maxLength={80} onChange={(e) => ustawNazwe(e.target.value)} data-testid="input-ustawienia-nazwa" /></Pole>
          <Pole etykieta="Stan minimalny eksportu (od ilu sztuk)"><Input inputMode="numeric" value={stanMin} onChange={(e) => ustawStanMin(e.target.value)} data-testid="input-ustawienia-stan-min" /></Pole>
          <Pole etykieta="Zaokrąglanie cen">
            <select className={KLASA_SELECT} value={zaokraglanie} onChange={(e) => ustawZaokraglanie(e.target.value)} data-testid="select-ustawienia-zaokraglanie">
              {ZAOKRAGLANIA.map((z) => <option key={z.wartosc} value={z.wartosc}>{z.etykieta}</option>)}
            </select>
          </Pole>
          <Pole etykieta="Harmonogram (co ile minut; puste = brak)"><Input inputMode="numeric" value={harmonogram} onChange={(e) => ustawHarmonogram(e.target.value)} data-testid="input-ustawienia-harmonogram" /></Pole>
          <Pole etykieta="Tolerancja ceny w zamówieniach (%; puste = brak)"><Input inputMode="decimal" value={tolerancja} onChange={(e) => ustawTolerancje(e.target.value)} data-testid="input-ustawienia-tolerancja" /></Pole>
          <Pole etykieta="Format pliku">
            <select className={KLASA_SELECT} value={format} onChange={(e) => ustawFormat(e.target.value)} data-testid="select-ustawienia-format">
              <option value="csv">CSV</option>
              <option value="xml">XML (wzorzec Ceneo)</option>
            </select>
          </Pole>
          <Pole etykieta="Separator CSV">
            <select className={KLASA_SELECT} value={separator} onChange={(e) => ustawSeparator(e.target.value)} data-testid="select-ustawienia-separator">
              {SEPARATORY.map((s) => <option key={s.wartosc} value={s.wartosc}>{s.etykieta}</option>)}
            </select>
          </Pole>
          <Pole etykieta="Nazwa pliku cennika (bez rozszerzenia i kraju)"><Input value={nazwaPliku} placeholder="np. adtyres_agrowiec" onChange={(e) => ustawNazwePliku(e.target.value)} data-testid="input-ustawienia-nazwa-pliku" /></Pole>
          <Pole etykieta="Faktura: nazwa firmy"><Input value={faktura.fakturaNazwa} onChange={(e) => zmienFakture("fakturaNazwa", e.target.value)} data-testid="input-ustawienia-faktura-nazwa" /></Pole>
          <Pole etykieta="Faktura: NIP"><Input value={faktura.fakturaNip} onChange={(e) => zmienFakture("fakturaNip", e.target.value)} data-testid="input-ustawienia-faktura-nip" /></Pole>
          <Pole etykieta="Faktura: ulica i numer"><Input value={faktura.fakturaUlica} onChange={(e) => zmienFakture("fakturaUlica", e.target.value)} data-testid="input-ustawienia-faktura-ulica" /></Pole>
          <Pole etykieta="Faktura: kod pocztowy"><Input value={faktura.fakturaKod} onChange={(e) => zmienFakture("fakturaKod", e.target.value)} data-testid="input-ustawienia-faktura-kod" /></Pole>
          <Pole etykieta="Faktura: miasto"><Input value={faktura.fakturaMiasto} onChange={(e) => zmienFakture("fakturaMiasto", e.target.value)} data-testid="input-ustawienia-faktura-miasto" /></Pole>
          <Pole etykieta="Selly: ID statusu nowego zamówienia"><Input inputMode="numeric" value={sellyStatus} onChange={(e) => ustawSellyStatus(e.target.value)} data-testid="input-ustawienia-selly-status" /></Pole>
          <Pole etykieta="Kontakt zamawiającego: e-mail"><Input value={kontaktEmail} onChange={(e) => ustawKontaktEmail(e.target.value)} data-testid="input-ustawienia-kontakt-email" /></Pole>
          <Pole etykieta="Kontakt zamawiającego: telefon"><Input value={kontaktTelefon} onChange={(e) => ustawKontaktTelefon(e.target.value)} data-testid="input-ustawienia-kontakt-telefon" /></Pole>
          <Pole etykieta="Faktura: kraj (kod, np. AD, ES)"><Input maxLength={2} value={faktura.fakturaKraj} onChange={(e) => zmienFakture("fakturaKraj", e.target.value)} data-testid="input-ustawienia-faktura-kraj" /></Pole>
          <Pole etykieta="Skrzynka e-mail do zamówień"><Input type="email" value={skrzynka} onChange={(e) => ustawSkrzynke(e.target.value)} data-testid="input-ustawienia-skrzynka" /></Pole>
        </div>
        <div className="flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={ftp} onChange={(e) => ustawFtp(e.target.checked)} data-testid="checkbox-ustawienia-ftp" />Zamówienia przez FTP</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={email} onChange={(e) => ustawEmail(e.target.checked)} data-testid="checkbox-ustawienia-email" />Zamówienia przez e-mail</label>
        </div>
        <Button size="sm" onClick={() => zapis.mutate()} disabled={zapis.isPending} data-testid="button-ustawienia-zapisz">Zapisz ustawienia</Button>
      </CardContent>
    </Card>
  );
}
