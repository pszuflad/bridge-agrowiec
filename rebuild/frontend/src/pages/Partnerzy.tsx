/**
 * Widok `/partnerzy` — lista partnerów B2B (karta PARTNERZY, ticket 221 / PRT-5.1).
 *
 * NOWA funkcjonalność, nie port widoku z oryginału. Pokazuje partnerów z ich podstawowymi ustawieniami, pozwala dodać partnera
 * i aktywować/dezaktywować go BEZ usuwania (nowy partner jest nieaktywny). Konfiguracja szczegółowa to PRT-5.2, kolumny PRT-5.3, logi PRT-5.4.
 * Stan ostatniego generowania to ostatni wpis `generowanie` z logu operacji partnera.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "wouter";

import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  KLUCZ_PARTNERZY,
  dodajPartnera,
  komunikatBledu,
  opisHarmonogramu,
  ustawAktywnosc,
  type ListaLogow,
  type ListaPartnerow,
  type PartnerNaLiscie,
} from "./partnerzy/api";

function OstatnieGenerowanie({ id }: { id: number }) {
  const { data, isError } = useQuery<ListaLogow | null>({
    queryKey: [KLUCZ_PARTNERZY, String(id), "logi?limit=1"],
    refetchOnMount: "always",
  });
  const wpis = data?.logi[0];
  if (isError) return <span className="text-muted-foreground">nie udało się wczytać</span>;
  if (!wpis) return <span className="text-muted-foreground">jeszcze nie generowano</span>;
  return (
    <span title={wpis.opis} data-testid={`text-partner-ostatnie-${id}`}>
      {new Date(wpis.kiedy).toLocaleString("pl-PL")}
      <span className="block max-w-xs truncate text-xs text-muted-foreground">{wpis.opis}</span>
    </span>
  );
}

export function Partnerzy() {
  const klient = useQueryClient();
  const { toast } = useToast();
  const [nazwa, ustawNazwe] = useState("");

  const lista = useQuery<ListaPartnerow | null>({ queryKey: [KLUCZ_PARTNERZY], refetchOnMount: "always" });
  const partnerzy = lista.data?.partnerzy ?? [];

  const odswiez = () => klient.invalidateQueries({ queryKey: [KLUCZ_PARTNERZY] });
  const blad = (tytul: string) => (e: Error) => toast({ title: tytul, description: komunikatBledu(e), variant: "destructive" });

  const dodawanie = useMutation<void, Error, string>({
    mutationFn: dodajPartnera,
    onSuccess: async (_, dodana) => {
      ustawNazwe("");
      toast({ title: "Dodano partnera", description: `${dodana} — nieaktywny, skonfiguruj go i aktywuj.` });
      await odswiez();
    },
    onError: blad("Nie udało się dodać partnera"),
  });
  const aktywacja = useMutation<void, Error, PartnerNaLiscie>({
    mutationFn: (p) => ustawAktywnosc(p.id, !p.aktywny),
    onSuccess: async (_, p) => {
      toast({ title: p.aktywny ? "Partner dezaktywowany" : "Partner aktywowany", description: p.nazwa });
      await odswiez();
    },
    onError: blad("Nie udało się zmienić aktywności"),
  });

  const wyslij = (e: FormEvent) => {
    e.preventDefault();
    const czysta = nazwa.trim();
    if (czysta) dodawanie.mutate(czysta);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Partnerzy B2B"
        subtitle="Partnerzy, którym Bridge generuje cenniki (EUR). Każdy ma własne magazyny, kraje, narzuty i harmonogram."
      />

      <Card>
        <CardContent className="p-4">
          <form className="flex flex-wrap items-center gap-2.5" onSubmit={wyslij}>
            <Input
              className="w-64"
              placeholder="Nazwa nowego partnera"
              aria-label="Nazwa nowego partnera"
              data-testid="input-partner-nazwa"
              value={nazwa}
              maxLength={80}
              onChange={(e) => ustawNazwe(e.target.value)}
            />
            <Button type="submit" size="sm" className="gap-1.5" disabled={dodawanie.isPending || nazwa.trim() === ""} data-testid="button-partner-dodaj">
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Dodaj partnera
            </Button>
          </form>
        </CardContent>
      </Card>

      {lista.isError ? (
        <p className="rounded-md bg-destructive/10 px-3.5 py-3 text-sm text-destructive" role="alert" data-testid="text-partnerzy-blad">
          {komunikatBledu(lista.error)}
        </p>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {lista.isPending ? (
            <p className="p-6 text-sm text-muted-foreground">Ładowanie…</p>
          ) : lista.isError ? null : partnerzy.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground" data-testid="text-partnerzy-pusto">
              Nie ma jeszcze żadnego partnera. Dodaj pierwszego powyżej.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Partner</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Harmonogram</th>
                    <th className="px-4 py-3 font-medium">Magazyny / kraje</th>
                    <th className="px-4 py-3 font-medium">Ostatnie generowanie</th>
                    <th className="px-4 py-3 font-medium" aria-label="Akcje" />
                  </tr>
                </thead>
                <tbody>
                  {partnerzy.map((p) => (
                    <tr key={p.id} className="border-b last:border-0" data-testid={`row-partner-${p.id}`}>
                      <td className="px-4 py-3 font-medium">{p.nazwa}</td>
                      <td className="px-4 py-3">
                        <Badge variant={p.aktywny ? "default" : "secondary"} data-testid={`badge-partner-status-${p.id}`}>
                          {p.aktywny ? "Aktywny" : "Nieaktywny"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{opisHarmonogramu(p.harmonogramMinuty)}</td>
                      <td className="px-4 py-3">
                        {p.liczbaMagazynow} mag. · {p.liczbaKrajow} {p.liczbaKrajow === 1 ? "kraj" : "krajów"}
                        {p.liczbaWykluczen > 0 ? ` · ${p.liczbaWykluczen} wykl.` : ""}
                      </td>
                      <td className="px-4 py-3">
                        <OstatnieGenerowanie id={p.id} />
                      </td>
                      <td className="space-x-2 whitespace-nowrap px-4 py-3 text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/partnerzy/${p.id}`} data-testid={`link-partner-konfiguruj-${p.id}`}>Konfiguruj</Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={aktywacja.isPending}
                          data-testid={`button-partner-aktywnosc-${p.id}`}
                          onClick={() => aktywacja.mutate(p)}
                        >
                          {p.aktywny ? "Dezaktywuj" : "Aktywuj"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
