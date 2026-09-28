/**
 * Dane pseudo-alertów katalogowych — karta P6.2 (ticket `77-FEATURE-pseudo-alerty-katalogowe`).
 *
 * JEDNO miejsce, z którego korzystają zakładka „Katalog" na `/alerty` i Pulpit. Oba biorą te same
 * dwa zapytania (`["/api/products"]` — Pulpit ładuje je i tak — oraz statusy), więc react-query
 * trzyma je we wspólnym cache i liczenie nie dokłada żadnego żądania.
 *
 * Synchronizacja Pulpitu po zmianie statusu (łatki `ackalerts` pkt 2 i 3 z 04.09 — tam przez
 * IndexedDB i `window.dispatchEvent("alerty-statusy-updated")`) dzieje się tu przez
 * UNIEWAŻNIENIE klucza statusów: każdy komponent, który go czyta, dostaje świeże dane.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { BAZA_API, naglowki, rzucGdyBlad, zadanie } from "@/lib/api";
import { useProdukty } from "@/pages/pulpit/api";

import { policzAlertyKatalogu, type AlertKatalogu } from "./silnik-katalogu";
import type { StatusAlertu } from "./statusy";

export const KLUCZ_STATUSOW_KATALOGU = ["/api/alerty-katalogu/statusy"] as const;

/** Wiersz `GET /api/alerty-katalogu/statusy` — opis w `contract/openapi.yaml`. */
export type WpisStatusuKatalogu = {
  id: string;
  status: string;
  kto: string | null;
  kiedy: string;
};

/**
 * Własny `queryFn`, nie domyślny z `queryClient.ts` (`on401: returnNull`): bez statusów
 * silnik pokazałby WSZYSTKIE alerty jako „nowe", a to jest kłamstwo, nie brak danych.
 * Błąd ma być błędem.
 */
export async function pobierzStatusyKatalogu(): Promise<WpisStatusuKatalogu[]> {
  const odpowiedz = await fetch(`${BAZA_API}/api/alerty-katalogu/statusy`, {
    headers: naglowki(false),
    credentials: "include",
  });
  await rzucGdyBlad(odpowiedz);
  return (await odpowiedz.json()) as WpisStatusuKatalogu[];
}

/**
 * Jeden status dla wielu alertów — jedno żądanie (przycisk przy alercie i „Zaakceptuj
 * wszystko"). `nowy` kasuje wpis na serwerze. Zwraca liczbę przetworzonych identyfikatorów.
 */
export async function zmienStatusyKatalogu(ids: string[], status: StatusAlertu): Promise<number> {
  const odpowiedz = await zadanie("PUT", "/api/alerty-katalogu/statusy", { ids, status });
  return ((await odpowiedz.json()) as { zmienione: number }).zmienione;
}

export type StanAlertowKatalogu = {
  /** `null`, dopóki nie ma kompletu danych (katalog ORAZ statusy) albo gdy któreś padło. */
  alerty: AlertKatalogu[] | null;
  ladowanie: boolean;
  blad: boolean;
};

/**
 * Pseudo-alerty liczone na żywo — odpowiednik `m.useMemo(() => pv(e, o), [e, o])` z `HT()`/`N2()`.
 * Koszt liczenia na `db/snapshot.db` (7405 produktów): mediana ok. 25 ms (pomiar w raporcie P6.2).
 */
export function useAlertyKatalogu(): StanAlertowKatalogu {
  const produkty = useProdukty();
  const statusy = useQuery<WpisStatusuKatalogu[]>({
    queryKey: KLUCZ_STATUSOW_KATALOGU,
    queryFn: pobierzStatusyKatalogu,
  });

  const alerty = useMemo(() => {
    if (!produkty.data || !statusy.data) return null;
    const mapa = new Map(statusy.data.map((w) => [w.id, w.status]));
    return policzAlertyKatalogu(produkty.data, mapa);
  }, [produkty.data, statusy.data]);

  return {
    alerty,
    ladowanie: produkty.isLoading || statusy.isLoading,
    blad: produkty.isError || statusy.isError,
  };
}
