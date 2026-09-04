/**
 * Widok `/selly` — Iteracja 8, sesja 8b.
 *
 * Odtwarza ŻYWY panel `mirror/frontend/assets/selly-injection.js`
 * (30 936 B, `VERSION='v5-csvstatus-genbtn'`): pięć sekcji, sześć tras API.
 *
 * ⚠ Obok injection leży `mirror/frontend/selly.html` — to MARTWY POPRZEDNIK: nie ma
 * generowania CSV, nie jest z niczego linkowany, dostępny tylko po bezpośrednim URL.
 * Odtwarzamy injection, nie jego.
 *
 * ⚠ ODSTĘPSTWO O1 (zakres iteracji): oryginał nie miał dla Selly trasy Reacta w ogóle.
 * Skrypt wstrzykiwał link do sidebara, trzymał adres na `#/` i overlayował `<main>`,
 * a stan „jesteśmy w Selly" siedział w `sessionStorage.sellyViewActive`. Tu jest to
 * normalna trasa Wouter i normalna pozycja menu.
 *
 * ⚠ CZTERY TRASY BEZ UI (decyzja D1): `dictionaries`, `producers`, `categories`,
 * `sync-product` mają backend od 8a, ale żywy panel ich nie pokazuje — w produkcji
 * używano ich z konsoli. Nie dorabiamy im ekranu.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  KLUCZ_LOG,
  KLUCZ_PING,
  KLUCZ_STATUS,
  KLUCZ_STATUS_CSV,
  pobierzLog,
  pobierzPing,
  pobierzStatusCsv,
  pobierzStatusDostawcow,
  synchronizujDostawce,
  wygenerujCsv,
  type ParametrySynchronizacji,
} from "./selly/api";
import { posortujKodyDostawcow } from "./selly/formatowanie";
import { PYTANIE_O_GENEROWANIE, SekcjaCsv } from "./selly/SekcjaCsv";
import { SekcjaLog } from "./selly/SekcjaLog";
import { SekcjaMapowanie } from "./selly/SekcjaMapowanie";
import { SekcjaPolaczenie } from "./selly/SekcjaPolaczenie";
import { SekcjaSync } from "./selly/SekcjaSync";

/** Co czeka na potwierdzenie — `null`, gdy dialog jest zamknięty. */
type Potwierdzenie =
  | { rodzaj: "generowanie" }
  | { rodzaj: "sync"; dostawca: string; limit: number; tylkoZmienione: boolean };

export function Selly() {
  const klient = useQueryClient();

  const ping = useQuery({ queryKey: KLUCZ_PING, queryFn: pobierzPing });
  const statusCsv = useQuery({ queryKey: KLUCZ_STATUS_CSV, queryFn: pobierzStatusCsv });
  const status = useQuery({ queryKey: KLUCZ_STATUS, queryFn: pobierzStatusDostawcow });
  const log = useQuery({ queryKey: KLUCZ_LOG, queryFn: pobierzLog });

  // Formularz „Sync dostawcy". `limit: 0` = wszystko (oryginał: `value="0"`, :462).
  const [dostawca, ustawDostawce] = useState("");
  const [limit, ustawLimit] = useState(0);
  const [tylkoZmienione, ustawTylkoZmienione] = useState(false);
  const [potwierdzenie, ustawPotwierdzenie] = useState<Potwierdzenie | null>(null);

  // ODSTĘPSTWO D5: lista dostawców z `/status`, nie zahardkodowana `MO1…MO10` (:499).
  const dostawcy = posortujKodyDostawcow((status.data ?? []).map((wiersz) => wiersz.dostawca));

  // Pierwszy dostawca z listy jako wybór startowy — natywny <select> i tak pokazałby
  // pierwszą opcję, więc bez tego stan komponentu rozjechałby się z tym, co widać.
  useEffect(() => {
    if (dostawcy.length > 0 && !dostawcy.includes(dostawca)) {
      ustawDostawce(dostawcy[0] as string);
    }
  }, [dostawcy, dostawca]);

  const generowanie = useMutation({
    mutationFn: wygenerujCsv,
    // Oryginał po sukcesie przeładowuje status pliku (`loadCsvStatus()`, :613).
    onSuccess: () => klient.invalidateQueries({ queryKey: KLUCZ_STATUS_CSV }),
  });

  const synchronizacja = useMutation({
    mutationFn: (parametry: ParametrySynchronizacji) => synchronizujDostawce(parametry),
    /*
     * Odświeżenie TYLKO po sukcesie — tak jak oryginał.
     *
     * `doSync` przy `!r.ok` wypisuje błąd i robi `return` (`selly-injection.js:705-710`),
     * więc `loadStatus()`/`loadLog()` na końcu funkcji (`:737-738`) w ogóle się nie
     * wykonują. `onSettled` odpalałoby je także po błędzie — po nieudanym syncu ekran
     * przeładowywałby się bez powodu, sugerując, że coś się jednak stało.
     * Dry-run odświeża tak samo jak pełny sync, bo oryginał ich w tym miejscu nie rozróżnia.
     */
    onSuccess: () => {
      void klient.invalidateQueries({ queryKey: KLUCZ_STATUS });
      void klient.invalidateQueries({ queryKey: KLUCZ_LOG });
    },
  });

  /** Dry-run nic nie zapisuje, więc leci bez pytania (D3). Limit wymuszony na 5 (:696). */
  const uruchomDryRun = (): void => {
    synchronizacja.mutate({ dostawca, dry_run: true, limit: 5, only_updated: tylkoZmienione });
  };

  const wykonajPotwierdzone = (): void => {
    if (!potwierdzenie) return;
    if (potwierdzenie.rodzaj === "generowanie") {
      generowanie.mutate();
    } else {
      synchronizacja.mutate({
        dostawca: potwierdzenie.dostawca,
        dry_run: false,
        limit: potwierdzenie.limit,
        only_updated: potwierdzenie.tylkoZmienione,
      });
    }
    ustawPotwierdzenie(null);
  };

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="Integracja Selly.pl"
        subtitle="Synchronizacja produktów z Bridge do sklepu w Selly przez API v3."
      />

      <SekcjaPolaczenie
        dane={ping.data}
        ladowanie={ping.isPending}
        blad={ping.error}
      />

      <SekcjaCsv
        dane={statusCsv.data}
        ladowanie={statusCsv.isPending}
        blad={statusCsv.error}
        onOdswiez={() => void klient.invalidateQueries({ queryKey: KLUCZ_STATUS_CSV })}
        onGeneruj={() => ustawPotwierdzenie({ rodzaj: "generowanie" })}
        generowanie={generowanie.isPending}
        wynikGenerowania={generowanie.data}
        bladGenerowania={generowanie.error}
      />

      <SekcjaMapowanie
        wiersze={status.data ?? []}
        ladowanie={status.isPending}
        blad={status.error}
        onOdswiez={() => void klient.invalidateQueries({ queryKey: KLUCZ_STATUS })}
        // ⚠ W oryginale ten przycisk odpalał pełny sync natychmiast (:641-644).
        // D3: przechodzi przez to samo potwierdzenie co „Wyślij do Selly".
        onSync={(kod) =>
          ustawPotwierdzenie({ rodzaj: "sync", dostawca: kod, limit, tylkoZmienione })
        }
        syncTrwa={synchronizacja.isPending}
      />

      <SekcjaSync
        dostawcy={dostawcy}
        dostawca={dostawca}
        onDostawca={ustawDostawce}
        limit={limit}
        onLimit={ustawLimit}
        tylkoZmienione={tylkoZmienione}
        onTylkoZmienione={ustawTylkoZmienione}
        onDryRun={uruchomDryRun}
        onWyslij={() =>
          ustawPotwierdzenie({ rodzaj: "sync", dostawca, limit, tylkoZmienione })
        }
        trwa={synchronizacja.isPending}
        wynik={synchronizacja.data}
        blad={synchronizacja.error}
      />

      <SekcjaLog
        wpisy={log.data ?? []}
        ladowanie={log.isPending}
        blad={log.error}
        onOdswiez={() => void klient.invalidateQueries({ queryKey: KLUCZ_LOG })}
      />

      <DialogPotwierdzenia
        potwierdzenie={potwierdzenie}
        onZamknij={() => ustawPotwierdzenie(null)}
        onPotwierdz={wykonajPotwierdzone}
      />
    </div>
  );
}

/**
 * Jeden dialog na dwie operacje.
 *
 * Generowanie CSV odtwarza `confirm()` z oryginału (`:599`) — tekst dosłowny.
 * Wysyłka do Selly to ODSTĘPSTWO D3: oryginał wysyłał od razu po kliknięciu, a operacja
 * realnie tworzy i modyfikuje produkty w cudzym, żywym sklepie.
 */
function DialogPotwierdzenia({
  potwierdzenie,
  onZamknij,
  onPotwierdz,
}: {
  potwierdzenie: Potwierdzenie | null;
  onZamknij: () => void;
  onPotwierdz: () => void;
}) {
  const generowanie = potwierdzenie?.rodzaj === "generowanie";

  return (
    <Dialog open={potwierdzenie != null} onOpenChange={(otwarty) => !otwarty && onZamknij()}>
      <DialogContent data-testid="selly-dialog-potwierdzenia">
        <DialogHeader>
          <DialogTitle>
            {generowanie ? "Wygenerować plik CSV?" : "Wysłać produkty do Selly?"}
          </DialogTitle>
          <DialogDescription>
            {generowanie
              ? PYTANIE_O_GENEROWANIE
              : potwierdzenie?.rodzaj === "sync" && (
                  <>
                    Dostawca <strong>{potwierdzenie.dostawca}</strong> zostanie
                    zsynchronizowany do sklepu Selly
                    {potwierdzenie.limit > 0
                      ? ` (limit ${potwierdzenie.limit} produktów)`
                      : " (bez limitu)"}
                    {potwierdzenie.tylkoZmienione ? ", tylko pozycje zmienione" : ""}. Operacja{" "}
                    <strong>tworzy i modyfikuje produkty w żywym sklepie</strong> i nie da się
                    jej cofnąć z tego panelu.
                  </>
                )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={onZamknij} data-testid="selly-anuluj">
            Anuluj
          </Button>
          <Button
            variant={generowanie ? "default" : "destructive"}
            onClick={onPotwierdz}
            data-testid="selly-potwierdz"
          >
            {generowanie ? "Wygeneruj" : "Wyślij do Selly"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
