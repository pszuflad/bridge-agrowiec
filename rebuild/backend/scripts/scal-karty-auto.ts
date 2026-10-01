// Ticket 177 — jednorazowe scalenie zdublowanych kart AUTO z kartami o prawdziwym kodzie dostawcy
// (Etap 1 SPEC „Naprawa kolejki stagingu”). Logika: src/import/migracje/scal-karty-auto.ts.
//
//   DB_PATH=./data/data-prod.db npm run scal-karty-auto                     # dry-run (domyślnie)
//   DB_PATH=... npm run scal-karty-auto -- --raport raport.csv              # dry-run + CSV
//   DB_PATH=... npm run scal-karty-auto -- --apply                          # backup + scalenie
//   SELLY_*=... npm run scal-karty-auto -- --zeruj-selly                    # stan 0 na wariantach AUTO
//   SELLY_*=... npm run scal-karty-auto -- --usun-duplikaty-selly           # ticket 180: usuń duplikaty AUTO z Selly
//
// --apply: najpierw `VACUUM INTO data/backups/<baza>.bak_full_scal_auto_<YYYYMMDDHHMMSS>`.
// Po scaleniu: `npm run selly:csv` i delta sync (patrz wypisana instrukcja).

import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { wczytajEnv } from "../src/config/env.js";
import { otworzBaze } from "../src/db/index.js";
import { zastosujMigracje } from "../src/db/migrate.js";
import {
  raportCsv,
  raportScalenia,
  zastosujScalenie,
  usunDuplikatySelly,
  zerujWariantySelly,
} from "../src/import/migracje/scal-karty-auto.js";
import { stworzKlientaSelly } from "../src/selly/klient.js";
import { opakujKlientaTrybem } from "../src/selly/tryb.js";

const dbPath = process.env.DB_PATH;
if (!dbPath) {
  console.error("scal-karty-auto: brak DB_PATH — nie wiem, którą bazę scalać. Przerywam.");
  process.exit(1);
}
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const zerujSelly = args.includes("--zeruj-selly");
const usunSelly = args.includes("--usun-duplikaty-selly");
const iRaport = args.indexOf("--raport");
const plikRaportu = iRaport >= 0 ? args[iRaport + 1] : undefined;

const { sqlite } = otworzBaze(dbPath);
try {
  zastosujMigracje(sqlite);

  if (zerujSelly || usunSelly) {
    const env = wczytajEnv({ JWT_SECRET: "nieuzywany", ...process.env });
    const klient = opakujKlientaTrybem(
      stworzKlientaSelly({
        shopUrl: env.SELLY_SHOP_URL,
        clientId: env.SELLY_CLIENT_ID,
        clientSecret: env.SELLY_CLIENT_SECRET,
        scope: env.SELLY_SCOPE,
      }),
      env.SELLY_TRYB,
    );
    if (usunSelly) {
      const u = await usunDuplikatySelly(sqlite, klient);
      console.log(
        `scal-karty-auto: usunięto z Selly ${u.usunietoWarianty} wariantów i ${u.usunietoProdukty} produktów ` +
          `(duplikaty AUTO), pominięto ${u.pominieto} (wariant współdzielony), błędów ${u.bledy}.`,
      );
      process.exitCode = u.bledy ? 1 : 0;
    } else {
      const w = await zerujWariantySelly(sqlite, klient);
      console.log(`scal-karty-auto: wyzerowano ${w.wyzerowano} wariantów w Selly, pominięto ${w.pominieto} (wariant współdzielony), błędów ${w.bledy}.`);
      process.exitCode = w.bledy ? 1 : 0;
    }
  } else {
    if (apply) {
      const znacznik = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
      const katalog = join(dirname(dbPath), "backups");
      mkdirSync(katalog, { recursive: true });
      const kopia = join(katalog, `${basename(dbPath)}.bak_full_scal_auto_${znacznik}`);
      sqlite.prepare("VACUUM INTO ?").run(kopia);
      console.log(`scal-karty-auto: kopia bazy: ${kopia}`);
    }
    const wynik = apply ? zastosujScalenie(sqlite) : raportScalenia(sqlite);
    if (plikRaportu) writeFileSync(plikRaportu, "﻿" + raportCsv(wynik.raport), "utf-8");
    const powody = new Map<string, number>();
    for (const w of wynik.raport) {
      if (w.decyzja === "do_recznej") powody.set(w.powod, (powody.get(w.powod) ?? 0) + 1);
    }
    console.log(
      `scal-karty-auto: ${apply ? "SCALONO" : "do scalenia (dry-run)"} ${wynik.scalono}, ` +
        `duplikatów AUTO do usunięcia ${wynik.usunieto}, do ręcznej decyzji ${wynik.doRecznej}.`,
    );
    for (const [p, n] of powody) console.log(`  do_recznej: ${n} × ${p}`);
    if (apply) {
      console.log(
        "Dalej: npm run selly:csv, delta sync Selly, potem --zeruj-selly (stan 0 wariantów AUTO) " +
          "i --usun-duplikaty-selly (duplikaty AUTO ze stanem 0).",
      );
    }
  }
} finally {
  sqlite.close();
}
