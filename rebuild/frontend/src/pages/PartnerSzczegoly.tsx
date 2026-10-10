/**
 * Widok `/partnerzy/:id` — konfiguracja partnera (karta PARTNERZY, ticket 222 / PRT-5.2): ustawienia, magazyny, wykluczenia, kraje.
 * Kolumny pliku i pola obliczeniowe: PRT-5.3; logi i pliki: PRT-5.4.
 */
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "wouter";

import { PageHeader } from "@/components/PageHeader";
import { KLUCZ_PARTNERZY, komunikatBledu, type SzczegolyPartnera } from "./partnerzy/api";
import { AkcjePartnera, LogiPartnera } from "./partnerzy/GenerowanieILogi";
import { KrajePartnera } from "./partnerzy/KrajePartnera";
import { MagazynyPartnera, WykluczeniaPartnera } from "./partnerzy/MagazynyIWykluczenia";
import { KolumnyPliku, PolaObliczeniowe } from "./partnerzy/PolaIKolumny";
import { PodgladPliku } from "./partnerzy/PodgladPliku";
import { UstawieniaPartnera } from "./partnerzy/UstawieniaPartnera";

export function PartnerSzczegoly() {
  const { id } = useParams<{ id: string }>();
  const { data, isPending, isError, error } = useQuery<SzczegolyPartnera | null>({ queryKey: [KLUCZ_PARTNERZY, id], refetchOnMount: "always" });

  return (
    <div className="space-y-4">
      <PageHeader
        title={data ? `Partner: ${data.nazwa}` : "Partner"}
        subtitle="Konfiguracja pliku cennika: magazyny, kraje, narzuty, kursy i harmonogram."
        actions={
          <Link href="/partnerzy" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" data-testid="link-partnerzy-wstecz">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Wszyscy partnerzy
          </Link>
        }
      />
      {isError ? (
        <p className="rounded-md bg-destructive/10 px-3.5 py-3 text-sm text-destructive" role="alert" data-testid="text-partner-blad">{komunikatBledu(error)}</p>
      ) : isPending ? (
        <p className="text-sm text-muted-foreground">Ładowanie…</p>
      ) : data ? (
        <>
          <AkcjePartnera partner={data} />
          {/* `key` z `zmieniono` — po zapisie i odświeżeniu formularze startują od zapisanych wartości */}
          <UstawieniaPartnera key={`u-${data.zmieniono}`} partner={data} />
          <MagazynyPartnera key={`m-${data.magazyny.join(",")}`} partner={data} />
          <WykluczeniaPartnera key={`w-${data.wykluczenia.join(",")}`} partner={data} />
          <KrajePartnera partner={data} />
          {/* `key` z zapisanych danych — po zapisie formularz startuje od wartości z serwera */}
          <PolaObliczeniowe key={`p-${JSON.stringify(data.polaObliczeniowe)}-${data.kraje.length}`} partner={data} />
          <KolumnyPliku key={`k-${JSON.stringify(data.kolumny)}-${data.polaObliczeniowe.length}-${data.kraje.length}`} partner={data} />
          <PodgladPliku partner={data} />
          <LogiPartnera partner={data} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Nie ma takiego partnera.</p>
      )}
    </div>
  );
}
