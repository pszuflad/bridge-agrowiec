// Budżet czasu testów: czyta raport JSON z vitest i porównuje czasy wybranych testów
// z budżetami w rebuild/backend/test/budzety-czasu.json (ticket 132).
//
// Po co: dwóm testom podnieśliśmy limit z 20 s do 120 s, żeby nie migały na czerwono przy
// obciążonej maszynie. Sam podniesiony limit chowałby jednak regresję wydajności — ten skrypt
// pilnuje, żeby czas nie rósł niezauważenie i mówi, co zrobić, gdy urośnie.
//
// Użycie:
//   cd rebuild/backend && npx vitest run --reporter=default --reporter=json --outputFile=/tmp/wyniki.json
//   node ../../tools/czas-testow.cjs /tmp/wyniki.json
//
// Kody wyjścia: 0 — wszystko w budżecie (albo raportu nie ma); 1 — przekroczony TWARDY limit.
// Przekroczenie samego budżetu daje ostrzeżenie (i adnotację ::warning:: na GitHub Actions),
// ale nie psuje biegu — sygnał ma być widoczny, nie blokujący.
const fs = require("node:fs");
const path = require("node:path");

const naGithubie = Boolean(process.env.GITHUB_ACTIONS);
const raportSciezka = process.argv[2];
const korzen = path.resolve(__dirname, "..");
const budzetySciezka = path.join(korzen, "rebuild/backend/test/budzety-czasu.json");

if (!raportSciezka || !fs.existsSync(raportSciezka)) {
  console.log(`czas-testow: brak raportu (${raportSciezka ?? "nie podano ścieżki"}) — pomijam.`);
  process.exit(0);
}
if (!fs.existsSync(budzetySciezka)) {
  console.log("czas-testow: brak pliku budżetów — pomijam.");
  process.exit(0);
}

const raport = JSON.parse(fs.readFileSync(raportSciezka, "utf8"));
const { budzety } = JSON.parse(fs.readFileSync(budzetySciezka, "utf8"));

let twardePrzekroczenie = false;
console.log("czas-testow: budżety czasu (ticket 132)");

for (const b of budzety) {
  const plik = (raport.testResults ?? []).find((t) => String(t.name).includes(b.plik));
  if (!plik) {
    console.log(`  ? ${b.test} — nie znaleziono pliku ${b.plik} w raporcie`);
    continue;
  }
  const test = (plik.assertionResults ?? []).find((a) => String(a.fullName ?? a.title).includes(b.test));
  if (!test) {
    console.log(`  ? ${b.test} — nie znaleziono testu w ${b.plik}`);
    continue;
  }
  if (test.status === "skipped" || typeof test.duration !== "number") {
    console.log(`  – ${b.test} — pominięty, nie mierzę`);
    continue;
  }

  const s = test.duration / 1000;
  const zmierzone =
    typeof b.zmierzone_s === "object" && b.zmierzone_s !== null
      ? Object.entries(b.zmierzone_s).map(([k, v]) => `${k}: ${v} s`).join(", ")
      : `${b.zmierzone_s} s`;
  const opis = `${b.test}: ${s.toFixed(1)} s (budżet ${b.budzet_s} s, limit ${b.limit_s} s; przy zakładaniu budżetu — ${zmierzone})`;

  if (s > b.limit_s) {
    twardePrzekroczenie = true;
    const tekst = `PRZEKROCZONY TWARDY LIMIT — ${opis}. ${b.po_przekroczeniu}`;
    console.error(naGithubie ? `::error::czas-testow: ${tekst}` : `  ✗ ${tekst}`);
  } else if (s > b.budzet_s) {
    const tekst = `poza budżetem — ${opis}. ${b.po_przekroczeniu}`;
    console.log(naGithubie ? `::warning::czas-testow: ${tekst}` : `  ⚠ ${tekst}`);
  } else {
    console.log(`  ✓ ${opis}`);
  }
}

process.exit(twardePrzekroczenie ? 1 : 0);
